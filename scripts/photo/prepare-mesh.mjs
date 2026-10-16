// SPDX-License-Identifier: AGPL-3.0-only
// Private offline preparation of an ALREADY reconstructed, locally registered GLB.
// Does not run SfM, infer a datum, publish assets or activate models in the game.
import { readFile, writeFile, stat, realpath, mkdir, mkdtemp, rename, rm, access } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { NodeIO, Logger } from '@gltf-transform/core';
import { KHRMaterialsUnlit, KHRTextureTransform } from '@gltf-transform/extensions';
import { weld, simplify, prune, unlit, getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import validator from 'gltf-validator';
import sharp from 'sharp';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const HASH=data=>createHash('sha256').update(data).digest('hex');
const io=()=>new NodeIO().registerExtensions([KHRMaterialsUnlit,KHRTextureTransform]);
export const MESH_LEVELS=[
  {id:'high',triangles:100000,texture:2048,error:.001,bytes:16_000_000},
  {id:'medium',triangles:30000,texture:1024,error:.002,bytes:8_000_000},
  {id:'far',triangles:5000,texture:512,error:.005,bytes:2_000_000},
  {id:'collision-candidate',triangles:2000,texture:0,error:.01,bytes:1_000_000},
];
async function resolvedPath(path){
  try{return await realpath(path);}catch(e){if(e.code!=='ENOENT')throw e;const parent=dirname(path);if(parent===path)throw e;return resolve(await resolvedPath(parent),relative(parent,path));}
}
export async function privatePath(path){
  const p=await resolvedPath(resolve(path)), root=await realpath(ROOT), r=relative(root,p);
  if(!r||(r!=='..'&&!r.startsWith('..'+(process.platform==='win32'?'\\':'/'))&&!isAbsolute(r)))throw Error('Private inputs and outputs must stay outside repository');
  return p;
}
export function embeddedGLB(bytes){
  if(bytes.length<20||bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length||bytes.readUInt32LE(16)!==0x4e4f534a)throw Error('Valid binary glTF 2 container required');
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
  if([...(json.buffers||[]),...(json.images||[])].some(x=>x.uri))throw Error('Embedded GLB only; external/data URIs forbidden');
  if((json.animations||[]).length||(json.skins||[]).length||(json.cameras||[]).length)throw Error('Static reconstructed mesh required');
  if((json.scenes||[]).length!==1)throw Error('One explicit scene required');
  const allowed=new Set(['KHR_materials_unlit','KHR_texture_transform']);
  if((json.extensionsUsed||[]).some(e=>!allowed.has(e)))throw Error('Unsupported extension; decode/review source offline first');
  return json;
}
async function validate(bytes){
  const r=await validator.validateBytes(new Uint8Array(bytes),{maxIssues:100,externalResourceFunction:()=>Promise.reject(Error('External resource forbidden'))});
  if(r.issues.numErrors)throw Error(`glTF validation failed: ${r.issues.numErrors} error(s): ${r.issues.messages.filter(m=>m.severity===0).slice(0,3).map(m=>m.code).join(', ')}`);
  return r;
}
function stats(doc){
  const root=doc.getRoot(),scene=root.getDefaultScene()||root.listScenes()[0];
  let triangles=0,draws=0;
  scene.traverse(node=>{for(const p of node.getMesh()?.listPrimitives()||[]){
    if(p.getMode()!==4||!p.getAttribute('POSITION'))throw Error('Triangle meshes with positions required');
    triangles+=(p.getIndices()?.getCount()||p.getAttribute('POSITION').getCount())/3;draws++;
  }});
  const bounds=getBounds(scene);
  if(!triangles||!Number.isInteger(triangles)||[...bounds.min,...bounds.max].some(n=>!Number.isFinite(n)))throw Error('Empty/nonfinite mesh');
  return {triangles,draws,bounds,textures:root.listTextures().length};
}
function stripMetadata(value){
  if(!value||typeof value!=='object')return;
  if(Array.isArray(value)){value.forEach(stripMetadata);return;}
  delete value.extras;delete value.name;
  for(const v of Object.values(value))stripMetadata(v);
}
async function alignment(config,base,inputHash){
  if(!config.alignmentReport)return {accepted:false,reason:'Independent GIS/vertical alignment not provided'};
  const p=await privatePath(resolve(base,config.alignmentReport)),data=await readFile(p),r=JSON.parse(data);
  if(config.alignmentSHA256!==HASH(data)||r.assetSHA256!==inputHash)throw Error('Alignment checksum does not match source');
  const ref=config.reference;
  const accepted=r.horizontalAccepted===true&&r.verticalAccepted===true&&r.checkCount>=3&&r.targetCRS===ref.projectedCRS&&
    typeof ref.verticalDatum==='string'&&!/unknown|unspecified/i.test(ref.verticalDatum)&&r.targetVerticalDatum===ref.verticalDatum;
  return {accepted,reportSHA256:HASH(data),reason:accepted?'Accepted independent checks; distribution still unauthorized':'CRS/datum or independent XY/Z checks incomplete'};
}
export async function prepareMesh(configFile,outputDir){
  const configPath=await privatePath(configFile),output=await privatePath(outputDir),configData=await readFile(configPath),config=JSON.parse(configData);
  if(config.schemaVersion!==1||config.processingApproved!==true||typeof config.permissionReference!=='string'||!config.permissionReference.trim())throw Error('Private processing authorization/evidence required');
  if(config.coordinateFrame!=='local-east-up-south-metres'||config.lighting!=='baked-photographic')throw Error('Explicit local axes/metres and photographic baked lighting required');
  const reference=config.reference;
  if(!reference||reference.projectedCRS!=='EPSG:32632'||reference.originEasting!==546280||reference.originNorthing!==5074440||reference.originElevation!==400||typeof reference.verticalDatum!=='string')throw Error('Explicit existing sector reference required');
  const input=await privatePath(resolve(dirname(configPath),config.input));
  if((await stat(input)).size>100_000_000)throw Error('Split source into chunks below 100 MB before preparing');
  const bytes=await readFile(input),hash=HASH(bytes);if(config.sourceSHA256!==hash)throw Error('Source checksum mismatch');
  embeddedGLB(bytes);const inputValidation=await validate(bytes),original=await io().readBinary(bytes),originalStats=stats(original);
  if(originalStats.triangles>2_000_000||originalStats.draws>8||originalStats.textures>4)throw Error('Split/atlas source first: maximum 2M triangles, 8 draws and 4 textures per chunk');
  if([...originalStats.bounds.min,...originalStats.bounds.max].some(n=>Math.abs(n)>2500))throw Error('Coordinates not local sector metres; no automatic recentering');
  for(const material of original.getRoot().listMaterials())
    if(!material.getBaseColorTexture())throw Error('Every reconstructed material needs an actual source base-color texture');
  const alignmentResult=await alignment(config,dirname(configPath),hash);
  try{await access(output);throw Error('Output already exists');}catch(e){if(e.code!=='ENOENT')throw e;}
  await mkdir(dirname(output),{recursive:true});const temp=await mkdtemp(join(dirname(output),'.mesh-review-'));
  await MeshoptSimplifier.ready;
  const levels=[];
  try{
    for(const level of MESH_LEVELS){
      const doc=await io().readBinary(bytes);doc.setLogger(new Logger(Logger.Verbosity.SILENT));
      await doc.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:Math.min(1,level.triangles/originalStats.triangles),error:level.error,lockBorder:true}));
      if(level.texture){
        await doc.transform(unlit());
        for(const texture of doc.getRoot().listTextures()){
          const data=texture.getImage();if(!data)throw Error('Missing embedded texture');
          const image=sharp(Buffer.from(data),{limitInputPixels:64_000_000});
          const meta=await image.metadata();
          if(!['jpeg','png'].includes(meta.format)||!meta.width||!meta.height)throw Error('Source textures must be ordinary embedded JPEG/PNG');
          // Re-encode real source pixels; strip EXIF/XMP/ICC. No generated detail,
          // automatic rotation, upscaling, relighting or extra baked shadows.
          const resized=image.resize({width:level.texture,height:level.texture,fit:'inside',withoutEnlargement:true}).toColourspace('srgb');
          const encoded=meta.hasAlpha?await resized.png().toBuffer():await resized.jpeg({quality:90}).toBuffer();
          texture.setImage(encoded).setMimeType(meta.hasAlpha?'image/png':'image/jpeg');
        }
      }else{
        for(const mesh of doc.getRoot().listMeshes())for(const p of mesh.listPrimitives()){
          p.setMaterial(null);p.setAttribute('TEXCOORD_0',null);p.setAttribute('TEXCOORD_1',null);
        }
        for(const material of doc.getRoot().listMaterials())material.dispose();
      }
      await doc.transform(prune());
      const json=await io().writeJSON(doc);stripMetadata(json.json);json.json.asset.generator='BREMBO FLIGHT private mesh preparation';
      const clean=await io().readJSON(json),s=stats(clean);
      if(s.triangles>level.triangles)throw Error(`${level.id} remains over triangle budget; split/review source rather than relaxing error limits`);
      const buffer=Buffer.from(await io().writeBinary(clean)),validation=await validate(buffer);
      if(buffer.length>level.bytes)throw Error(`${level.id} exceeds byte budget; split/review the chunk`);
      const textureSizes=[];
      for(const t of clean.getRoot().listTextures()){
        const m=await sharp(Buffer.from(t.getImage())).metadata();
        if(m.exif||m.xmp||m.iptc)throw Error('Embedded texture metadata not stripped');
        textureSizes.push([m.width,m.height]);
      }
      const name=level.id+'.glb';await writeFile(join(temp,name),buffer,{flag:'wx'});
      levels.push({id:level.id,url:name,sha256:HASH(buffer),bytes:buffer.length,...s,textureSizes,
        estimatedTextureBytesWithMipmaps:textureSizes.reduce((sum,[w,h])=>sum+Math.ceil(w*h*4*4/3),0),
        simplification:{relativeErrorLimit:level.error,lockBorder:true},validator:{errors:validation.issues.numErrors,warnings:validation.issues.numWarnings,messages:validation.issues.messages}});
    }
    const manifest={schemaVersion:1,kind:'private-photogrammetry-review',private:true,redistributionApproved:false,runtimeEligible:false,
      sourceSHA256:hash,configSHA256:HASH(configData),reference,coordinateFrame:config.coordinateFrame,
      alignment:alignmentResult,input:{...originalStats,bytes:bytes.length,validatorErrors:inputValidation.issues.numErrors},levels,
      tools:{gltfTransform:'4.5.1',meshoptimizer:'1.3.0',sharp:sharp.versions,validator:validator.version()},
      notes:['Derived from supplied texture pixels; no invented photography. Photographic authenticity must be reviewed by the operator.',
             'LOD is lossy. Inspect UV seams, silhouette, holes and facade/roof alignment before use.',
             'Collision candidate is untextured and NOT active: test clearances and compare to independent building/terrain collisions.',
             'Local bounds check is not georeferencing. Unknown/incompatible vertical datum blocks GIS acceptance.',
             'No original image or permission evidence is embedded. Private export is not permission to redistribute or publish.']};
    await writeFile(join(temp,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
    await rename(temp,output);return manifest;
  }catch(e){await rm(temp,{recursive:true,force:true});throw e;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{if(process.argv.length!==4)throw Error('Usage: node scripts/photo/prepare-mesh.mjs /private/job.json /private/new-export');
    const r=await prepareMesh(process.argv[2],process.argv[3]);console.log(JSON.stringify({private:true,runtimeEligible:false,levels:r.levels.map(l=>({id:l.id,triangles:l.triangles,bytes:l.bytes}))},null,2));
  }catch(e){console.error(e.message);process.exitCode=2;}
}
