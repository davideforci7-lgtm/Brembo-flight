#!/usr/bin/env python3
"""Offline, exhaustive DBGT review. Classify every source volume without widening
runtime acceptance thresholds or replacing OSM footprints. Public GIS only.
"""
import argparse, collections, hashlib, importlib.util, json
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree
from pyproj import network
from pyproj.transformer import TransformerGroup

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('height_import', Path(__file__).with_name('prepare-dbgt-heights.py'))
height_import = importlib.util.module_from_spec(spec); spec.loader.exec_module(height_import)

def classification(a, hits, accepted):
    if accepted: return 'accepted-relative-height'
    if a.get('UN_VOL_POR') != '01': return 'non-ground-portion'
    if height_import.relative_height(a) is None: return 'unsupported-relative-height'
    if not hits: return 'no-osm-overlap'
    best = hits[0]
    if best['heightBasis'] == 'osm-height': return 'explicit-osm-height-needs-review'
    if sum(h['iou'] >= .1 for h in hits) > 1: return 'overlap-multiple-osm'
    if best['sourceCovered'] >= .8 and best['osmCovered'] < .8: return 'volume-part-of-larger-osm'
    if best['osmCovered'] >= .8 and best['sourceCovered'] < .8: return 'osm-part-of-larger-volume'
    if best['iou'] < .8: return 'outline-or-position-difference'
    if best['centroidMeters'] > 3: return 'centroid-distance-exceeds-limit'
    return 'association-needs-review'

def audit(raw, buildings, accepted_ids):
    if raw.get('spatialReference', {}).get('latestWkid',raw.get('spatialReference',{}).get('wkid')) != 7791 or raw.get('exceededTransferLimit'):
        raise ValueError('Complete EPSG:7791 input required')
    network.set_network_enabled(False)
    group=TransformerGroup(7791,32632,always_xy=True,allow_ballpark=False)
    if not group.best_available or not group.transformers: raise ValueError('Required operation unavailable')
    tx=group.transformers[0]
    shapes=[Polygon(b['points'],b['holes']) for b in buildings];tree=STRtree(shapes)
    rows=[];groups=collections.defaultdict(list)
    def hits_for(p):
        hits=[]
        for i in tree.query(p,predicate='intersects'):
            q=shapes[i];area=p.intersection(q).area
            if area<=0:continue
            hits.append({'osmId':buildings[i]['id'],'iou':area/p.union(q).area,
                         'sourceCovered':area/p.area,'osmCovered':area/q.area,
                         'centroidMeters':p.centroid.distance(q.centroid),'heightBasis':buildings[i].get('heightBasis')})
        return sorted(hits,key=lambda h:(-h['iou'],h['osmId']))
    for f in raw['features']:
        a=f['attributes'];rings=f['geometry']['rings']
        row={'dbgtObjectId':a['OBJECTID'],'buildingKey':a.get('CEDIUV'),'relativeHeight':a.get('UN_VOL_AV'),
             'extrusionType':a.get('UN_VOL_EX'),'extrusionValue':a.get('UN_VOL_QE'),'portion':a.get('UN_VOL_POR'),
             'validFrom':a.get('DATA_INI'),'validTo':a.get('DATA_FIN'),'accepted':a['OBJECTID'] in accepted_ids}
        if len(rings)!=1:row['classification']='complex-source-polygon'
        else:
            p=Polygon([v[:2] for v in rings[0]])
            if not p.is_valid or p.area<5:row['classification']='invalid-source-polygon'
            else:
                p=transform(lambda e,n:(e-546280,5074440-n),transform(tx.transform,p))
                hits=hits_for(p)
                row['classification']=classification(a,hits,row['accepted'])
                row['overlaps']=hits
                groups[a.get('CEDIUV')].append((a,p))
        rows.append(row)
    assemblies=[]
    for key,parts in sorted(groups.items()):
        if not key or len(parts)<2:continue
        p=unary_union([p for _,p in parts]);hits=hits_for(p)
        heights=[height_import.relative_height(a) for a,_ in parts]
        span=max(heights)-min(heights) if all(h is not None for h in heights) else None
        # Matching the union alone does not justify a single extrusion: differing
        # volumes need their own footprint, base and roof elevation checks.
        shape_ok=bool(hits and hits[0]['iou']>=.8 and hits[0]['centroidMeters']<=3 and sum(h['iou']>=.1 for h in hits)==1)
        assemblies.append({'buildingKey':key,'volumes':[a['OBJECTID'] for a,_ in parts],
                           'heightRangeMeters':span,'unionShapePasses':shape_ok,
                           'uniformHeightCandidate':shape_ok and span is not None and span<=.1,
                           'bestOverlap':hits[0] if hits else None,'decision':'review-only-no-runtime-change'})
    return {'schemaVersion':1,'sourceFeatures':len(rows),'accepted':len(accepted_ids),
            'classificationCounts':dict(collections.Counter(r['classification'] for r in rows)),
            'horizontalOperation':tx.description,'operationAccuracyMeters':tx.accuracy,
            'groupedAssemblies':len(assemblies),'matchingUnionShapes':sum(g['unionShapePasses'] for g in assemblies),
            'uniformHeightCandidates':sum(g['uniformHeightCandidate'] for g in assemblies),
            'limitations':['Classification is geometric triage, not a temporal change or demolition survey.',
                          'Absolute QE/Z are recorded but never treated as relative height.',
                          'No group is imported; differing volume heights must not be averaged into a guessed extrusion.',
                          'DATA_INI/FIN describe validity, not certified capture date.'],
            'volumes':rows,'assemblies':assemblies}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--output',type=Path,required=True);a=ap.parse_args()
    source=ROOT/'docs/research/dbgt/centre-2019-retrieved-2026-10-16.json'
    sector=ROOT/'public/geo/brembilla-centro';manifest=json.loads((sector/'manifest.json').read_text());byid={}
    for t in manifest['tiles']:
        for b in json.loads((sector/t['url']).read_text())['buildings']:byid[b['id']]=b
    accepted={r['source']['dbgtObjectId'] for r in json.loads((sector/'dbgt-heights.json').read_text())['records']}
    report=audit(json.loads(source.read_text()),list(byid.values()),accepted)
    report['sourceSHA256']=hashlib.sha256(source.read_bytes()).hexdigest()
    a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ('volumes','assemblies')},indent=2))
if __name__=='__main__':main()
