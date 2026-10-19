import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { buildingWalls } from "../src/geo/building-visuals";
import { GeographicTerrain, type Building } from "../src/geo/sector";
import { validateHeightRelease, withSurveyedHeight } from "../src/geo/building-heights";
import { snapShadowTarget, SUN_DIRECTION } from "../src/core/sunlight";

const read = (name: string) => JSON.parse(readFileSync(`public/geo/brembilla-centro/${name}`, "utf8"));
const terrain = new GeographicTerrain(read("terrain.json"));

it("keeps every OSM footprint and DBGT roof identical to the collision database", () => {
  const buildings: Building[] = read("collision.json").buildings;
  const records = validateHeightRelease(read("dbgt-heights.json"), read("manifest.json"), buildings);
  for (const original of buildings) {
    const b = withSurveyedHeight(original, records), geometry = buildingWalls(b, terrain);
    const p = geometry.getAttribute("position"), uv = geometry.getAttribute("facade");
    const rings = [b.points, ...b.holes];
    expect(p.count).toBe(rings.reduce((n, ring) => n + ring.length * 4, 0));
    for (let i = 0; i < p.count; i += 4) {
      expect(p.getY(i + 2)).toBeCloseTo(b.base + b.height, 3);
      expect(p.getY(i)).toBeCloseTo(terrain.heightAt(p.getX(i), p.getZ(i)) - .5, 3);
      expect(uv.getX(i + 1)).toBeCloseTo(Math.hypot(p.getX(i + 1) - p.getX(i), p.getZ(i + 1) - p.getZ(i)), 3);
      expect(uv.getY(i + 2)).toBeCloseTo(b.height, 3);
    }
    geometry.dispose();
  }
});

it("points outer wall normals outwards and courtyard normals into the hole for either winding", () => {
  const square: [number, number][] = [[0,0],[10,0],[10,10],[0,10]];
  const hole: [number, number][] = [[3,3],[7,3],[7,7],[3,7]];
  for (const reverse of [false, true]) {
    const b: Building = { id: "winding", base: 0, height: 10,
      points: reverse ? [...square].reverse() : square, holes: [reverse ? [...hole].reverse() : hole] };
    const geometry = buildingWalls(b, { ...terrain, heightAt: () => 0 });
    const p = geometry.getAttribute("position"), n = geometry.getAttribute("normal");
    for (let i = 0; i < p.count; i += 4) {
      const outward = (p.getX(i) + p.getX(i + 1)) / 2 - 5;
      const southward = (p.getZ(i) + p.getZ(i + 1)) / 2 - 5;
      const dot = outward * n.getX(i) + southward * n.getZ(i);
      expect(dot * (i < 16 ? 1 : -1)).toBeGreaterThan(0);
    }
  }
});

it("stabilises the shadow projection without rotating the light or changing its direction", () => {
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), SUN_DIRECTION).normalize();
  const a = snapShadowTarget(new THREE.Vector3()), b = snapShadowTarget(right.clone().multiplyScalar(.01));
  expect(a.distanceTo(b)).toBeLessThan(1e-6);
  const p = new THREE.Vector3(175, 70, 310), snapped = snapShadowTarget(p);
  expect(snapped.distanceTo(p)).toBeLessThan(.23);
  expect(snapped.dot(SUN_DIRECTION)).toBeCloseTo(p.dot(SUN_DIRECTION), 6);
});
