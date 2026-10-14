import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import {
  GeographicTerrain,
  createGeographicTrees,
  BuildingIndex,
  buildingContains,
  sectorCourse,
  sectorEnvironment,
  type TerrainData,
  type Building,
  type SectorManifest,
} from "../src/geo/sector";
import { FlightSimulation, neutralInput } from "../src/core/flight";
import { DemoTerrain, createTrees } from "../src/core/terrain";
import { createCourse } from "../src/core/course";
import { clamp } from "../src/core/math";
import { nearestPOI } from "../src/geo/poi";
const root = "public/geo/brembilla-centro/";
const read = <T>(name: string): T =>
  JSON.parse(readFileSync(root + name, "utf8"));
const terrain = new GeographicTerrain(read<TerrainData>("terrain.json"));
const index = new BuildingIndex(
  read<{ buildings: Building[] }>("collision.json").buildings,
);
const env = sectorEnvironment(terrain);

describe("real geographic sector, data integrity and gameplay", () => {
  it("has real metric extents, finite nonflat elevation and bounded packaged data", () => {
    const manifest = read<SectorManifest>("manifest.json");
    expect(manifest.reference.projectedCRS).toBe("EPSG:32632");
    expect(terrain.heightAt(0, 0) + 400).toBeCloseTo(435.8, 0);
    expect(
      Math.max(...terrain.heights) - Math.min(...terrain.heights),
    ).toBeGreaterThan(900);
    expect(terrain.cover.filter((v) => v === 1).length).toBeGreaterThan(8000);
    expect(index.buildings.length).toBeGreaterThan(1500);
    let bytes = 0;
    for (const entry of manifest.tiles) {
      expect(entry.url).toMatch(/^tiles\/[0-7]-[0-7]\.json$/);
      const data = read<{ buildings: Building[] }>(entry.url);
      bytes += statSync(root + entry.url).size;
      for (const b of data.buildings)
        expect(b.points.every((p) => p.every(Number.isFinite))).toBe(true);
    }
    expect(bytes).toBeLessThan(2_000_000);
    expect(readdirSync(root + "tiles").length).toBe(manifest.tiles.length);
  });
  it("matches rendered triangles rather than a different bilinear collision surface", () => {
    const n = 201,
      i = 100 * n + 100,
      a = terrain.heights[i],
      b = terrain.heights[i + 1],
      c = terrain.heights[i + n];
    expect(terrain.heightAt(5, 5)).toBeCloseTo(
      a + 0.25 * (b - a) + 0.25 * (c - a),
      4,
    );
  });
  it("rejects incomplete terrain instead of presenting an invented fallback as real", () => {
    expect(
      () =>
        new GeographicTerrain({
          ...read<TerrainData>("terrain.json"),
          heights: [1],
        }),
    ).toThrow();
  });
  it("keeps known church footprints at the positions used for cultural cards", () => {
    const church = index.buildings.find((b) => b.id === "way/127912869")!;
    expect(buildingContains(church, 198.9, 295.65)).toBe(true);
    expect(nearestPOI(env.spawn)?.id).toBe("san-giovanni");
    expect(nearestPOI({ x: 1700, y: 0, z: -1700 })).toBeUndefined();
  });
  it("respects building courtyards and finds collisions independent of streamed visuals", () => {
    const b: Building = {
      id: "test",
      base: 0,
      height: 10,
      points: [
        [0, 0],
        [20, 0],
        [20, 20],
        [0, 20],
      ],
      holes: [
        [
          [5, 5],
          [15, 5],
          [15, 15],
          [5, 15],
        ],
      ],
    };
    const spatial = new BuildingIndex([b]);
    expect(spatial.hit({ x: 2, y: 5, z: 2 })).toBe(b);
    expect(spatial.hit({ x: 10, y: 5, z: 10 })).toBeUndefined();
    expect(spatial.hit({ x: 2, y: 12, z: 2 })).toBeUndefined();
  });
  it("completes all eight real-sector gates through simulated inputs, without teleporting", () => {
    const course = sectorCourse(terrain),
      flight = new FlightSimulation(
        terrain,
        course,
        createGeographicTrees(terrain, index),
        env,
        index,
      );
    flight.start();
    for (let i = 0; i < 18000 && flight.status === "flying"; i++) {
      const gate = course[flight.nextCheckpoint];
      flight.update(1 / 60, {
        ...neutralInput(),
        right: clamp(
          (gate.position.x + gate.normal.x * 7 - flight.position.x) * 0.15,
          -0.8,
          0.8,
        ),
        forward: clamp(
          -(gate.position.z + gate.normal.z * 7 - flight.position.z) * 0.15,
          -0.8,
          0.8,
        ),
        up: clamp((gate.position.y - flight.position.y) * 0.3, -0.8, 0.8),
      });
    }
    expect(flight.status, flight.crashReason).toBe("finished");
    expect(flight.nextCheckpoint).toBe(8);
  });
});
describe("optional tranquil flight; Sport regression remains covered by the original suite", () => {
  const make = () =>
    new FlightSimulation(
      new DemoTerrain(),
      createCourse(new DemoTerrain()),
      createTrees(new DemoTerrain()),
    );
  it("uses the same world, limits speed and ignores boost in tranquil mode", () => {
    const f = make();
    f.profile = "tranquil";
    f.mode = "explore";
    f.start();
    for (let i = 0; i < 180; i++)
      f.update(1 / 60, { ...neutralInput(), forward: 1, boost: true });
    expect(f.speed).toBeCloseTo(10, 1);
    expect(f.status).toBe("flying");
  });
  it("maintains clearance on descent and preserves altitude when sticks are released", () => {
    const f = make();
    f.profile = "tranquil";
    f.mode = "explore";
    f.start();
    for (let i = 0; i < 300; i++)
      f.update(1 / 60, { ...neutralInput(), up: -1 });
    expect(f.altitude).toBeGreaterThanOrEqual(4.99);
    expect(f.crashes).toBe(0);
    const altitude = f.position.y;
    for (let i = 0; i < 60; i++) f.update(1 / 60, neutralInput());
    expect(f.position.y).toBeCloseTo(altitude, 3);
  });
  it("stops at buildings in tranquil and collides in Sport", () => {
    for (const profile of ["tranquil", "sport"] as const) {
      const f = new FlightSimulation(terrain, sectorCourse(terrain), [], env, {
        hit: () => true,
      });
      f.profile = profile;
      f.start();
      f.update(0.1, { ...neutralInput(), forward: 1 });
      expect(f.status).toBe(profile === "sport" ? "crashed" : "flying");
      if (profile === "tranquil") expect(f.position).toEqual(env.spawn);
    }
  });
});
