// Genuine production-build comparison. Only browser instrumentation; no game hooks,
// teleportation, substituted imagery or synthetic photorealistic textures.
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
const out=resolve(process.argv[2]||'docs/reality-captures');
const urls=[process.argv[3]||'http://127.0.0.1:4174/Brembo-flight/',process.argv[4]||'http://127.0.0.1:4173/Brembo-flight/'];
const labels=(process.env.BREMBO_CAPTURE_LABELS||'pr3,reality-engine').split(',');
const preset=process.env.BREMBO_CAPTURE_PRESET||'high';
const viewport=process.env.BREMBO_CAPTURE_MOBILE ? {width:375,height:629} : {width:1280,height:720};
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BREMBO_CHROMIUM_EXECUTABLE||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-zygote','--disable-dev-shm-usage']});
const reports=[];
const servers=[];
if(process.env.BREMBO_BASELINE_DIR){
 for(const [dir,port] of [[process.env.BREMBO_BASELINE_DIR,4174],[process.cwd(),4173]]){
  const proc=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:dir,stdio:'ignore'});
  servers.push(proc);
 }
 for(const url of urls){
  let ready=false;
  for(let n=0;n<50;n++){try{ready=(await fetch(url)).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,100));}
  if(!ready){servers.forEach(p=>p.kill());await browser.close();throw Error('Preview server unavailable');}
 }
}
try{
 for(const [i,url] of urls.entries()){
  const label=labels[i];
  const context=await browser.newContext({viewport,deviceScaleFactor:process.env.BREMBO_CAPTURE_MOBILE?3:1});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.addInitScript(({preset})=>{
   localStorage.setItem('brembo-settings-v2',JSON.stringify({quality:preset,muted:true}));
   const capture=window.__realityCapture={frames:0,frozen:false,viewMatrix:[],projectionMatrix:[]};
   const proto=WebGL2RenderingContext.prototype, names=new WeakMap();
   const get=proto.getUniformLocation,set=proto.uniformMatrix4fv;
   proto.getUniformLocation=function(p,n){const l=get.call(this,p,n);if(l)names.set(l,n);return l;};
   proto.uniformMatrix4fv=function(l,t,v,...rest){const n=names.get(l);if(n==='viewMatrix'||n==='projectionMatrix')capture[n]=Array.from(v);return set.call(this,l,t,v,...rest);};
   let axes=[0,0,0,0],stamp=performance.now();
   Object.defineProperty(navigator,'getGamepads',{value:()=>[{id:'Capture standard pad',index:0,mapping:'standard',connected:true,axes,buttons:Array.from({length:17},()=>({pressed:false,value:0}))}]});
   const raf=requestAnimationFrame.bind(window);
   window.requestAnimationFrame=callback=>raf(()=>{
    if(capture.frozen)return;
    stamp=Math.max(stamp+100,performance.now());
    if(document.querySelector('#app')?.getAttribute('data-status')==='flying'){
     capture.frames++;axes=[0,0,0,capture.frames<=40?-.824:0];
    }
    callback(stamp);
    if(capture.frames===100)capture.frozen=true;
   });
  },{preset});
  await page.goto(url);
  await page.locator('#start-button').waitFor({timeout:60000});
  const readyMs=await page.evaluate(()=>performance.now());
  await page.waitForFunction(()=>document.querySelector('#app')?.getAttribute('data-controller')==='ready',null,{polling:100});
  await page.locator('#flight-profile').selectOption('tranquil');
  await page.locator('#activity').selectOption('explore');
  await page.locator('#start-button').click();
  await page.waitForFunction(()=>window.__realityCapture?.frozen,null,{timeout:120000,polling:100});
  await page.screenshot({path:out+'/'+label+'.png'});
  const capture=await page.evaluate(()=>({ ...window.__realityCapture,
   resources:performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,bytes:r.encodedBodySize,durationMs:r.duration})),
   dbgt:document.querySelector('#app').getAttribute('data-dbgt-heights')}));
  await page.locator('#help-button').click();
  const downloaded=page.waitForEvent('download');await page.locator('#export-test').click();
  const download=await downloaded;const diag=JSON.parse(await readFile(await download.path(),'utf8'));
  // The clock was accelerated for deterministic positions; its FPS value is invalid.
  delete diag.graphics.fps;
  reports.push({label,url,readyMs,errors,capture,graphics:diag.graphics,viewport:diag.viewport,
    note:'Linux Chromium/SwiftShader, 100 fixed 0.1 s input frames; FPS deliberately omitted. Local cold-cache timings, not phone/network benchmarks.'});
  await context.close();
 }
 if(reports.some(r=>r.errors.length))throw Error('Page errors during capture');
 for(const matrix of ['viewMatrix','projectionMatrix']){
  const a=reports[0].capture[matrix],b=reports[1].capture[matrix];
  if(a.length!==16||b.length!==16||a.some((v,i)=>Math.abs(v-b[i])>1e-5))throw Error('Camera mismatch: '+matrix);
 }
 await writeFile(out+'/comparison.json',JSON.stringify({cameraMatched:true,reports},null,2)+'\n');
 console.log(JSON.stringify(reports.map(r=>({label:r.label,readyMs:r.readyMs,graphics:r.graphics,resourceBytes:r.capture.resources.reduce((a,b)=>a+b.bytes,0)})),null,2));
}finally{await browser.close();servers.forEach(p=>p.kill());}
