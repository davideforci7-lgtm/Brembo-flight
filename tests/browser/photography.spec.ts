import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const sector = JSON.parse(readFileSync('public/geo/brembilla-centro/manifest.json','utf8'));
// Generated diagnostic square only. It is not a photograph and never ships in public/.
async function testImage(page: import('@playwright/test').Page, size: number) {
  return Buffer.from(await page.evaluate(pixels=>{
    const canvas=document.createElement('canvas'); canvas.width=canvas.height=pixels;
    const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#e02020';ctx.fillRect(0,0,pixels,pixels/2);
    ctx.fillStyle='#2040e0';ctx.fillRect(0,pixels/2,pixels,pixels/2);
    return canvas.toDataURL('image/png').split(',')[1];
  },size),'base64');
}
for (const broken of [false,true]) test(`optional photographic tiles ${broken?'fail safely':'load within mobile/desktop budget'}`,async({page}, info)=>{
  test.setTimeout(90000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const requests:string[]=[];page.on('request',r=>{if(r.url().includes('/photo-test/test-'))requests.push(r.url());});
  const images=new Map<number,Buffer>();
  for(const pixels of [512,1024])images.set(pixels,await testImage(page,pixels));
  const levels=[512,1024].map(pixels=>({pixels,url:`test-${pixels}.png`,bytes:images.get(pixels)!.length,sha256:createHash('sha256').update(images.get(pixels)!).digest('hex')}));
  const manifest={schemaVersion:1,kind:'orthophoto',reference:sector.reference,terrainGridMeters:20,
    credit:{attribution:'SYNTHETIC BROWSER TEST ONLY',sourceURL:'https://example.invalid',license:'CC0-1.0',licenseURL:'https://example.invalid/license',captureDate:'synthetic'},
    tiles:[{id:'test',bounds:{minX:0,minZ:200,maxX:400,maxZ:600},levels}]};
  await page.route('**/geo/brembilla-centro/manifest.json',route=>route.fulfill({json:{...sector,photoManifestURL:'photo-test/manifest.json'}}));
  await page.route('**/photo-test/manifest.json',route=>route.fulfill({json:manifest}));
  await page.route('**/photo-test/test-*.png',route=>{
    const size=route.request().url().includes('512')?512:1024;
    return broken?route.fulfill({status:404,body:'intentional fixture failure'}):route.fulfill({body:images.get(size)!,contentType:'image/png'});
  });
  await page.goto('./');
  await page.locator('#start-button').click();
  await expect(page.locator('#app')).toHaveAttribute('data-photo-status','ready');
  if(broken){
    await expect(page.locator('#app')).toHaveAttribute('data-photo-errors','1');
    await expect(page.locator('#app')).toHaveAttribute('data-photo-tiles','0');
  }else{
    await expect(page.locator('#app')).toHaveAttribute('data-photo-tiles','1');
    await expect(page.locator('#photo-credit')).toBeVisible();
    for (const [preset,pixels] of [['eco',512],['high',1024]] as const) {
      await page.locator('#help-button').click();
      await page.locator('#quality').selectOption(preset);
      await page.locator('#close-help').click();
      await expect.poll(()=>requests.some(url=>url.endsWith(`test-${pixels}.png`))).toBe(true);
      await expect(page.locator('#app')).toHaveAttribute('data-photo-tiles','1');
    }
    await page.screenshot({path:info.outputPath('synthetic-photo-layer.png')});
  }
  await expect(page.locator('#app')).toHaveAttribute('data-status','flying');
  await page.locator('#pause-button').click();
  await expect(page.locator('#app')).toHaveAttribute('data-status','paused');
  expect(errors).toEqual([]);
});
