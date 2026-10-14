#!/usr/bin/env python3
"""Offline import only. Runtime downloads bundled JSON, never upstream map APIs.
Requires numpy, rasterio, pyproj, shapely. See docs/GEOGRAPHY-1.0.md.
"""
import argparse, hashlib, json, math, collections
from pathlib import Path
import xml.etree.ElementTree as ET
import numpy as np
import rasterio
from rasterio.transform import rowcol
from pyproj import Transformer
from shapely.geometry import Polygon, LineString, box
from shapely.ops import polygonize, unary_union
from shapely import contains_xy

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/geo/brembilla-centro'
EAST, NORTH, DATUM, SIZE, SEGMENTS = 546280, 5074440, 400, 4000, 200
OSM_URL = 'https://api.openstreetmap.org/api/0.6/map?bbox=9.570,45.805,9.623,45.841'
DEM_URL = 'https://tinitaly.pi.ingv.it/TINItaly_1_1/wcs?service=WCS&version=1.0.0&request=GetCoverage&coverage=TINItaly_1_1%3Atinitaly_dem&crs=EPSG%3A32632&bbox=544280%2C5072440%2C548280%2C5076440&width=401&height=401&format=GeoTIFF'
PROJECT = Transformer.from_crs(4326, 32632, always_xy=True)

