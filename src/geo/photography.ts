// SPDX-License-Identifier: AGPL-3.0-only
import * as THREE from "three";
import type { Preset } from "../core/graphics";
import type { TerrainProvider } from "../core/terrain";
import type { SectorManifest } from "./sector";
import { readJSON, SECTOR_URL } from "./sector";

export interface PhotoLevel { pixels: 512 | 1024; url: string; bytes: number; sha256: string }
export interface PhotoTile {
  id: string;
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
  levels: PhotoLevel[];
}
export interface PhotoManifest {
  schemaVersion: 1;
  kind: "orthophoto";
  reference: SectorManifest["reference"];
  terrainGridMeters: number;
  credit: { attribution: string; sourceURL: string; license: string; licenseURL: string; captureDate: string };
  tiles: PhotoTile[];
}
export const PHOTO_BUDGETS = {
  eco: { tiles: 8, pixels: 512, radius: 500 },
  balanced: { tiles: 12, pixels: 1024, radius: 700 },
  high: { tiles: 16, pixels: 1024, radius: 1000 },
} as const;
export const textureBytes = (pixels: number) => Math.ceil(pixels * pixels * 4 * 4 / 3);
export function assetPath(path: string) {
  // Only packaged assets; no third-party image endpoints or path traversal.
  return typeof path === "string" && /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(?:json|webp|png|jpg)$/.test(path);
}
export function validatePhotoManifest(value: unknown, sector: SectorManifest): PhotoManifest {
  const m = value as PhotoManifest;
  if (!m || m.schemaVersion !== 1 || m.kind !== "orthophoto" || !m.reference ||
      m.terrainGridMeters !== 20 || !Array.isArray(m.tiles) || m.tiles.length > 1600 || !m.tiles.length)
    throw new Error("Manifesto fotografico non valido");
  for (const key of ["projectedCRS", "originEasting", "originNorthing", "originElevation", "verticalDatum"] as const)
    if (m.reference[key] !== sector.reference[key]) throw new Error("Riferimento fotografico diverso dal settore");
  if (!m.credit || [m.credit.attribution, m.credit.sourceURL, m.credit.license, m.credit.licenseURL, m.credit.captureDate]
    .some(v => typeof v !== "string" || !v.trim())) throw new Error("Attribuzione fotografica incompleta");
  const ids = new Set<string>();
  const cells = new Set<string>();
  for (const t of m.tiles) {
    if (!t || typeof t.id !== "string" || ids.has(t.id) || !t.bounds || !Array.isArray(t.levels)) throw new Error("Tessera duplicata/non valida");
    ids.add(t.id);
    const b = t.bounds;
    if ([b.minX, b.minZ, b.maxX, b.maxZ].some(v => !Number.isFinite(v) || Math.abs(v) > sector.size / 2 || v % 20 !== 0) ||
        b.maxX <= b.minX || b.maxZ <= b.minZ || b.maxX - b.minX > 400 || b.maxZ - b.minZ > 400)
      throw new Error("Tessera fuori griglia");
    for (let z = b.minZ; z < b.maxZ; z += 20) for (let x = b.minX; x < b.maxX; x += 20) {
      const cell = `${x},${z}`;
      if (cells.has(cell)) throw new Error("Tessere sovrapposte");
      cells.add(cell);
    }
    if (t.levels.length !== 2 || ![512, 1024].every(p => t.levels.some(l => l.pixels === p))) throw new Error("LOD fotografici mancanti");
    for (const l of t.levels)
      if (!assetPath(l.url) || !/\.(webp|png|jpg)$/.test(l.url) || !/^[a-f0-9]{64}$/.test(l.sha256) ||
          !Number.isInteger(l.bytes) || l.bytes <= 0 || l.bytes > 2_000_000) throw new Error("Asset fotografico non valido");
  }
  return m;
}
export function wantedPhotos(m: PhotoManifest, position: { x: number; z: number }, preset: Preset) {
  const budget = PHOTO_BUDGETS[preset];
  return m.tiles.map(tile => {
    const b = tile.bounds;
    const distance = Math.hypot(Math.max(b.minX-position.x, 0, position.x-b.maxX), Math.max(b.minZ-position.z, 0, position.z-b.maxZ));
    return { tile, distance, level: tile.levels.find(l => l.pixels === budget.pixels)! };
  }).filter(t => t.distance <= budget.radius).sort((a, b) => a.distance-b.distance || a.tile.id.localeCompare(b.tile.id)).slice(0, budget.tiles);
}
export function photoGeometry(tile: PhotoTile, terrain: TerrainProvider) {
  const b = tile.bounds, step = terrain.size / terrain.segments;
  const nx = (b.maxX-b.minX)/step, nz = (b.maxZ-b.minZ)/step;
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let z = 0; z <= nz; z++) for (let x = 0; x <= nx; x++) {
    const px = b.minX+x*step, pz = b.minZ+z*step;
    positions.push(px, terrain.heightAt(px, pz), pz);
    uv.push(x/nx, 1-z/nz); // Image north/top is local -Z; standard Texture.flipY=true.
  }
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    const i = z*(nx+1)+x;
    indices.push(i, i+nx+1, i+1, i+1, i+nx+1, i+nx+2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
async function fetchTexture(url: string, level: PhotoLevel, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok || Number(response.headers.get("content-length")) > 2_000_000) throw new Error("Foto non disponibile");
  if (!response.body) throw new Error("Risposta foto vuota");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > level.bytes) { await reader.cancel(); throw new Error("Foto oltre budget"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  if (buffer.byteLength !== level.bytes) throw new Error("Dimensione foto inattesa");
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)), v => v.toString(16).padStart(2, "0")).join("");
  if (hash !== level.sha256) throw new Error("Checksum foto diverso");
  const objectURL = URL.createObjectURL(new Blob([buffer.buffer]));
  const img = new Image();
  try {
    img.src = objectURL;
    await img.decode();
    if (signal.aborted || img.width !== level.pixels || img.height !== level.pixels) throw new Error("Foto annullata/dimensioni inattese");
    const texture = new THREE.Texture(img);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  } finally { URL.revokeObjectURL(objectURL); }
}
/** Optional layer: failure always leaves the geographic terrain/playability intact. */
export class PhotoTerrain {
  private manifest?: PhotoManifest;
  private baseURL = "";
  private residents = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>();
  private pending = new Map<string, AbortController>();
  private failed = new Map<string, number>();
  private wanted = new Set<string>();
  private nextUpdate = 0;
  private disposed = false;
  private status = "disabled";
  private errors = 0;
  constructor(private scene: THREE.Scene, private terrain: TerrainProvider, sector: SectorManifest) {
    const path = sector.photoManifestURL;
    if (!path) return;
    this.status = "loading";
    if (!assetPath(path) || !path.endsWith(".json")) { this.status = "unavailable"; return; }
    const url = SECTOR_URL + path;
    this.baseURL = url.slice(0, url.lastIndexOf("/")+1);
    void readJSON<unknown>(url).then(value => {
      if (this.disposed) return;
      this.manifest = validatePhotoManifest(value, sector);
      this.status = "ready";
    }).catch(() => { this.status = "unavailable"; this.errors++; });
  }
  get stats() {
    let bytes = 0;
    for (const mesh of this.residents.values()) bytes += textureBytes(mesh.userData.photoPixels as number);
    return { status: this.status, resident: this.residents.size, pending: this.pending.size,
      estimatedTextureBytes: bytes, errors: this.errors, attribution: this.manifest?.credit.attribution, creditURL: this.manifest ? this.baseURL + "credits.html" : undefined };
  }
  update(position: { x: number; z: number }, time: number, preset: Preset) {
    if (!this.manifest || this.disposed || time < this.nextUpdate) return;
    this.nextUpdate = time + .5;
    const candidates = wantedPhotos(this.manifest, position, preset);
    const key = (tile: PhotoTile, level: PhotoLevel) => `${tile.id}@${level.pixels}`;
    this.wanted = new Set(candidates.map(c => key(c.tile, c.level)));
    for (const [id, mesh] of this.residents) if (!this.wanted.has(id)) { this.release(mesh); this.residents.delete(id); }
    for (const [id, controller] of this.pending) if (!this.wanted.has(id)) controller.abort();
    for (const id of this.failed.keys()) if (!this.wanted.has(id)) this.failed.delete(id);
    for (const { tile, level } of candidates) {
      const id = key(tile, level);
      if (this.pending.size >= 2) break;
      if (this.residents.has(id) || this.pending.has(id) || (this.failed.get(id) ?? 0) > time) continue;
      const controller = new AbortController();
      this.pending.set(id, controller);
      const timeout = setTimeout(() => controller.abort(), 8000);
      void fetchTexture(this.baseURL + level.url, level, controller.signal).then(texture => {
        if (this.disposed || controller.signal.aborted || !this.wanted.has(id)) { texture.dispose(); return; }
        const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, depthWrite: false });
        const mesh = new THREE.Mesh(photoGeometry(tile, this.terrain), material);
        mesh.userData.photoPixels = level.pixels;
        mesh.renderOrder = 1; // Base terrain first; raised roads/buildings retain their depth.
        this.scene.add(mesh);
        this.residents.set(id, mesh);
        this.failed.delete(id);
      }).catch(() => { if (!this.disposed && this.wanted.has(id)) { this.errors++; this.failed.set(id, time + 30); } })
        .finally(() => { clearTimeout(timeout); this.pending.delete(id); });
    }
  }
  private release(mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>) {
    this.scene.remove(mesh);
    mesh.geometry.dispose(); mesh.material.map?.dispose(); mesh.material.dispose();
  }
  dispose() {
    this.disposed = true;
    for (const controller of this.pending.values()) controller.abort();
    for (const mesh of this.residents.values()) this.release(mesh);
    this.residents.clear(); this.failed.clear(); this.wanted.clear();
  }
}
