import { describe, expect, it } from 'vitest';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMaterialsUnlit } from '@gltf-transform/extensions';
import { mkdtemp, readFile, writeFile, rm, access, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { prepareMesh, privatePath, embeddedGLB } from '../scripts/photo/prepare-mesh.mjs';
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
async function fixture(path:string){
 const d=new Document(),buffer=d.createBuffer();const pos=[],uv=[],normal=[],indices=[];const n=100;
 for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){pos.push(x/5,0,z/5);uv.push(x/n,z/n);normal.push(0,1,0);}
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const i=z*(n+1)+x;indices.push(i,i+n+1,i+1,i+1,i+n+1,i+n+2);}
 const acc=(array:Float32Array|Uint16Array,type:'VEC3'|'VEC2'|'SCALAR')=>d.createAccessor().setType(type).setArray(array).setBuffer(buffer);
 // Numeric color fixture only; this is not a photo reconstruction or a public asset.
 const image=await sharp({create:{width:64,height:64,channels:3,background:{r:74,g:103,b:82}}}).withExif({IFD0:{Artist:'PRIVATE TEST GPS'}}).png().toBuffer();
 const texture=d.createTexture('PRIVATE filename').setImage(image).setMimeType('image/png');
 const mat=d.createMaterial('PRIVATE location').setBaseColorTexture(texture);
 const prim=d.createPrimitive().setAttribute('POSITION',acc(new Float32Array(pos),'VEC3')).setAttribute('NORMAL',acc(new Float32Array(normal),'VEC3')).setAttribute('TEXCOORD_0',acc(new Float32Array(uv),'VEC2')).setIndices(acc(new Uint16Array(indices),'SCALAR')).setMaterial(mat);
 const mesh=d.createMesh('PRIVATE mesh').addPrimitive(prim),node=d.createNode('PRIVATE name').setMesh(mesh).setExtras({GPS:'PRIVATE location'});
 const scene=d.createScene().addChild(node);d.getRoot().setDefaultScene(scene);
 const bytes=Buffer.from(await new NodeIO().writeBinary(d));await writeFile(join(path,'source.glb'),bytes);
 const config={schemaVersion:1,processingApproved:true,permissionReference:'synthetic test only',input:'source.glb',sourceSHA256:hash(bytes),coordinateFrame:'local-east-up-south-metres',lighting:'baked-photographic',reference:{projectedCRS:'EPSG:32632',verticalDatum:'unknown',originEasting:546280,originNorthing:5074440,originElevation:400}};
 await writeFile(join(path,'job.json'),JSON.stringify(config));return {bytes,config};
}
describe('private reconstructed-mesh preparation',()=>{
 it('exports validated bounded LODs, preserves coordinates and strips private metadata; no runtime approval',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'mesh-test-'));
  try{
   const {bytes}=await fixture(dir),out=join(dir,'export');const r=await prepareMesh(join(dir,'job.json'),out);
   expect(r.runtimeEligible).toBe(false);expect(r.redistributionApproved).toBe(false);expect(r.alignment.accepted).toBe(false);
   expect(r.levels).toHaveLength(4);expect(r.levels[2].triangles).toBeLessThan(r.input.triangles);
   for(const level of r.levels){
    expect(level.validator.errors).toBe(0);expect(level.bounds).toEqual(r.input.bounds);
    const blob=await readFile(join(out,level.url));expect(hash(blob)).toBe(level.sha256);
    expect(JSON.stringify(embeddedGLB(blob))).not.toContain('PRIVATE');
    const document=await new NodeIO().registerExtensions([KHRMaterialsUnlit]).readBinary(blob);
    for(const t of document.getRoot().listTextures()){
     const meta=await sharp(Buffer.from(t.getImage()!)).metadata();expect(meta.exif).toBeUndefined();expect(meta.xmp).toBeUndefined();
    }
   }
   expect(r.levels[3].textures).toBe(0);expect(await readFile(join(dir,'source.glb'))).toEqual(bytes);
   await expect(prepareMesh(join(dir,'job.json'),out)).rejects.toThrow('already exists');
  }finally{await rm(dir,{recursive:true,force:true});}
 });
 it('rejects unapproved, altered, external or repository-bound input/output',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'mesh-test-'));
  try{
   const {config}=await fixture(dir);
   await writeFile(join(dir,'job.json'),JSON.stringify({...config,processingApproved:false}));
   await expect(prepareMesh(join(dir,'job.json'),join(dir,'out'))).rejects.toThrow('authorization');
   await writeFile(join(dir,'job.json'),JSON.stringify({...config,sourceSHA256:'0'.repeat(64)}));
   await expect(prepareMesh(join(dir,'job.json'),join(dir,'out'))).rejects.toThrow('checksum');
   await expect(access(join(dir,'out'))).rejects.toThrow();
   await expect(privatePath(process.cwd()+'/public/new-photos')).rejects.toThrow('outside');
   await symlink(process.cwd(),join(dir,'repo-link'));await expect(privatePath(join(dir,'repo-link/new-export'))).rejects.toThrow('outside');
   const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},scenes:[{}],images:[{uri:'https://example.invalid/private.jpg'}]}));
   const blob=Buffer.alloc(20+json.length);blob.writeUInt32LE(0x46546c67,0);blob.writeUInt32LE(2,4);blob.writeUInt32LE(blob.length,8);blob.writeUInt32LE(json.length,12);blob.writeUInt32LE(0x4e4f534a,16);json.copy(blob,20);
   expect(()=>embeddedGLB(blob)).toThrow('external');
  }finally{await rm(dir,{recursive:true,force:true});}
 });
});