def write(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(',', ':'), ensure_ascii=False)+'\n')

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--dem', required=True); parser.add_argument('--osm', required=True); parser.add_argument('--osm-extra', nargs='*', default=[])
    args = parser.parse_args()
    with rasterio.open(args.dem) as dem:
        if dem.crs.to_epsg() != 32632: raise ValueError('Expected EPSG:32632')
        raster = dem.read(1)
        def sample(x,z):
            # Bilinear sampling at pixel centres, explicitly clamped at coverage edge.
            col,row = (~dem.transform)*(x+EAST,NORTH-z)
            col = np.clip(col-.5,0,dem.width-1.000001); row=np.clip(row-.5,0,dem.height-1.000001)
            i,j=int(row),int(col); v,u=row-i,col-j
            h=float((1-v)*((1-u)*raster[i,j]+u*raster[i,j+1])+v*((1-u)*raster[i+1,j]+u*raster[i+1,j+1]))
            if not math.isfinite(h) or h < 0: raise ValueError('Missing or invalid terrain sample')
            return round((h-DATUM)*10)/10
        heights=[round(sample(x*20-2000,z*20-2000)*10) for z in range(201) for x in range(201)]
        write(OUT/'terrain.json', {'size':SIZE,'segments':SEGMENTS,'heightScale':.1,'heights':heights})
        root=ET.parse(args.osm).getroot()
        seen={(e.tag,e.attrib.get('id')) for e in root}
        for path in args.osm_extra:
            for element in ET.parse(path).getroot():
                key=(element.tag,element.attrib.get('id'))
                if element.tag in ['node','way','relation'] and key not in seen: root.append(element);seen.add(key)
        def coords(n):
            e,north=PROJECT.transform(float(n.attrib['lon']),float(n.attrib['lat']))
            return [round(e-EAST,2),round(NORTH-north,2)]
        nodes={n.attrib['id']:coords(n) for n in root.findall('node')}
        ways={w.attrib['id']:w for w in root.findall('way')}
        def tags(el): return {t.attrib['k']:t.attrib['v'] for t in el.findall('tag')}
        def points(el): return [nodes[n.attrib['ref']] for n in el.findall('nd') if n.attrib['ref'] in nodes]
        clip=box(-1850,-1850,1850,1850)
        buildings=[]; lines=[]; land=[]; places=[]; omitted=collections.Counter()
        def rounded(poly):return [[round(x,2),round(z,2)] for x,z in list(poly.exterior.coords)[:-1]]
        def polygon_feature(id,t,geom):
            if geom.is_empty: return
            if not geom.is_valid: geom=geom.buffer(0)
            geom=geom.intersection(clip)
            for part in getattr(geom,'geoms',[geom]):
                if not isinstance(part,Polygon) or part.area<5:continue
                footprint=rounded(part.simplify(.35,preserve_topology=True)); holes=[[[round(x,2),round(z,2)] for x,z in list(h.coords)[:-1]] for h in part.interiors]
                if t.get('building') and t['building']!='no':
                    height=8.;basis='artistic-default'
                    try:
                        if 'height' in t:height=float(t['height'].replace('m','').strip());basis='osm-height'
                        elif 'building:levels' in t:height=float(t['building:levels'])*3;basis='osm-levels-times-3m'
                    except ValueError:pass
                    height=max(2,min(65,height))
                    if t.get('building')=='church' and basis=='artistic-default':height=17
                    base=max(sample(x,z) for x,z in footprint)
                    buildings.append({'id':id,'points':footprint,'holes':holes,'base':base,'height':height,'heightBasis':basis,'kind':t['building'],'name':t.get('name','')})
                else:
                    kind=t.get('landuse',t.get('natural',''))
                    if kind in ['forest','wood','meadow','grass','scrub','residential','industrial']:
                        land.append({'id':id,'kind':kind,'points':footprint,'holes':holes})
        handled=set()
        for rel in root.findall('relation'):
            t=tags(rel)
            if t.get('type')!='multipolygon' or not (t.get('building') or t.get('landuse') or t.get('natural')):continue
            outer=[];inner=[];ids=[];complete=True
            for member in rel.findall('member'):
                if member.attrib.get('type')!='way':continue
                w=ways.get(member.attrib['ref'])
                if w is None:complete=False;break
                pts=points(w)
                if len(pts)>1:(inner if member.attrib.get('role')=='inner' else outer).append(LineString(pts));ids.append(member.attrib['ref'])
            if not complete:omitted['incompleteMultipolygons']+=1;continue
            try:
                shape=unary_union(list(polygonize(outer))); holes=unary_union(list(polygonize(inner)))
                polygon_feature('relation/'+rel.attrib['id'],t,shape.difference(holes));handled.update(ids)
            except Exception:omitted['invalidMultipolygons']+=1
        widths={'primary':8,'secondary':7,'tertiary':6,'residential':5,'unclassified':5,'service':3,'living_street':4,'track':2.5,'footway':1.5,'path':1.2,'steps':1.2}
        for id,w in ways.items():
            t=tags(w); pts=points(w)
            if len(pts)<2:continue
            if (t.get('building') or t.get('landuse') or t.get('natural')) and id not in handled and pts[0]==pts[-1]:
                polygon_feature('way/'+id,t,Polygon(pts))
            kind='road' if t.get('highway') in widths else 'water' if t.get('waterway') in ['river','stream','canal'] else None
            if not kind or t.get('tunnel') not in [None,'no'] or t.get('covered')=='yes':continue
            geom=LineString(pts).intersection(clip)
            for part in getattr(geom,'geoms',[geom]):
                if not isinstance(part,LineString) or part.length<2:continue
                width=widths.get(t.get('highway'),10 if t.get('waterway')=='river' else 2)
                measured=False
                try:
                    if 'width' in t:width=float(t['width'].replace('m','').strip());measured=True
                except ValueError:pass
                coords=list(part.coords); dense=[]
                for a,b in zip(coords,coords[1:]):
                    count=max(1,math.ceil(math.dist(a,b)/8))
                    for k in range(count):dense.append([round(a[0]+(b[0]-a[0])*k/count,2),round(a[1]+(b[1]-a[1])*k/count,2)])
                dense.append(list(coords[-1]))
                lines.append({'id':'way/'+id,'kind':kind,'class':t.get('highway',t.get('waterway')),'name':t.get('name',''),'width':max(.5,min(width,25)),'widthBasis':'osm-width' if measured else 'cartographic-default','bridge':t.get('bridge') not in [None,'no'],'points':dense})
        for n in root.findall('node'):
            t=tags(n); x,z=nodes[n.attrib['id']]
            if t.get('place') in ['village','hamlet','isolated_dwelling'] and abs(x)<1750 and abs(z)<1750:
                places.append({'id':'node/'+n.attrib['id'],'name':t.get('name',''),'x':x,'z':z})
        xs,zs=np.meshgrid(np.linspace(-2000,2000,201),np.linspace(-2000,2000,201))
        cover=np.zeros((201,201),dtype=np.uint8)
        for area in land:
            poly=Polygon(area['points'],area['holes'])
            kind=1 if area['kind'] in ['forest','wood'] else 2 if area['kind'] in ['meadow','grass'] else 3 if area['kind'] in ['residential','industrial'] else 0
            if kind:cover[contains_xy(poly,xs,zs)]=kind
        terrain=json.loads((OUT/'terrain.json').read_text());terrain['cover']=cover.ravel().tolist();write(OUT/'terrain.json',terrain)
        write(OUT/'collision.json',{'buildings':[{'id':b['id'],'points':b['points'],'holes':b['holes'],'base':b['base'],'height':b['height']} for b in buildings]})
        # Each feature belongs to one tile; the bounding box covers long rivers/roads too.
        tiles={}
        for category,features in [('buildings',buildings),('lines',lines),('land',land)]:
            for f in features:
                xs=[p[0] for p in f['points']];zs=[p[1] for p in f['points']]
                key=f'{math.floor((sum(xs)/len(xs)+2000)/500)}-{math.floor((sum(zs)/len(zs)+2000)/500)}'
                tile=tiles.setdefault(key,{'buildings':[],'lines':[],'land':[]});tile[category].append(f)
        manifest_tiles=[]
        for key,tile in sorted(tiles.items()):
            pts=[p for category in tile.values() for f in category for p in f['points']]
            bounds={'minX':min(p[0] for p in pts),'maxX':max(p[0] for p in pts),'minZ':min(p[1] for p in pts),'maxZ':max(p[1] for p in pts)}
            write(OUT/f'tiles/{key}.json',tile)
            manifest_tiles.append({'id':key,'url':f'tiles/{key}.json','bounds':bounds,'bytes':(OUT/f'tiles/{key}.json').stat().st_size})
        manifest={'id':'brembilla-centro-2026-10','title':'Brembilla · primo settore','reference':{'projectedCRS':'EPSG:32632','verticalDatum':'TINITALY source elevations; source does not identify a single vertical datum in the downloaded GeoTIFF. No mixing with ellipsoidal/GNSS heights.','originEasting':EAST,'originNorthing':NORTH,'originElevation':DATUM},'terrainURL':'terrain.json','size':SIZE,'limit':1750,'terrainSpacingMeters':20,'terrainNativeSpacingMeters':10,'tiles':manifest_tiles,'places':places,'counts':{'buildings':len(buildings),'roads':sum(l['kind']=='road' for l in lines),'waterways':sum(l['kind']=='water' for l in lines),'landPolygons':len(land),'places':len(places)},'omitted':dict(omitted),'sources':[{'title':'TINITALY 1.1','url':DEM_URL,'license':'CC-BY-4.0','licenseURL':'https://creativecommons.org/licenses/by/4.0/','attribution':'Tarquini S., Isola I., Favalli M., Battistini A., Dotta G. (2023). TINITALY, a digital elevation model of Italy with a 10 meters cell size (Version 1.1). INGV. https://doi.org/10.13127/tinitaly/1.1','sha256':hashlib.sha256(Path(args.dem).read_bytes()).hexdigest()},{'title':'OpenStreetMap','url':OSM_URL,'license':'ODbL-1.0','licenseURL':'https://opendatacommons.org/licenses/odbl/1-0/','attribution':'© OpenStreetMap contributors','sha256':hashlib.sha256(Path(args.osm).read_bytes()).hexdigest()}],'retrievedAt':'2026-10-14','limitations':['Only a first sector, not the whole Val Brembilla.','Footprints and routes from OSM; unmapped features remain absent.','Building heights/roofs/colours and road/stream widths mostly artistic; inspect heightBasis/widthBasis.','Trees are artistic instances within mapped woodland, not surveyed individual trees.','Terrain resampled to 20 m with no vertical exaggeration.','No aerial photos, textures, private images or external API at runtime.']}
        manifest['osmSupplementalSources']=[{'url':'https://api.openstreetmap.org/api/0.6/relation/'+Path(p).stem.split('-')[-1]+'/full','sha256':hashlib.sha256(Path(p).read_bytes()).hexdigest()} for p in args.osm_extra]
        write(OUT/'manifest.json',manifest)
        print(json.dumps({'counts':manifest['counts'],'tiles':len(tiles),'bytes':sum(p.stat().st_size for p in OUT.rglob('*.json')),'elevationRange':[min(heights)/10+400,max(heights)/10+400],'omitted':dict(omitted)},indent=2))
if __name__=='__main__':main()
