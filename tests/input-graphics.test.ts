import { describe, expect, it } from "vitest";
import {
  analogStick,
  GamepadReader,
  type PadSnapshot,
} from "../src/core/gamepad";
import { defaults, sanitizeSettings } from "../src/core/settings";
import { GraphicsGovernor, renderSize } from "../src/core/graphics";
import { DemoTerrain } from "../src/core/terrain";
import { FlightSimulation, neutralInput } from "../src/core/flight";
import { createCourse } from "../src/core/course";
function pad(axes = [0, 0, 0, 0], pressed: number[] = []): PadSnapshot {
  return {
    id: "DualSense simulated standard mapping",
    index: 0,
    mapping: "standard",
    connected: true,
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: pressed.includes(i),
      value: pressed.includes(i) ? 1 : 0,
    })),
  };
}
describe("controller adapter, no hardware claims", () => {
  it("removes drift and rescales continuously, preserving diagonals and full reach", () => {
    expect(analogStick(0.08, 0.08, 0.12, 1, 1)).toEqual({ x: 0, y: 0 });
    expect(analogStick(0.121, 0, 0.12, 1, 1).x).toBeCloseTo(0.001 / 0.88);
    expect(analogStick(1, 0, 0.12, 2.5, 1)).toEqual({ x: 1, y: 0 });
    const diagonal = analogStick(1, 1, 0.12, 1, 1);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
    expect(analogStick(NaN, Infinity, 0.12, 1, 1)).toEqual({ x: 0, y: 0 });
  });
  it("requires neutral on connect and emits commands only on rising edges", () => {
    const r = new GamepadReader();
    expect(r.poll([pad([0, -1, 0, 0], [9])], defaults).commands).toEqual([]);
    expect(r.armed).toBe(false);
    r.poll([pad()], defaults);
    expect(r.armed).toBe(true);
    expect(r.poll([pad([0, 0, 0, 0], [9, 3])], defaults).commands).toEqual([
      "camera",
      "pause",
    ]);
    expect(r.poll([pad([0, 0, 0, 0], [9, 3])], defaults).commands).toEqual([]);
  });
  it("maps game and drone mode 2, brake and boost using standard buttons", () => {
    const r = new GamepadReader();
    r.poll([pad()], defaults);
    expect(
      r.poll([pad([0.5, -1, 0.2, -0.4], [6, 7])], defaults).input,
    ).toMatchObject({ brake: true, boost: true });
    const s = r.poll([pad([0, -1, 0, 0])], defaults).input;
    expect(s.forward).toBe(1);
    expect(s.up).toBe(-0);
    const mode2 = r.poll([pad([0, -1, 0, 0])], {
      ...defaults,
      gamepadLayout: "mode2",
    }).input;
    expect(mode2.up).toBe(1);
    expect(mode2.forward).toBe(-0);
  });
  it("disconnect immediately zeros all axes and requires a neutral reconnect", () => {
    const r = new GamepadReader();
    r.poll([pad()], defaults);
    r.poll([pad([1, 0, 0, 0])], defaults);
    const result = r.poll([], defaults);
    expect(result.changed).toBe(true);
    expect(result.input).toEqual(neutralInput());
    expect(r.poll([pad([1, 0, 0, 0])], defaults).input).toEqual(neutralInput());
  });
  it("ignores nonstandard mappings and keeps an existing controller selected", () => {
    const r = new GamepadReader();
    expect(r.poll([{ ...pad(), mapping: "" }], defaults).input).toEqual(
      neutralInput(),
    );
    expect(r.label).toContain("non standard");
    r.poll([{ ...pad(), index: 1 }], defaults);
    expect(r.poll([pad(), { ...pad(), index: 1 }], defaults).changed).toBe(
      false,
    );
  });
});
it("sanitizes corrupt settings and bounds GPU work in portrait, landscape and 4K", () => {
  expect(
    sanitizeSettings({
      sensitivity: Infinity,
      touchSize: 999,
      quality: "ultra",
      showFPS: "true",
    }),
  ).toMatchObject({
    sensitivity: 1,
    touchSize: 1.2,
    quality: "auto",
    showFPS: false,
  });
  for (const [w, h, dpr] of [
    [375, 629, 3],
    [812, 375, 3],
    [3840, 2160, 2],
  ]) {
    const high = renderSize(w, h, dpr, "high"),
      eco = renderSize(w, h, dpr, "eco");
    expect(high.width * high.height).toBeLessThanOrEqual(4200000);
    expect(high.width).toBeGreaterThanOrEqual(eco.width);
    expect(high.width / high.height).toBeCloseTo(w / h, 1);
  }
});
it("auto downgrades only after sustained slow frames and leaves manual choices alone", () => {
  const auto = new GraphicsGovernor("auto", false),
    manual = new GraphicsGovernor("high", false);
  for (let i = 0; i < 300; i++) {
    auto.observe(1 / 30, true);
    manual.observe(1 / 30, true);
  }
  expect(auto.preset).toBe("eco");
  expect(manual.preset).toBe("high");
  const hidden = new GraphicsGovernor("auto", false);
  for (let i = 0; i < 400; i++) hidden.observe(0.1, false);
  expect(hidden.preset).toBe("balanced");
});
it("exploration keeps the original flight response but has no gates, clock or penalties", () => {
  const terrain = new DemoTerrain(),
    flight = new FlightSimulation(terrain, createCourse(terrain), []);
  flight.mode = "explore";
  flight.start();
  for (let i = 0; i < 240; i++)
    flight.update(1 / 60, { ...neutralInput(), forward: 1 });
  expect(flight.status).toBe("flying");
  expect(flight.nextCheckpoint).toBe(0);
  expect(flight.elapsed).toBe(0);
  expect(flight.speed).toBeCloseTo(21, 2);
  flight.respawn();
  expect(flight.penalties).toBe(0);
  expect(flight.position).toEqual({ x: 28, y: 12, z: 180 });
});
