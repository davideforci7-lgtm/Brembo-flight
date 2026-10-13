import { describe, expect, it } from 'vitest';
import { DemoTerrain, createTrees, CEILING, WORLD_LIMIT, type TerrainProvider } from '../src/core/terrain';
import { createCourse, crossesCheckpoint, type Checkpoint } from '../src/core/course';
import { FlightSimulation, neutralInput } from '../src/core/flight';
import { clamp, distance } from '../src/core/math';

const terrain = new DemoTerrain();
const course = createCourse(terrain);
const trees = createTrees(terrain);
function sim() { const flight = new FlightSimulation(terrain, course, trees); flight.start(); return flight; }
function advance(flight: FlightSimulation, seconds: number, input = neutralInput(), fps = 60) {
  for (let i = 0; i < seconds * fps; i++) flight.update(1 / fps, input);
}
const gate: Checkpoint = { position: { x: 0, y: 10, z: 0 }, normal: { x: 0, y: 0, z: -1 }, radius: 8.5, label: 'Test' };

describe('checkpoint traversal', () => {
  it('detects a high-speed crossing even when both endpoints lie outside the ring', () => {
    expect(crossesCheckpoint({ x: 1, y: 11, z: 30 }, { x: 1, y: 11, z: -30 }, gate)).toBe(true);
  });
  it('rejects reverse travel, grazing the rim, and merely approaching', () => {
    expect(crossesCheckpoint({ x: 0, y: 10, z: -2 }, { x: 0, y: 10, z: 2 }, gate)).toBe(false);
    expect(crossesCheckpoint({ x: 8.3, y: 10, z: 2 }, { x: 8.3, y: 10, z: -2 }, gate)).toBe(false);
    expect(crossesCheckpoint({ x: 0, y: 10, z: 3 }, { x: 0, y: 10, z: 1 }, gate)).toBe(false);
  });
});

describe('assisted flight', () => {
  it('hovers without drifting or changing altitude', () => {
    const flight = sim(), before = { ...flight.position }; advance(flight, 10);
    expect(flight.position).toEqual(before); expect(flight.status).toBe('flying');
  });
  it('has the same movement at 30, 60 and 120 fps', () => {
    const runs = [30, 60, 120].map(fps => { const f = sim(); advance(f, 2, { ...neutralInput(), forward: 1, right: 0.3, up: 0.4 }, fps); return f; });
    for (const run of runs.slice(1)) expect(distance(run.position, runs[0].position)).toBeLessThan(0.35);
  });
  it('brakes strongly and stabilizes on release', () => {
    const flight = sim(); advance(flight, 1, { ...neutralInput(), forward: 1 });
    expect(flight.speed).toBeGreaterThan(15); advance(flight, 1, { ...neutralInput(), brake: true });
    expect(flight.speed).toBeLessThan(0.01);
  });
  it('normalizes diagonal input instead of granting extra horizontal speed', () => {
    const flight = sim(); flight.position.y = 200;
    advance(flight, 2, { ...neutralInput(), forward: 1, right: 1 }); expect(flight.speed).toBeLessThanOrEqual(21.001);
  });
  it('boosts above cruise speed and turns right when requested', () => {
    const flight = sim(); advance(flight, 1, { ...neutralInput(), forward: 1, boost: true, yaw: 1 });
    expect(flight.speed).toBeGreaterThan(25); expect(flight.yaw).toBeLessThan(0); expect(flight.position.x).toBeGreaterThan(28);
  });
  it('freezes time and position while paused, rejects invalid deltas and clamps long frames', () => {
    const flight = sim(); flight.pause(); const before = { ...flight.position };
    advance(flight, 100, { ...neutralInput(), forward: 1 }); expect(flight.position).toEqual(before); expect(flight.elapsed).toBe(0);
    flight.resume(); flight.update(NaN, neutralInput()); flight.update(-1, neutralInput());
    expect(flight.elapsed).toBe(0); flight.update(10, neutralInput()); expect(flight.elapsed).toBeLessThanOrEqual(0.1);
  });
  it('bounds the playable map and ceiling without invalid coordinates', () => {
    const flight = sim(); flight.position = { x: WORLD_LIMIT - 0.01, y: CEILING - 0.01, z: 0 };
    advance(flight, 2, { ...neutralInput(), right: 1, up: 1 });
    expect(flight.position.x).toBeLessThanOrEqual(WORLD_LIMIT); expect(flight.position.y).toBe(CEILING); expect(flight.status).toBe('flying');
  });
});

