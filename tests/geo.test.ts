import { expect, it } from "vitest";
import {
  nearbyTiles,
  projectedToLocal,
  type GeoReference,
  type TerrainTileManifest,
} from "../src/geo/contracts";
const reference: GeoReference = {
  projectedCRS: "test-metric-frame",
  verticalDatum: "test-datum",
  originEasting: 1000,
  originNorthing: 2000,
  originElevation: 300,
};
it("converts metric coordinates with north along -Z and preserves elevation relative to a declared datum", () => {
  expect(projectedToLocal(1010, 2020, 330, reference)).toEqual({
    x: 10,
    y: 30,
    z: -20,
  });
  expect(() => projectedToLocal(NaN, 0, 0, reference)).toThrow();
  expect(() =>
    projectedToLocal(0, 0, 0, { ...reference, verticalDatum: "" }),
  ).toThrow();
});
it("limits tile selection by distance and count without loading a whole region", () => {
  const tiles: TerrainTileManifest[] = [3, 1, 0, 2].map((n) => ({
    id: String(n),
    kind: "artistic",
    reference,
    bounds: { minX: n * 100, minZ: 0, maxX: n * 100 + 100, maxZ: 100 },
    levels: [],
    credits: [],
  }));
  expect(
    nearbyTiles(tiles, { x: 10, y: 0, z: 10 }, 250, 2).map((t) => t.id),
  ).toEqual(["0", "1"]);
  expect(
    nearbyTiles(tiles, { x: 10, y: 0, z: 10 }, 10, 5).map((t) => t.id),
  ).toEqual(["0"]);
});
