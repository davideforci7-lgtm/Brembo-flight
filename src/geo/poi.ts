// SPDX-License-Identifier: AGPL-3.0-only
import type { Vec3 } from "../core/math";
export const pointsOfInterest = [
  {
    id: "san-giovanni",
    name: "San Giovanni Battista",
    x: 198.9,
    z: 295.65,
    osm: "https://www.openstreetmap.org/way/127912869",
    source:
      "https://www.valbrembilla.it/page.php/it/chiesa-di-brembilla/103?lang=it",
    sourceLabel: "Pro Loco Val Brembilla",
    text: "La parrocchiale di Brembilla fu progettata da Elia Fornoni e consacrata nel 1896. Sotto il presbiterio si trova lo Scurolo, dedicato alla Madonna di Lourdes.",
  },
  {
    id: "san-gottardo",
    name: "San Gottardo · Laxolo",
    x: 412.55,
    z: 1487.36,
    osm: "https://www.openstreetmap.org/way/730535266",
    source: "https://www.lombardiabeniculturali.it/istituzioni/schede/1500109/",
    sourceLabel: "Lombardia Beni Culturali · Regione Lombardia",
    text: "La parrocchia di San Gottardo a Laxolo divenne autonoma da Brembilla nel 1919. La chiesa fu consacrata nel 1938; una chiesa dedicata a San Gottardo era già documentata qui nel 1575.",
  },
] as const;
export function nearestPOI(position: Vec3) {
  return pointsOfInterest
    .map((p) => ({
      poi: p,
      distance: Math.hypot(position.x - p.x, position.z - p.z),
    }))
    .filter((p) => p.distance < 180)
    .sort((a, b) => a.distance - b.distance)[0]?.poi;
}
