#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Private, bounded photo-pair screening. No reconstruction, uploads or GPS-derived
coverage claims. Homographies only indicate shared projective image structure.
"""
import argparse, itertools, json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageOps
from pipeline import outside_repo, read_json, sha256, write_json

MAX_FILES = 30

def descriptors(path):
    with Image.open(path) as image:
        image.draft('L', (1600,1600))
        image=ImageOps.exif_transpose(image).convert('L')
        image.thumbnail((1280,1280))
        pixels=np.asarray(image)
    detector=cv2.ORB_create(nfeatures=2500)
    points, desc=detector.detectAndCompute(pixels,None)
    return np.float32([p.pt for p in points]).reshape(-1,2),desc,pixels.shape

def pair_evidence(a,b):
    pa,da,sa=a;pb,db,sb=b
    result={'mutualMatches':0,'homographyInliers':0,'inlierFraction':0.0,'imageHullFractions':[0.,0.],
            'projectiveOverlapIndication':False}
    if da is None or db is None or len(da)<2 or len(db)<2:return result
    matcher=cv2.BFMatcher(cv2.NORM_HAMMING)
    def ratios(x,y):
        return {p[0].queryIdx:p[0].trainIdx for p in matcher.knnMatch(x,y,k=2)
                if len(p)==2 and p[0].distance < .75*p[1].distance}
    ab,ba=ratios(da,db),ratios(db,da)
    good=[(i,j) for i,j in ab.items() if ba.get(j)==i]
    result['mutualMatches']=len(good)
    if len(good)<8:return result
    x=np.float32([pa[i] for i,_ in good]);y=np.float32([pb[j] for _,j in good])
    cv2.setRNGSeed(47)
    h,mask=cv2.findHomography(x,y,cv2.RANSAC,3.0,maxIters=2000,confidence=.995)
    if h is None or mask is None or not np.isfinite(h).all():return result
    keep=mask.ravel().astype(bool);count=int(keep.sum())
    fractions=[float(cv2.contourArea(cv2.convexHull(p[keep]))/(s[0]*s[1])) if count>=3 else 0.
               for p,s in [(x,sa),(y,sb)]]
    result.update(homographyInliers=count,inlierFraction=count/len(good),imageHullFractions=fractions)
    result['projectiveOverlapIndication']=bool(count>=20 and count/len(good)>=.4 and min(fractions)>=.03)
    return result

def screen(originals,inventory_file,output):
    originals,inventory_file,output=map(outside_repo,(originals,inventory_file,output))
    data=read_json(inventory_file)
    if data.get('private') is not True:raise ValueError('Private inventory required')
    files=[e for e in data['files'] if not e.get('duplicateOf') and Path(e['file']).suffix.lower() in ('.jpg','.jpeg')]
    if not 2<=len(files)<=MAX_FILES:raise ValueError('Select 2–30 unique JPG originals; DNG must first be developed consistently')
    cv2.setNumThreads(1)
    features=[]
    for e in files:
        path=(originals/e['file']).resolve()
        if originals not in path.parents:raise ValueError('Photo path escapes originals directory')
        if sha256(path)!=e['sha256']:raise ValueError('Original changed since inventory')
        features.append(descriptors(path))
    pairs=[];adj=[set() for _ in files]
    for i,j in itertools.combinations(range(len(files)),2):
        evidence=pair_evidence(features[i],features[j]);pairs.append({'a':files[i]['file'],'b':files[j]['file'],**evidence})
        if evidence['projectiveOverlapIndication']:adj[i].add(j);adj[j].add(i)
    unseen=set(range(len(files)));components=[]
    while unseen:
        todo=[min(unseen)];component=[]
        while todo:
            i=todo.pop()
            if i not in unseen:continue
            unseen.remove(i);component.append(files[i]['file']);todo.extend(sorted(adj[i]))
        components.append(sorted(component))
    result={'schemaVersion':1,'private':True,'inventorySHA256':sha256(inventory_file),'opencvVersion':cv2.__version__,
            'method':{'features':'ORB','maxFeatures':2500,'maxImageSide':1280,'ratio':.75,'ransacPixels':3.,'allPairs':True},
            'images':[{'file':e['file'],'features':len(f[0]),'samplePixels':[f[2][1],f[2][0]]} for e,f in zip(files,features)],
            'pairs':pairs,'candidateComponents':components,'readyForReconstruction':False,
            'limitations':['Indications of shared image structure, not measured percentage overlap or 3D coverage.',
                          'Homography is a planar test: parallax, vegetation, repetition, water and low texture can invalidate it.',
                          'A connected graph does not prove calibrated cameras, sufficient baselines, visible facades or a complete mesh.',
                          'Review contact sheets and perform SfM with independent geographic checks before acceptance.',
                          'No GPS precision, ground elevation, license or privacy approval is inferred.']}
    write_json(output,result);return result

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('originals');ap.add_argument('inventory');ap.add_argument('report');a=ap.parse_args()
    r=screen(a.originals,a.inventory,a.report)
    print(f"Privately screened {len(r['images'])} images / {len(r['pairs'])} pairs; reconstruction remains unverified")
if __name__=='__main__':main()
