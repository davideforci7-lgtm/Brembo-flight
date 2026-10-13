// SPDX-License-Identifier: AGPL-3.0-only
import { dot, sub, lerp, type Vec3 } from './math';
import type { TerrainProvider } from './terrain';

export interface Checkpoint { position: Vec3; normal: Vec3; radius: number; label: string }
export function createCourse(terrain: TerrainProvider): Checkpoint[] {
  const points = [
    [28, 12, 112, 'Decollo'], [28, 12, 35, 'Lungo il fiume'], [28, 16, -60, 'La pineta'],
    [7, 23, -157, 'Verso il crinale'], [50, 34, -253, 'Sopra i larici'],
    [100, 47, -346, 'Il belvedere'], [35, 33, -455, 'Ritorno in valle'], [0, 23, -550, 'Orizzonte'],
  ] as const;
  let previous: Vec3 = { x: 28, y: 12, z: 180 };
  return points.map(([x, altitude, z, label]) => {
    const position = { x, y: Math.max(altitude, terrain.heightAt(x, z) + 9), z };
    const direction = sub(position, previous);
    const length = Math.hypot(direction.x, direction.z);
    const normal = { x: direction.x / length, y: 0, z: direction.z / length };
    previous = position;
    return { position, normal, radius: 8.5, label };
  });
}

/** Swept plane crossing avoids missing a ring at high speed; forward only. */
export function crossesCheckpoint(from: Vec3, to: Vec3, gate: Checkpoint, bodyRadius = 0.65): boolean {
  const a = dot(sub(from, gate.position), gate.normal);
  const b = dot(sub(to, gate.position), gate.normal);
  if (a >= 0 || b < 0) return false;
  const t = -a / (b - a);
  const hit = { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), z: lerp(from.z, to.z, t) };
  const delta = sub(hit, gate.position);
  return dot(delta, delta) <= (gate.radius - bodyRadius) ** 2;
}
