#!/usr/bin/env python3
"""Conservative offline DBGT→OSM height association. No network or vertical shift.
Regenerate from the archived public sample; retain every original OSM geometry.
"""
import argparse, collections, hashlib, json, math
from pathlib import Path
import numpy as np
from pyproj import network, __version__ as proj_version
from pyproj.transformer import TransformerGroup
from shapely.geometry import Polygon
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[2]
SOURCE = 'https://www.cartografia.servizirl.it/arcgis5/rest/services/BaseMap/DBGT_Tema0201_Edificato/MapServer/0/query'

def relative_height(a):
    # QE=absolute roof elevation for EX01, never an extrusion height.
    h = a.get('UN_VOL_AV')
    if a.get('UN_VOL_POR') != '01' or a.get('UN_VOL_EX') not in ('01', '02'):
        return None
    return float(h) if isinstance(h, (int, float)) and math.isfinite(h) and 2 <= h <= 65 else None

def prepare(raw, buildings):
    if raw.get('spatialReference', {}).get('latestWkid', raw.get('spatialReference', {}).get('wkid')) != 7791 or raw.get('exceededTransferLimit'):
        raise ValueError('Require complete EPSG:7791 source sample')
    network.set_network_enabled(False)
    group = TransformerGroup(7791, 32632, always_xy=True, allow_ballpark=False)
    if not group.best_available or not group.transformers:
        raise ValueError('Required coordinate operation unavailable')
    tx = group.transformers[0]
    shapes = [(b, Polygon(b['points'], b['holes'])) for b in buildings]
    candidates, rows, rejected = [], [], collections.Counter()
    for f in raw['features']:
        a = f['attributes']; rings = f['geometry']['rings']
        # Multipart/holes require manual association; don't repair or flatten them.
        if len(rings) != 1:
            rejected['complex-source-polygon'] += 1; continue
        p = Polygon([(v[0], v[1]) for v in rings[0]])
        if not p.is_valid or p.area < 5:
            rejected['invalid-source-polygon'] += 1; continue
        p = transform(tx.transform, p)
        p = transform(lambda e,n: (e-546280, 5074440-n), p)
        hits = []
        for b,q in shapes:
            if not q.is_valid or not p.intersects(q): continue
            area = p.intersection(q).area
            if area > 0: hits.append((area/p.union(q).area, b, p.centroid.distance(q.centroid)))
        if not hits:
            rejected['no-osm-overlap'] += 1; continue
        iou,b,distance = max(hits, key=lambda r:r[0]); h=relative_height(a)
        row = {'dbgtObjectId':a['OBJECTID'], 'classId':a['CLASSID'], 'osmId':b['id'],
               'iou':round(iou,5), 'centroidDistanceMeters':round(distance,3), 'sourceHeightMeters':a.get('UN_VOL_AV'),
               'extrusionType':a['UN_VOL_EX'], 'extrusionValue':a['UN_VOL_QE'], 'portion':a['UN_VOL_POR'],
               'validFrom':a['DATA_INI'], 'previousHeight':b['height'], 'previousHeightBasis':b.get('heightBasis'), 'accepted':False}
        rows.append(row)
        if h is None: rejected['unsupported-height-or-portion'] += 1; continue
        if iou < .8 or distance > 3:
            rejected['weak-spatial-match'] += 1; continue
        if b.get('heightBasis') == 'osm-height':
            rejected['explicit-osm-height-needs-review'] += 1; continue
        # A second substantial OSM overlap indicates a split/merged representation.
        if sum(v[0] >= .1 for v in hits) > 1:
            rejected['ambiguous-osm-overlap'] += 1; continue
        candidates.append((b,h,row))
    counts=collections.Counter(b['id'] for b,_,_ in candidates)
    records=[]
    for b,h,row in candidates:
        if counts[b['id']] != 1:
            rejected['multiple-volumes-for-one-osm'] += 1; continue
        row['accepted']=True
        records.append({'id':b['id'], 'height':h, 'expected':{k:b[k] for k in ('base','height','points','holes')},
                        'source':row})
    diffs=[r['height']-r['expected']['height'] for r in records]
    report={'sourceFeatures':len(raw['features']), 'matchedFeatures':len(rows), 'accepted':len(records), 'rejected':dict(rejected),
            'horizontalOperation':tx.description, 'declaredOperationAccuracyMeters':tx.accuracy, 'pyprojVersion':proj_version,
            'heightChangeMeters': {'min':min(diffs), 'max':max(diffs), 'median':float(np.median(diffs))} if diffs else {},
            'matches':rows}
    return records,report

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--source',type=Path,required=True);ap.add_argument('--sector',type=Path,default=ROOT/'public/geo/brembilla-centro');ap.add_argument('--output',type=Path,required=True);ap.add_argument('--report',type=Path,required=True);args=ap.parse_args()
    raw=json.loads(args.source.read_text()); manifest=json.loads((args.sector/'manifest.json').read_text()); by_id={}
    for entry in manifest['tiles']:
        for b in json.loads((args.sector/entry['url']).read_text())['buildings']:by_id[b['id']]=b
    records,report=prepare(raw,list(by_id.values()))
    payload={'schemaVersion':1,'kind':'relative-building-heights','reference':manifest['reference'],
             'source':{'title':'Regione Lombardia — DBGT Tema Edificato', 'url':SOURCE,'license':'CC-BY-4.0','licenseURL':'https://creativecommons.org/licenses/by/4.0/',
                       'retrievedAt':'2026-10-16','sha256':hashlib.sha256(args.source.read_bytes()).hexdigest(),'sourceCRS':'EPSG:7791','sourceValidityDate':'2019-01-01',
                       'limitations':'Relative UN_VOL_AV only. Absolute QE/Z not used. OSM footprints and TINITALY terrain bases retained. DBGT date is start of validity, not certified capture date.'},
             'records':records}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.report.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
    args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='matches'},indent=2))
if __name__=='__main__':main()
