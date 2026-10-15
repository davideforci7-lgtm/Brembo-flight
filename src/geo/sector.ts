// SPDX-License-Identifier: AGPL-3.0-only
import {
  DemoTerrain,
  type Obstacle,
  type TerrainProvider,
} from "../core/terrain";
import { clamp, seededRandom, type Vec3 } from "../core/math";
import type { Checkpoint } from "../core/course";
import type { FlightEnvironment } from "../core/flight";

export type Point = [number, number];
export interface Building {
  id: string;
  points: Point[];
  holes: Point[][];
  base: number;
  height: number;
  kind?: string;
  name?: string;
  heightBasis?: string;
}
export interface MapLine {
  id: string;
  kind: "road" | "water";
  class: string;
  name: string;
  width: number;
  bridge: boolean;
  points: Point[];
}
export interface SectorTile {
  buildings: Building[];
  lines: MapLine[];
  land: { id: string; kind: string; points: Point[]; holes: Point[][] }[];
}
export interface TileEntry {
  id: string;
  url: string;
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
}
export interface SectorManifest {
  id: string;
  title: string;
  size: number;
  limit: number;
  terrainURL: string;
  /** Optional approved orthophoto release; absent in the shipped sector. */
  photoManifestURL?: string;
  tiles: TileEntry[];
  places: { id: string; name: string; x: number; z: number }[];
  reference: {
    originElevation: number;
    originEasting: number;
    originNorthing: number;
    projectedCRS: string;
    verticalDatum: string;
  };
}
export interface TerrainData {
  size: number;
  segments: number;
  heightScale: number;
  heights: number[];
  cover: number[];
}
export const SECTOR_URL = `${import.meta.env?.BASE_URL ?? "/Brembo-flight/"}geo/brembilla-centro/`;
export async function readJSON<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: signal ?? controller.signal });
    if (!response.ok)
      throw new Error(`Dati del settore non disponibili (${response.status})`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
export class GeographicTerrain implements TerrainProvider {
  readonly geographic = true;
  readonly size: number;
  readonly segments: number;
  readonly heights: Float32Array;
  readonly cover: Uint8Array;
  readonly provenance = {
    id: "brembilla-centro-2026-10",
    kind: "surveyed-terrain",
    description: "TINITALY 1.1 / OSM; volumi e vegetazione illustrativi",
  };
  constructor(data: TerrainData) {
    if (
      data.size !== 4000 ||
      data.segments !== 200 ||
      data.heights.length !== 201 ** 2 ||
      data.cover.length !== 201 ** 2 ||
      data.heights.some((h) => !Number.isFinite(h) || h < -1000 || h > 20000)
    )
      throw new Error("Griglia geografica non valida");
    this.size = data.size;
    this.segments = data.segments;
    this.heights = Float32Array.from(data.heights, (h) => h * data.heightScale);
    this.cover = Uint8Array.from(data.cover);
  }
  heightAt(x: number, z: number) {
    return DemoTerrain.prototype.heightAt.call(this, x, z);
  }
  waterAt() {
    return -Infinity;
  }
  coverAt(x: number, z: number) {
    const i = Math.round(
      clamp((x / this.size + 0.5) * this.segments, 0, this.segments),
    );
    const j = Math.round(
      clamp((z / this.size + 0.5) * this.segments, 0, this.segments),
    );
    return this.cover[j * (this.segments + 1) + i];
  }
}
export function pointInRing(x: number, z: number, points: readonly Point[]) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, az] = points[i],
      [bx, bz] = points[j];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax)
      inside = !inside;
  }
  return inside;
}
export function buildingContains(
  b: Building,
  x: number,
  z: number,
  radius = 0,
) {
  if (pointInRing(x, z, b.points) && !b.holes.some((h) => pointInRing(x, z, h)))
    return true;
  if (radius <= 0) return false;
  for (const ring of [b.points, ...b.holes])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        c = ring[(i + 1) % ring.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1];
      const t = clamp(
        ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1),
        0,
        1,
      );
      if (Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) <= radius)
        return true;
    }
  return false;
}
/** Complete lightweight collision database is loaded before takeoff, independently of visual streaming. */
export class BuildingIndex {
  private cells = new Map<string, Building[]>();
  constructor(readonly buildings: Building[]) {
    for (const b of buildings) {
      const xs = b.points.map((p) => p[0]),
        zs = b.points.map((p) => p[1]);
      for (
        let x = Math.floor((Math.min(...xs) - 1) / 100);
        x <= Math.floor((Math.max(...xs) + 1) / 100);
        x++
      )
        for (
          let z = Math.floor((Math.min(...zs) - 1) / 100);
          z <= Math.floor((Math.max(...zs) + 1) / 100);
          z++
        ) {
          const key = `${x},${z}`,
            bucket = this.cells.get(key) ?? [];
          bucket.push(b);
          this.cells.set(key, bucket);
        }
    }
  }
  at(x: number, z: number) {
    return (
      this.cells.get(`${Math.floor(x / 100)},${Math.floor(z / 100)}`) ?? []
    );
  }
  hit(position: Vec3, radius = 0.65) {
    return this.at(position.x, position.z).find(
      (b) =>
        position.y - radius <= b.base + b.height &&
        buildingContains(b, position.x, position.z, radius),
    );
  }
}
export interface Sector {
  manifest: SectorManifest;
  terrain: GeographicTerrain;
  buildings: BuildingIndex;
  trees: Obstacle[];
  course: Checkpoint[];
  environment: FlightEnvironment;
}
export function sectorEnvironment(terrain: TerrainProvider): FlightEnvironment {
  return {
    spawn: { x: 175, z: 410, y: terrain.heightAt(175, 410) + 42 },
    yaw: 0,
    limit: 1750,
    ceiling: 1150,
  };
}
export function sectorCourse(terrain: TerrainProvider): Checkpoint[] {
  // Designed aerial gameplay route, not an actual regulated flight route.
  const points: [number, number, string][] = [
    [175, 330, "Il centro"],
    [125, 180, "Sopra il Brembilla"],
    [30, 25, "Brembilla"],
    [-90, -130, "Risalendo la valle"],
    [-210, -300, "La curva"],
    [-320, -480, "Verso Cadelfoglia"],
    [-420, -650, "Il paese dall’alto"],
    [-470, -800, "Cadelfoglia"],
  ];
  let previous = sectorEnvironment(terrain).spawn;
  const launchHeight = previous.y;
  return points.map(([x, z, label], i) => {
    const position = {
      x,
      y: Math.max(launchHeight, terrain.heightAt(x, z) + 48 + i * 2),
      z,
    };
    const dx = x - previous.x,
      dz = z - previous.z,
      len = Math.hypot(dx, dz);
    previous = position;
    return {
      position,
      normal: { x: dx / len, y: 0, z: dz / len },
      radius: 12,
      label,
    };
  });
}
export async function loadSector(): Promise<Sector> {
  const [manifest, data, collision] = await Promise.all([
    readJSON<SectorManifest>(`${SECTOR_URL}manifest.json`),
    readJSON<TerrainData>(`${SECTOR_URL}terrain.json`),
    readJSON<{ buildings: Building[] }>(`${SECTOR_URL}collision.json`),
  ]);
  const terrain = new GeographicTerrain(data),
    buildings = new BuildingIndex(collision.buildings);
  return {
    manifest,
    terrain,
    buildings,
    trees: createGeographicTrees(terrain, buildings),
    course: sectorCourse(terrain),
    environment: sectorEnvironment(terrain),
  };
}
export function createGeographicTrees(
  terrain: GeographicTerrain,
  buildings: BuildingIndex,
) {
  const rand = seededRandom(20261014),
    trees: Obstacle[] = [];
  // Illustrative trees only inside OSM forest/wood polygons. Keep settlement footprints clear.
  for (let i = 0; i < 9500 && trees.length < 1600; i++) {
    const x = (rand() - 0.5) * 3700,
      z = (rand() - 0.5) * 3700;
    if (
      terrain.coverAt(x, z) !== 1 ||
      buildings.at(x, z).some((b) => buildingContains(b, x, z, 5))
    )
      continue;
    const height = 6 + rand() * 8;
    trees.push({
      position: { x, y: terrain.heightAt(x, z), z },
      radius: height * 0.2,
      height,
    });
  }
  return trees;
}
