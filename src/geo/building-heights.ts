// SPDX-License-Identifier: AGPL-3.0-only
import type { Building, SectorManifest } from './sector';
export interface HeightRecord {
  id: string;
  height: number;
  expected: Pick<Building, 'base' | 'height' | 'points' | 'holes'>;
  source: { dbgtObjectId: number; iou: number; centroidDistanceMeters: number; sourceHeightMeters: number; portion: string; extrusionType: string };
}
export interface HeightRelease {
  schemaVersion: 1;
  kind: 'relative-building-heights';
  reference: SectorManifest['reference'];
  source: { license: string; sha256: string };
  records: HeightRecord[];
}
/** Fail closed as a whole if the release no longer matches its OSM/TINITALY base. */
export function validateHeightRelease(value: unknown, manifest: SectorManifest, buildings: Building[]) {
  const m = value as HeightRelease;
  if (!m || m.schemaVersion !== 1 || m.kind !== 'relative-building-heights' || !m.reference ||
      m.source?.license !== 'CC-BY-4.0' || !/^[a-f0-9]{64}$/.test(m.source?.sha256) ||
      !Array.isArray(m.records) || !m.records.length || m.records.length > 256)
    throw new Error('Altezze DBGT non valide');
  for (const key of ['projectedCRS','verticalDatum','originEasting','originNorthing','originElevation'] as const)
    if (m.reference[key] !== manifest.reference[key]) throw new Error('Riferimento DBGT diverso');
  const result = new Map<string, HeightRecord>();
  for (const r of m.records) {
    const b = buildings.find(b => b.id === r?.id);
    if (!b || result.has(r.id) || !Number.isFinite(r.height) || r.height < 2 || r.height > 65 || !r.expected ||
        b.base !== r.expected.base || b.height !== r.expected.height ||
        JSON.stringify(b.points) !== JSON.stringify(r.expected.points) || JSON.stringify(b.holes) !== JSON.stringify(r.expected.holes) ||
        !r.source || r.source.portion !== '01' || !['01','02'].includes(r.source.extrusionType) ||
        r.source.sourceHeightMeters !== r.height || !Number.isFinite(r.source.iou) || r.source.iou < .8 || r.source.iou > 1 ||
        !Number.isFinite(r.source.centroidDistanceMeters) || r.source.centroidDistanceMeters < 0 || r.source.centroidDistanceMeters > 3)
      throw new Error('Associazione DBGT non compatibile con la base');
    result.set(r.id, r);
  }
  return result;
}
/** Shared by visual meshes and collisions; never mutates archived OSM objects. */
export function withSurveyedHeight(building: Building, records: ReadonlyMap<string, HeightRecord>): Building {
  const r = records.get(building.id);
  if (!r || building.base !== r.expected.base || building.height !== r.expected.height ||
      JSON.stringify(building.points) !== JSON.stringify(r.expected.points) || JSON.stringify(building.holes) !== JSON.stringify(r.expected.holes)) return building;
  return { ...building, height: r.height, heightBasis: `dbgt-UN_VOL_AV:${r.source.dbgtObjectId}` };
}
