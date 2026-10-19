// SPDX-License-Identifier: AGPL-3.0-only
import * as THREE from "three";

/** Art-directed daylight, not a geographic/time-of-day solar observation. */
export const SUN_DIRECTION = new THREE.Vector3(-.6, 1, -.45).normalize();
export const SHADOW_SPAN = 640;
export const SHADOW_RESOLUTION = 2048;
const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), SUN_DIRECTION).normalize();
const up = new THREE.Vector3().crossVectors(SUN_DIRECTION, right).normalize();

/** Snap in light space, avoiding swimming shadows as the drone moves. */
export function snapShadowTarget(point: THREE.Vector3) {
  const texel = SHADOW_SPAN / SHADOW_RESOLUTION;
  return new THREE.Vector3()
    .addScaledVector(right, Math.round(point.dot(right) / texel) * texel)
    .addScaledVector(up, Math.round(point.dot(up) / texel) * texel)
    .addScaledVector(SUN_DIRECTION, point.dot(SUN_DIRECTION));
}
