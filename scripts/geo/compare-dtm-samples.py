#!/usr/bin/env python3
"""Small reproducible numerical DTM5 probe, not a replacement raster or datum fit."""
import argparse,concurrent.futures,datetime,json,urllib.request,urllib.parse,time
from pathlib import Path
import numpy as np
BASE='https://www.cartografia.servizirl.it/arcgis/rest/services/wms/DTM5_RL_wms/MapServer/identify'
ROOT=Path(__file__).resolve().parents[2]
def sample(point):
 x,z=point;e,n=546280+x,5074440-z
 params=dict(f='json',geometry=f'{e},{n}',geometryType='esriGeometryPoint',sr=32632,layers='all:2',tolerance=0,mapExtent=f'{e-50},{n-50},{e+50},{n+50}',imageDisplay='100,100,96',returnGeometry='false')
 url=BASE+'?'+urllib.parse.urlencode(params)
 for attempt in range(3):
  try:
   with urllib.request.urlopen(url,timeout=25) as r:raw=json.load(r)
   value=float(raw['results'][0]['attributes']['Stretch.Pixel Value'])
   if not np.isfinite(value) or not -100<value<4000:raise ValueError('Invalid elevation')
   return {'x':x,'z':z,'easting':e,'northing':n,'dtm5':value}
  except Exception:
   if attempt==2:raise
   time.sleep(1)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--output',type=Path,required=True);ap.add_argument('--cached',type=Path);a=ap.parse_args()
 if a.cached:rows=json.loads(a.cached.read_text())['samples']
 else:
  with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:rows=list(pool.map(sample,[(x,z) for z in range(-400,401,100) for x in range(-400,401,100)]))
 terrain=json.loads((ROOT/'public/geo/brembilla-centro/terrain.json').read_text())
 for r in rows:
  i=int((r['z']+2000)/20)*201+int((r['x']+2000)/20)
  r['tinitalyGame']=terrain['heights'][i]*terrain['heightScale']+400
  r['difference']=r['dtm5']-r['tinitalyGame']
 d=np.array([r['difference'] for r in rows]);report={'sampleCount':len(rows),'retrievedAt':'2026-10-16','sourceURL':BASE,'license':'CC-BY-4.0','gridSpacingMeters':100,
  'method':'ArcGIS identify raw Stretch.Pixel Value, not hillshade colour. Compare exact 20 m game vertices; no vertical transform or bias correction.',
  'limitations':['81 sparse samples, not complete DTM acquisition or independent ground truth.','Vertical datums not resolved; differences are diagnostic, not accuracy estimates.','DTM native cell 5 m; game samples TINITALY at 20 m.'],
  'differenceMeters':{'bias':float(d.mean()),'rmse':float(np.sqrt(np.mean(d*d))),'min':float(d.min()),'max':float(d.max()),'median':float(np.median(d)),'p95Absolute':float(np.percentile(abs(d),95))},'samples':rows}
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report['differenceMeters'],indent=2))
if __name__=='__main__':main()
