import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateHeightRelease, withSurveyedHeight, type HeightRelease } from '../src/geo/building-heights';
import { BuildingIndex, type Building, type SectorManifest } from '../src/geo/sector';
const read = (file:string) => JSON.parse(readFileSync('public/geo/brembilla-centro/'+file,'utf8'));
const manifest=read('manifest.json') as SectorManifest, original=read('collision.json').buildings as Building[];
const release=()=>read('dbgt-heights.json') as HeightRelease;
describe('conservative authentic DBGT heights',()=>{
  it('uses relative AV for 36 matched volumes, never absolute extrusion QE',()=>{
    const heights=validateHeightRelease(release(),manifest,original);
    expect(heights.size).toBe(36);
    for(const r of heights.values()) {
      expect(r.source.extrusionType).toBe('01');
      expect(r.height).toBeLessThan(20);
      expect(r.source.iou).toBeGreaterThanOrEqual(.8);
    }
  });
  it('shares identical heights in visual tiles and collision index; preserves every footprint/base',()=>{
    const heights=validateHeightRelease(release(),manifest,original);
    const enhanced=original.map(b=>withSurveyedHeight(b,heights)), index=new BuildingIndex(enhanced);
    for(const entry of manifest.tiles) for(const b of read(entry.url).buildings as Building[]) {
      const v=withSurveyedHeight(b,heights), c=index.buildings.find(o=>o.id===b.id)!;
      expect(v.height).toBe(c.height);expect(v.base).toBe(b.base);expect(v.points).toEqual(b.points);expect(v.holes).toEqual(b.holes);
    }
    expect(original.filter((b,i)=>b.height!==enhanced[i].height)).toHaveLength(36);
    const r=[...heights.values()].find(r=>r.height>r.expected.height)!;
    const b=enhanced.find(b=>b.id===r.id)!;
    // Test at a point just inside the first edge, also verifying the raised collision roof.
    const x=b.points.reduce((s,p)=>s+p[0],0)/b.points.length, z=b.points.reduce((s,p)=>s+p[1],0)/b.points.length;
    expect(index.hit({x,y:b.base+b.height-.01,z})?.id).toBe(b.id);
    expect(new BuildingIndex([b]).hit({x,y:b.base+b.height+.66,z})).toBeUndefined();
  });
  it('rejects datum/base/footprint changes, duplicates, absolute heights and ungrounded portions',()=>{
    for(const change of [
      (m:HeightRelease)=>{m.reference.originEasting++;},
      (m:HeightRelease)=>{m.records[0].expected.points[0][0]++;},
      (m:HeightRelease)=>{m.records[0].expected.base++;},
      (m:HeightRelease)=>{m.records.push(m.records[0]);},
      (m:HeightRelease)=>{m.records[0].height=450;},
      (m:HeightRelease)=>{m.records[0].source.portion='04';},
      (m:HeightRelease)=>{m.records[0].source.iou=NaN;},
    ]){const m=release();change(m);expect(()=>validateHeightRelease(m,manifest,original)).toThrow();}
  });
  it('retains the original object for unavailable or incompatible overrides',()=>{
    expect(withSurveyedHeight(original[0],new Map())).toBe(original[0]);
    const heights=validateHeightRelease(release(),manifest,original),r=[...heights.values()][0];
    const b={...original.find(b=>b.id===r.id)!,height:999};expect(withSurveyedHeight(b,heights)).toBe(b);
  });
});
