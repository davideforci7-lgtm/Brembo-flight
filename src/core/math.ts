// SPDX-License-Identifier: AGPL-3.0-only
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const distance = (a: Vec3, b: Vec3) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const sub = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
export function segmentDistance(point: Vec3, start: Vec3, end: Vec3): number {
  const segment = sub(end, start);
  const t = clamp(
    dot(sub(point, start), segment) / (dot(segment, segment) || 1),
    0,
    1,
  );
  return distance(point, {
    x: lerp(start.x, end.x, t),
    y: lerp(start.y, end.y, t),
    z: lerp(start.z, end.z, t),
  });
}
export function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
