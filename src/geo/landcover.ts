// SPDX-License-Identifier: AGPL-3.0-only
import * as THREE from "three";
import type { Preset } from "../core/graphics";
import { SECTOR_URL } from "./sector";
import { configureGround, DETAIL_TEXTURE_BYTES } from "./surface-detail";

/** Bounded, local cartographic texture. Original vertex colours remain a fallback. */
export class LandcoverSurface {
  readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  status: "loading" | "ready" | "fallback" = "loading";
  private requested = 0;
  private generation = 0;
  private texture?: THREE.Texture;
  private resolution = 0;
  constructor(private maxAnisotropy: number) { configureGround(this.material); }
  setPreset(preset: Preset) {
    const size = preset === "high" ? 2048 : 1024;
    if (this.requested === size) return;
    this.requested = size;
    this.status = "loading";
    const generation = ++this.generation;
    new THREE.TextureLoader().load(`${SECTOR_URL}landcover-${size}.png`, texture => {
      if (generation !== this.generation) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      // Image rows and local z both increase southward. UVs below use v=1-row.
      texture.anisotropy = Math.min(this.maxAnisotropy, preset === "high" ? 8 : 4);
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      const previous = this.texture;
      this.texture = texture;
      this.material.map = texture;
      this.material.vertexColors = false;
      this.material.needsUpdate = true;
      this.resolution = size;
      this.status = "ready";
      previous?.dispose();
    }, undefined, () => {
      if (generation !== this.generation) return;
      // Release a high LOD even when a downgrade fails; never retain it on Eco.
      this.texture?.dispose();
      this.texture = undefined;
      this.material.map = null;
      this.material.vertexColors = true;
      this.material.needsUpdate = true;
      this.resolution = 0;
      this.status = "fallback";
    });
  }
  get stats() {
    return { status: this.status, resolution: this.resolution,
      estimatedTextureBytes: Math.ceil(this.resolution ** 2 * 4 * 4 / 3),
      detailTextureBytes: DETAIL_TEXTURE_BYTES };
  }
}
