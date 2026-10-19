// SPDX-License-Identifier: AGPL-3.0-only
import { surfaceGeometry } from "./surfaces";
import { buildingWalls, configureFacade } from "./building-visuals";
import { withSurveyedHeight } from "./building-heights";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  readJSON,
  SECTOR_URL,
  type Sector,
  type SectorTile,
  type TileEntry,
  type Point,
} from "./sector";
import type { Vec3 } from "../core/math";

function distanceToTile(t: TileEntry, p: Vec3) {
  const b = t.bounds;
  return Math.hypot(
    Math.max(b.minX - p.x, 0, p.x - b.maxX),
    Math.max(b.minZ - p.z, 0, p.z - b.maxZ),
  );
}
function shapeOf(points: Point[], holes: Point[][]) {
  const shape = new THREE.Shape(
    points.map(([x, z]) => new THREE.Vector2(x, -z)),
  );
  for (const hole of holes)
    shape.holes.push(
      new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))),
    );
  return shape;
}
/** Bounded visual streaming: two requests, nearest tiles first, no upstream services. */
export class SectorStreamer {
  private loaded = new Map<string, THREE.Group>();
  private wanted: TileEntry[] = [];
  private pending = new Set<string>();
  private failed = new Set<string>();
  private lastRefresh = 0;
  private position: Vec3 = { x: 0, y: 0, z: 0 };
  private materials = {
    walls: new THREE.MeshStandardMaterial({ color: "#c6bba5", roughness: 1 }),
    roofs: new THREE.MeshStandardMaterial({
      color: "#806959",
      roughness: 1,
      side: THREE.DoubleSide,
    }),
    church: new THREE.MeshStandardMaterial({ color: "#dacdb4", roughness: 1 }),
    road: new THREE.MeshStandardMaterial({
      color: "#666968",
      roughness: 1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
    water: new THREE.MeshStandardMaterial({
      color: "#526f77",
      roughness: 0.55,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
  };
  constructor(
    private scene: THREE.Scene,
    readonly sector: Sector,
  ) {
    for (const material of [this.materials.walls, this.materials.church])
      configureFacade(material);
  }

  get readyNearPlayer() {
    return this.sector.manifest.tiles
      .filter((t) => distanceToTile(t, this.position) < 180)
      .every((t) => this.loaded.has(t.id));
  }
  get errors() {
    return this.failed.size;
  }
  get stats() {
    return {
      tiles: this.loaded.size,
      pending: this.pending.size,
      errors: this.errors,
      dbgtHeights: this.sector.heightRecords.size,
      dbgtStatus: this.sector.heightStatus,
    };
  }
  retry() {
    this.failed.clear();
    this.pump();
  }
  update(position: Vec3, now: number, preset: string) {
    this.position = position;
    if (now - this.lastRefresh < 0.5) return;
    this.lastRefresh = now;
    const radius = preset === "eco" ? 850 : preset === "balanced" ? 1100 : 1400;
    const limit = preset === "eco" ? 24 : 32;
    this.wanted = [...this.sector.manifest.tiles]
      .sort((a, b) => distanceToTile(a, position) - distanceToTile(b, position))
      .filter((t) => distanceToTile(t, position) < radius)
      .slice(0, limit);
    const wanted = new Set(this.wanted.map((t) => t.id));
    for (const [id, group] of this.loaded)
      if (!wanted.has(id)) {
        this.dispose(group);
        this.loaded.delete(id);
      }
    this.pump();
  }
  async warmup(position: Vec3) {
    this.position = position;
    // Only the immediately visible village must be ready before takeoff.
    const tiles = this.sector.manifest.tiles
      .filter((t) => distanceToTile(t, position) < 450)
      .sort(
        (a, b) => distanceToTile(a, position) - distanceToTile(b, position),
      );
    this.wanted = tiles;
    for (let i = 0; i < tiles.length; i += 2)
      await Promise.all(tiles.slice(i, i + 2).map((t) => this.load(t)));
    if (tiles.some((t) => this.failed.has(t.id)))
      throw new Error("Il centro del paese non è stato caricato. Riprova.");
  }
  private pump() {
    for (const tile of this.wanted) {
      if (this.pending.size >= 2) return;
      if (
        !this.loaded.has(tile.id) &&
        !this.pending.has(tile.id) &&
        !this.failed.has(tile.id)
      )
        void this.load(tile).finally(() => this.pump());
    }
  }
  private async load(tile: TileEntry) {
    this.pending.add(tile.id);
    try {
      const data = await readJSON<SectorTile>(SECTOR_URL + tile.url);
      if (!this.wanted.some((t) => t.id === tile.id)) return;
      const group = this.build(data);
      this.scene.add(group);
      this.loaded.set(tile.id, group);
    } catch {
      this.failed.add(tile.id);
    } finally {
      this.pending.delete(tile.id);
    }
  }
  private build(data: SectorTile) {
    const group = new THREE.Group();
    const walls: THREE.BufferGeometry[] = [],
      roofs: THREE.BufferGeometry[] = [],
      church: THREE.BufferGeometry[] = [];
    for (const original of data.buildings) {
      const b = withSurveyedHeight(original, this.sector.heightRecords);
      const roof = new THREE.ShapeGeometry(shapeOf(b.points, b.holes));
      roof.rotateX(-Math.PI / 2);
      roof.translate(0, b.base + b.height, 0);
      roofs.push(roof);
      const geo = buildingWalls(b, this.sector.terrain);
      (b.kind === "church" ? church : walls).push(geo);
    }
    const addMerged = (
      geometries: THREE.BufferGeometry[],
      mat: THREE.Material,
    ) => {
      if (!geometries.length) return;
      const merged = mergeGeometries(geometries);
      geometries.forEach((g) => g.dispose());
      if (merged) {
        const mesh = new THREE.Mesh(merged, mat);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        group.add(mesh);
      }
    };
    // Preserve visibility from courtyards/inside while normals are consistently outward.
    this.materials.walls.side = this.materials.church.side = THREE.DoubleSide;
    addMerged(walls, this.materials.walls);
    addMerged(roofs, this.materials.roofs);
    addMerged(church, this.materials.church);
    for (const kind of ["road", "water"] as const) {
      const lines = data.lines.filter((l) => l.kind === kind);
      if (lines.length) {
        const mesh = new THREE.Mesh(surfaceGeometry(lines, this.sector.terrain), this.materials[kind]);
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    }
    return group;
  }
  private dispose(group: THREE.Group) {
    this.scene.remove(group);
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}
