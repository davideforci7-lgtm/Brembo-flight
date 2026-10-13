// SPDX-License-Identifier: AGPL-3.0-only
import type { Vec3 } from "../core/math";
/** Import boundary only. No geographic dataset is bundled in version 0.2. */
export interface GeoReference {
  projectedCRS: string; // Explicit metric CRS, from the source metadata.
  verticalDatum: string; // Must be resolved before mixing elevations.
  originEasting: number;
  originNorthing: number;
  originElevation: number;
}
export interface SourceCredit {
  title: string;
  sourceURL: string;
  license: string;
  licenseURL: string;
  attribution: string;
  retrievedAt: string;
  checksumSHA256: string;
}
export interface TerrainTileManifest {
  id: string;
  kind: "surveyed-terrain" | "artistic";
  reference: GeoReference;
  // Local x/z metres. Neighbouring tiles must share border samples.
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
  levels: {
    spacingMeters: number;
    heightURL: string;
    maxErrorMeters: number;
  }[];
  credits: SourceCredit[];
}
/** Does NOT project longitude/latitude: preprocess them into the declared metric CRS. */
export function projectedToLocal(
  easting: number,
  northing: number,
  elevation: number,
  ref: GeoReference,
): Vec3 {
  if (
    ![
      easting,
      northing,
      elevation,
      ref.originEasting,
      ref.originNorthing,
      ref.originElevation,
    ].every(Number.isFinite)
  )
    throw new Error("Coordinate non finite");
  if (!ref.projectedCRS || !ref.verticalDatum)
    throw new Error("Riferimento geografico incompleto");
  return {
    x: easting - ref.originEasting,
    y: elevation - ref.originElevation,
    z: ref.originNorthing - northing,
  };
}
/** Bounded neighbourhood, to be used by a future asynchronous tile cache. */
export function nearbyTiles(
  tiles: readonly TerrainTileManifest[],
  position: Vec3,
  radius: number,
  limit: number,
) {
  if (
    !Number.isFinite(radius) ||
    radius < 0 ||
    !Number.isInteger(limit) ||
    limit < 1
  )
    return [];
  return tiles
    .map((tile) => {
      const b = tile.bounds;
      const dx = Math.max(b.minX - position.x, 0, position.x - b.maxX),
        dz = Math.max(b.minZ - position.z, 0, position.z - b.maxZ);
      return { tile, distance: Math.hypot(dx, dz) };
    })
    .filter((t) => t.distance <= radius)
    .sort(
      (a, b) => a.distance - b.distance || a.tile.id.localeCompare(b.tile.id),
    )
    .slice(0, limit)
    .map((t) => t.tile);
}
export const DEMO_PROVENANCE = {
  id: "synthetic-demo-v1",
  kind: "artistic",
  geographicReference: null,
  description:
    "Valle inventata. Nessun rilievo, strada o edificio attribuito a Val Brembilla.",
} as const;
