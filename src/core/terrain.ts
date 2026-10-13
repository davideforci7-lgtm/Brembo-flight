// SPDX-License-Identifier: AGPL-3.0-only
import { clamp, lerp, seededRandom, type Vec3 } from './math';

/** Replace this provider with licensed, projected elevation data for a real valley.
 * Coordinates are local metres: +Y up, -Z north. No geographic claims are made. */
export interface TerrainProvider {
  readonly size: number;
  readonly segments: number;
  readonly heights: Float32Array;
  heightAt(x: number, z: number): number;
}
export const riverX = (z: number) => -26 + Math.sin(z * 0.010) * 24 + Math.sin(z * 0.022) * 7;
export const WATER_LEVEL = 1.8;
export const WORLD_LIMIT = 690;
export const CEILING = 270;

function elevation(x: number, z: number): number {
  const fromRiver = Math.abs(x - riverX(z));
  const channel = 4.2 * (1 - Math.exp(-((fromRiver / 16) ** 2))) - 1.1;
  const foothills = Math.max(0, fromRiver - 60);
  const mountains = 1 - Math.exp(-((foothills / 175) ** 1.8));
  const ridges = 94 + 42 * Math.sin(z * 0.008 + x * 0.005)
    + 28 * Math.cos(z * 0.017 - x * 0.009) + 14 * Math.sin(x * 0.027 + z * 0.031);
  const details = Math.sin(x * 0.05) * Math.sin(z * 0.043) * Math.min(4, fromRiver * 0.028);
  return channel + mountains * ridges + details;
}

export class DemoTerrain implements TerrainProvider {
  readonly size = 1600;
  readonly segments = 200;
  readonly heights: Float32Array;
  constructor() {
    this.heights = new Float32Array((this.segments + 1) ** 2);
    for (let z = 0; z <= this.segments; z++) {
      for (let x = 0; x <= this.segments; x++) {
        this.heights[z * (this.segments + 1) + x] = elevation(x * this.size / this.segments - this.size / 2, z * this.size / this.segments - this.size / 2);
      }
    }
  }
  /** Piecewise linear sampling matches the two rendered triangles exactly. */
  heightAt(x: number, z: number): number {
    const gx = clamp((x + this.size / 2) * this.segments / this.size, 0, this.segments - 0.00001);
    const gz = clamp((z + this.size / 2) * this.segments / this.size, 0, this.segments - 0.00001);
    const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz;
    const row = this.segments + 1, i = iz * row + ix;
    const a = this.heights[i], b = this.heights[i + 1], c = this.heights[i + row], d = this.heights[i + row + 1];
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }
}
export interface Obstacle { position: Vec3; radius: number; height: number }
export function createTrees(terrain: TerrainProvider): Obstacle[] {
  const rand = seededRandom(1741), trees: Obstacle[] = [];
  for (let i = 0; i < 2100; i++) {
    const x = (rand() - 0.5) * 1400, z = (rand() - 0.5) * 1400;
    const y = terrain.heightAt(x, z);
    // Keep the riverbank, launch site and beginner route clear.
    if (y < 3 || y > 91 || Math.abs(x - riverX(z)) < 34 || Math.abs(x - 28) < 17) continue;
    const height = lerp(4.2, 11.5, rand());
    trees.push({ position: { x, y, z }, radius: height * 0.22, height });
  }
  return trees;
}
