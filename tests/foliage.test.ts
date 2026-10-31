import { expect, it } from "vitest";
import { SectorFoliage } from "../src/geo/foliage";
import { materialGrain, DETAIL_TEXTURE_BYTES } from "../src/geo/surface-detail";

it("caps detailed crowns, downgrades Eco and distant flight, and preserves collision inputs", () => {
  const trees=Array.from({length:200},(_,i)=>({position:{x:180+i*.1,y:20,z:300},radius:2,height:10}));
  const original=JSON.stringify(trees), foliage=new SectorFoliage(trees);
  expect(foliage.pilotTrees).toBe(128);
  foliage.update("high",200,300);
  expect(foliage.stats.extraCrownTriangles).toBe(15360);
  foliage.update("eco",200,300);
  expect(foliage.stats.extraCrownTriangles).toBe(0);
  foliage.update("balanced",1500,1500);
  expect(foliage.stats.detailed).toBe(false);
  expect(JSON.stringify(trees)).toBe(original);
});

it("shares one deterministic mipmapped grain texture without growing per tile", () => {
  const first=materialGrain();
  expect(materialGrain()).toBe(first);
  expect(first.image.data.length).toBe(128*128*4);
  expect(DETAIL_TEXTURE_BYTES).toBeLessThan(90_000);
  expect(first.generateMipmaps).toBe(true);
});
