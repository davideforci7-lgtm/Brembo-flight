// SPDX-License-Identifier: AGPL-3.0-only
import * as THREE from 'three';
import type { TerrainProvider } from '../core/terrain';
import type { MapLine, Point } from './sector';

/** Original ribbon footprint: widths and bridge elevations remain illustrative. */
export function ribbonFootprint(line: MapLine) {
  const points: Point[] = [], indices: number[] = [];
  for (let i = 0; i < line.points.length; i++) {
    const [x, z] = line.points[i];
    const a = line.points[Math.max(0, i - 1)], b = line.points[Math.min(line.points.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1;
    for (const side of [-1, 1]) points.push([x + dz / len * line.width / 2 * side, z - dx / len * line.width / 2 * side]);
    if (i > 0) { const n = i * 2; indices.push(n - 2, n, n - 1, n - 1, n, n + 1); }
  }
  return { points, indices };
}

/** Convex clipping against a half-plane, with exact intersections on terrain edges. */
function clip(poly: Point[], a: number, b: number, c: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = a * p[0] + b * p[1] + c, dq = a * q[0] + b * q[1] + c;
    if (dp >= 0) out.push(p);
    if ((dp < 0) !== (dq < 0)) {
      const t = dp / (dp - dq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}

/** Split a footprint at every crossed grid edge AND diagonal. Sampling only its
 * vertices (or subdividing at a fixed distance) cannot guarantee terrain contact. */
export function drapeFootprint(points: Point[], indices: number[], terrain: TerrainProvider, offset: number) {
  const positions: number[] = [], triangles: number[] = [];
  const step = terrain.size / terrain.segments, origin = -terrain.size / 2;
  const cell = (v: number) => Math.max(0, Math.min(terrain.segments - 1, Math.floor((v - origin) / step)));
  for (let i = 0; i < indices.length; i += 3) {
    const tri = indices.slice(i, i + 3).map(n => points[n]);
    const minX = cell(Math.min(...tri.map(p => p[0]))), maxX = cell(Math.max(...tri.map(p => p[0])));
    const minZ = cell(Math.min(...tri.map(p => p[1]))), maxZ = cell(Math.max(...tri.map(p => p[1])));
    for (let ix = minX; ix <= maxX; ix++) {
      const x = origin + ix * step;
      const strip = clip(clip(tri, 1, 0, -x), -1, 0, x + step);
      if (strip.length < 3) continue;
      for (let iz = minZ; iz <= maxZ; iz++) {
        const z = origin + iz * step;
        const square = clip(clip(strip, 0, 1, -z), 0, -1, z + step);
        if (square.length < 3) continue;
        for (const sign of [-1, 1]) {
          const poly = clip(square, sign, sign, -sign * (x + z + step));
          const start = positions.length / 3;
          for (const [px, pz] of poly) positions.push(px, terrain.heightAt(px, pz) + offset, pz);
          for (let n = 1; n < poly.length - 1; n++) {
            const [a, b, c] = [poly[0], poly[n], poly[n + 1]];
            if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 1e-8)
              triangles.push(start, start + n, start + n + 1);
          }
        }
      }
    }
  }
  return { positions, indices: triangles };
}

export function surfaceGeometry(lines: MapLine[], terrain: TerrainProvider) {
  const positions: number[] = [], indices: number[] = [];
  for (const line of lines) {
    const footprint = ribbonFootprint(line);
    const offset = line.kind === 'water' ? .36 : line.bridge ? 2 : .24;
    // Preserve existing bridge treatment until a surveyed deck elevation is available.
    const part = line.bridge
      ? { positions: footprint.points.flatMap(([x, z]) => [x, terrain.heightAt(x, z) + offset, z]), indices: footprint.indices }
      : drapeFootprint(footprint.points, footprint.indices, terrain, offset);
    const start = positions.length / 3;
    for (const p of part.positions) positions.push(p);
    for (const n of part.indices) indices.push(n + start);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
