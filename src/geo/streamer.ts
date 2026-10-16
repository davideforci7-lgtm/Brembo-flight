// SPDX-License-Identifier: AGPL-3.0-only
import { withSurveyedHeight } from "./building-heights";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  readJSON,
  SECTOR_URL,
  type Sector,
  type SectorTile,
  type MapLine,
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
function ribbons(lines: MapLine[], sector: Sector) {
  const positions: number[] = [],
    indices: number[] = [];
  for (const line of lines) {
    const start = positions.length / 3;
    for (let i = 0; i < line.points.length; i++) {
      const [x, z] = line.points[i],
        a = line.points[Math.max(0, i - 1)],
        b = line.points[Math.min(line.points.length - 1, i + 1)];
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz) || 1;
      const half = line.width / 2;
      for (const side of [-1, 1]) {
        const vx = x + (dz / len) * half * side,
          vz = z - (dx / len) * half * side;
        const offset = line.kind === "water" ? 0.36 : line.bridge ? 2 : 0.24;
        positions.push(vx, sector.terrain.heightAt(vx, vz) + offset, vz);
      }
      if (i > 0) {
        const n = start + i * 2;
        indices.push(n - 2, n, n - 1, n - 1, n, n + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
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
      color: "#986548",
      roughness: 1,
      side: THREE.DoubleSide,
    }),
    church: new THREE.MeshStandardMaterial({ color: "#dacdb4", roughness: 1 }),
    road: new THREE.MeshStandardMaterial({
      color: "#737a72",
      roughness: 1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
    water: new THREE.MeshStandardMaterial({
      color: "#4d9fa5",
      roughness: 0.38,
      metalness: 0.18,
      side: THREE.DoubleSide,
    }),
  };
  constructor(
    private scene: THREE.Scene,
    readonly sector: Sector,
  ) {
    // Original procedural facade pattern: illustrative, no photographed facades claimed.
    for (const material of [this.materials.walls, this.materials.church]) {
      material.onBeforeCompile = (shader) => {
        shader.vertexShader =
          "varying vec3 vFacade; varying vec3 vFacadeNormal;\n" +
          shader.vertexShader.replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvFacade=position; vFacadeNormal=normal;",
          );
        shader.fragmentShader =
          "varying vec3 vFacade; varying vec3 vFacadeNormal;\n" +
          shader.fragmentShader.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
          float horizontal = abs(vFacadeNormal.x) > abs(vFacadeNormal.z) ? vFacade.z : vFacade.x;
          vec2 pane=fract(vec2(horizontal/3.6,vFacade.y/3.2));
          float windowMask=step(.25,pane.x)*step(pane.x,.57)*step(.31,pane.y)*step(pane.y,.69);
          float fade=1.0-smoothstep(150.0,450.0,length(vViewPosition));
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.24,.32,.31),windowMask*fade*.7);`,
          );
      };
    }
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
      const vertices: number[] = [],
        indices: number[] = [];
      for (const ring of [b.points, ...b.holes])
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            c = ring[(i + 1) % ring.length],
            n = vertices.length / 3;
          vertices.push(
            a[0],
            this.sector.terrain.heightAt(...a) - 0.5,
            a[1],
            c[0],
            this.sector.terrain.heightAt(...c) - 0.5,
            c[1],
            a[0],
            b.base + b.height,
            a[1],
            c[0],
            b.base + b.height,
            c[1],
          );
          indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
        }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      geo.setIndex(indices);
      geo.computeVertexNormals();
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
        group.add(mesh);
      }
    };
    // Double-sided walls account for clockwise and counterclockwise source rings.
    this.materials.walls.side = this.materials.church.side = THREE.DoubleSide;
    addMerged(walls, this.materials.walls);
    addMerged(roofs, this.materials.roofs);
    addMerged(church, this.materials.church);
    for (const kind of ["road", "water"] as const) {
      const lines = data.lines.filter((l) => l.kind === kind);
      if (lines.length)
        group.add(
          new THREE.Mesh(ribbons(lines, this.sector), this.materials[kind]),
        );
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
