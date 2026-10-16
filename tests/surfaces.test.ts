import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DemoTerrain, type TerrainProvider } from '../src/core/terrain';
import { GeographicTerrain, type MapLine, type SectorManifest } from '../src/geo/sector';
import { drapeFootprint, ribbonFootprint, surfaceGeometry } from '../src/geo/surfaces';
const read = (f:string) => JSON.parse(readFileSync('public/geo/brembilla-centro/'+f,'utf8'));
function checkInteriors(positions:ArrayLike<number>, indices:ArrayLike<number>, terrain:TerrainProvider, offset:number) {
  let worst = 0, area = 0;
  for(let i=0;i<indices.length;i+=3){
    const p=Array.from({length:3},(_,k)=>Array.from({length:3},(_,j)=>positions[indices[i+k]*3+j]));
    area+=Math.abs((p[1][0]-p[0][0])*(p[2][2]-p[0][2])-(p[1][2]-p[0][2])*(p[2][0]-p[0][0]))/2;
    for(const w of [[1/3,1/3,1/3],[.1,.2,.7],[.5,.5,0],[0,.5,.5],[.5,0,.5]]) {
      const v=[0,1,2].map(j=>p.reduce((sum,p,k)=>sum+p[j]*w[k],0));
      worst=Math.max(worst,Math.abs(v[1]-terrain.heightAt(v[0],v[2])-offset));
    }
  }
  return { worst, area };
}
describe('terrain-conforming mapped surfaces',()=>{
  it('preserves area and conforms across cell edges and diagonals, not just at vertices',()=>{
    const terrain:TerrainProvider={size:40,segments:2,heights:new Float32Array([0,0,10,0,20,0,5,0,0]),heightAt:DemoTerrain.prototype.heightAt};
    const points:[number,number][]=[[-19,-19],[19,-17],[2,18]], original=[0,1,2];
    const naive=points.flatMap(([x,z])=>[x,terrain.heightAt(x,z)+.24,z]);
    expect(checkInteriors(naive,original,terrain,.24).worst).toBeGreaterThan(5);
    const split=drapeFootprint(points,original,terrain,.24), result=checkInteriors(split.positions,split.indices,terrain,.24);
    expect(result.worst).toBeLessThan(1e-5);
    expect(result.area).toBeCloseTo(checkInteriors(naive,original,terrain,.24).area,6);
  });
  it('fixes real sector interiors without moving road footprints, terrain or bridge geometry',()=>{
    const terrain=new GeographicTerrain(read('terrain.json')), manifest=read('manifest.json') as SectorManifest;
    const before=terrain.heights.slice();let oldWorst=0,newWorst=0,oldTriangles=0,newTriangles=0;
    for(const tile of manifest.tiles){
      const lines=read(tile.url).lines as MapLine[];
      for(const line of lines){
        const f=ribbonFootprint(line),offset=line.kind==='water'?.36:line.bridge?2:.24;
        const naive=f.points.flatMap(([x,z])=>[x,terrain.heightAt(x,z)+offset,z]);
        const geo=surfaceGeometry([line],terrain), pos=geo.getAttribute('position').array, ind=geo.getIndex()!.array;
        if(line.bridge){expect(Array.from(pos)).toEqual(Array.from(new Float32Array(naive)));expect(Array.from(ind)).toEqual(f.indices);}
        else {
          oldWorst=Math.max(oldWorst,checkInteriors(naive,f.indices,terrain,offset).worst);
          const r=checkInteriors(pos,ind,terrain,offset);newWorst=Math.max(newWorst,r.worst);
          // Clipping only loses ribbon area outside the terrain boundary; covered interior lines retain it.
          if(f.points.every(([x,z])=>Math.abs(x)<1999&&Math.abs(z)<1999))expect(r.area).toBeCloseTo(checkInteriors(naive,f.indices,terrain,offset).area,0);
        }
        oldTriangles+=f.indices.length/3;newTriangles+=ind.length/3;geo.dispose();
      }
    }
    expect(newWorst).toBeLessThan(.002);expect(oldWorst).toBeGreaterThan(1);
    expect(newTriangles).toBeLessThan(oldTriangles*5);
    expect(terrain.heights).toEqual(before);
    console.log(JSON.stringify({surfaceRegression:{oldWorstMeters:oldWorst,newWorstMeters:newWorst,oldTriangles,newTriangles}}));
  });
});