describe('collisions and recovery', () => {
  it('collides with the ground and recovers before the current gate with a penalty', () => {
    const flight = sim(); advance(flight, 3, { ...neutralInput(), up: -1 });
    expect(flight.status).toBe('crashed'); expect(flight.crashes).toBe(1);
    flight.respawn(); expect(flight.status).toBe('flying'); expect(flight.penalties).toBe(5); expect(flight.nextCheckpoint).toBe(0);
    expect(flight.altitude).toBeGreaterThan(4);
  });
  it('collides with water above the riverbed', () => {
    const flight = sim(); flight.position = { x: -26, y: 2, z: 0 }; flight.update(1 / 60, neutralInput());
    expect(flight.status).toBe('crashed'); expect(flight.crashReason).toContain('acqua');
  });
  it('collides with a tree crown and not with a tree far below', () => {
    const flat: TerrainProvider = { size: 1600, segments: 1, heights: new Float32Array(4), heightAt: () => 0 };
    const tree = { position: { x: 28, y: 0, z: 180 }, radius: 2, height: 15 };
    const flight = new FlightSimulation(flat, course, [tree]); flight.start(); flight.update(1 / 60, neutralInput());
    expect(flight.status).toBe('crashed'); expect(flight.crashReason).toContain('albero');
    flight.restart(); flight.position.y = 30; flight.update(1 / 60, neutralInput()); expect(flight.status).toBe('flying');
  });
  it('collides with the active ring rim instead of awarding the checkpoint', () => {
    const flight = sim(), first = course[0];
    flight.position = { x: first.position.x + first.radius, y: first.position.y, z: first.position.z + 0.1 };
    flight.update(1 / 60, neutralInput()); expect(flight.status).toBe('crashed'); expect(flight.nextCheckpoint).toBe(0);
  });
  it('restart clears progress, penalties and elapsed time', () => {
    const flight = sim(); advance(flight, 5, { ...neutralInput(), forward: 1 }); expect(flight.nextCheckpoint).toBeGreaterThan(0);
    flight.respawn(); flight.restart(); expect(flight.nextCheckpoint).toBe(0); expect(flight.scoreTime).toBe(0); expect(flight.crashes).toBe(0);
  });
});

describe('terrain and complete course', () => {
  it('samples the exact rendered triangle at vertices and both triangle interiors', () => {
    const t = new DemoTerrain(), step = t.size / t.segments, i = 96 * 201 + 101;
    const x = 101 * step - 800, z = 96 * step - 800;
    const a = t.heights[i], b = t.heights[i + 1], c = t.heights[i + 201], d = t.heights[i + 202];
    expect(t.heightAt(x, z)).toBeCloseTo(a, 7);
    expect(t.heightAt(x + 0.2 * step, z + 0.3 * step)).toBeCloseTo(a * 0.5 + b * 0.2 + c * 0.3, 7);
    expect(t.heightAt(x + 0.8 * step, z + 0.7 * step)).toBeCloseTo(d * 0.5 + c * 0.2 + b * 0.3, 7);
  });
  it('generates identical terrain and vegetation on every load', () => {
    expect(new DemoTerrain().heights).toEqual(terrain.heights); expect(createTrees(terrain)).toEqual(trees);
  });
  it('can fly through all eight rings using only the same velocity controls as a player', () => {
    const flight = sim();
    // Proportional pilot aims through each gate; no position teleportation or test-only game API.
    for (let i = 0; i < 24000 && flight.status === 'flying'; i++) {
      const next = course[flight.nextCheckpoint];
      const target = { x: next.position.x + next.normal.x * 7, y: next.position.y, z: next.position.z + next.normal.z * 7 };
      const dx = target.x - flight.position.x, dz = target.z - flight.position.z;
      flight.update(1 / 60, {
        ...neutralInput(),
        right: clamp(dx * 0.17, -0.8, 0.8), forward: clamp(-dz * 0.17, -0.8, 0.8),
        up: clamp((target.y - flight.position.y) * 0.30, -0.8, 0.8),
      });
    }
    expect(flight.crashReason).toBe(''); expect(flight.status).toBe('finished'); expect(flight.nextCheckpoint).toBe(8);
    expect(flight.elapsed).toBeGreaterThan(30); expect(flight.elapsed).toBeLessThan(180);
    const time = flight.elapsed; advance(flight, 2); expect(flight.elapsed).toBe(time);
  });
});
