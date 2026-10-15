import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { assetPath, photoGeometry, textureBytes, validatePhotoManifest, wantedPhotos, type PhotoManifest } from "../src/geo/photography";
import { GeographicTerrain, type SectorManifest } from "../src/geo/sector";
const sector = JSON.parse(readFileSync('public/geo/brembilla-centro/manifest.json','utf8')) as SectorManifest;
function fixture(): PhotoManifest {
  return { schemaVersion: 1, kind: 'orthophoto', reference: {...sector.reference}, terrainGridMeters:20,
    credit:{attribution:'SYNTHETIC TEST ONLY',sourceURL:'https://example.invalid',license:'CC0-1.0',licenseURL:'https://example.invalid/license',captureDate:'synthetic'},
    tiles: Array.from({length:20},(_,i)=>({id:String(i),bounds:{minX:i%5*100,minZ:Math.floor(i/5)*100,maxX:i%5*100+100,maxZ:Math.floor(i/5)*100+100},levels:([512,1024] as const).map(pixels=>({pixels,url:`test/${i}-${pixels}.webp`,bytes:128,sha256:'a'.repeat(64)}))})) };
}
describe('photographic geographic layer',()=>{
  it('is opt-in and existing PR3 data stays unchanged',()=>{
    expect(sector.photoManifestURL).toBeUndefined();
    expect(validatePhotoManifest(fixture(),sector).tiles).toHaveLength(20);
  });
  it('rejects mismatched coordinates, duplicate tiles, overlap, out of grid and missing credits',()=>{
    for(const mutate of [
      (m:PhotoManifest)=>{m.reference.originEasting+=1;},
      (m:PhotoManifest)=>{m.tiles[1].id=m.tiles[0].id;},
      (m:PhotoManifest)=>{m.tiles[1].bounds={...m.tiles[0].bounds};},
      (m:PhotoManifest)=>{m.tiles[0].bounds.minX+=1;},
      (m:PhotoManifest)=>{m.tiles[0].bounds.maxX=Infinity;},
      (m:PhotoManifest)=>{m.credit.attribution='';},
      (m:PhotoManifest)=>{m.tiles[0].levels[0].pixels=1024;},
      (m:PhotoManifest)=>{m.tiles[0].levels[0].bytes=3_000_000;},
    ]) { const m=fixture();mutate(m);expect(()=>validatePhotoManifest(m,sector)).toThrow(); }
  });
  it('only accepts packaged image paths',()=>{
    for(const path of ['https://remote.test/a.jpg','../private.jpg','test/%2e%2e/x.jpg','/absolute.jpg','data:xx','foo\\bar.jpg','x.jpg?token=x']) expect(assetPath(path)).toBe(false);
    expect(assetPath('ortho-release/0_-200-512.webp')).toBe(true);
  });
  it('bounds residency and changes resolution by preset',()=>{
    const m=fixture();
    for(const [preset,limit,pixels] of [['eco',8,512],['balanced',12,1024],['high',16,1024]] as const){
      const chosen=wantedPhotos(m,{x:50,z:50},preset);
      expect(chosen).toHaveLength(limit); expect(chosen[0].tile.id).toBe('0');
      expect(chosen.every(t=>t.level.pixels===pixels)).toBe(true);
    }
    expect(wantedPhotos(m,{x:5000,z:5000},'high')).toEqual([]);
    expect(textureBytes(512)*8/1024**2).toBeCloseTo(10.67,1);
  });
  it('keeps north at image top and copies collision mesh elevations and triangle diagonal',()=>{
    const terrain=new GeographicTerrain(JSON.parse(readFileSync('public/geo/brembilla-centro/terrain.json','utf8')));
    const g=photoGeometry(fixture().tiles[0],terrain);
    const p=g.getAttribute('position'),uv=g.getAttribute('uv');
    expect([uv.getX(0),uv.getY(0)]).toEqual([0,1]);
    expect([uv.getX(p.count-1),uv.getY(p.count-1)]).toEqual([1,0]);
    expect(Array.from(g.index!.array.slice(0,6))).toEqual([0,6,1,1,6,7]);
    for(let i=0;i<p.count;i++) expect(p.getY(i)).toBeCloseTo(terrain.heightAt(p.getX(i),p.getZ(i)),4);
    g.dispose();
  });
});
