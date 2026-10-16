import { readFileSync } from "node:fs";
import {
  GeographicTerrain,
  createGeographicTrees,
  BuildingIndex,
  sectorCourse,
  sectorEnvironment,
  type TerrainData,
  type Building,
} from "../../src/geo/sector";
import { test, expect } from "@playwright/test";
import { DemoTerrain, createTrees } from "../../src/core/terrain";
import { createCourse } from "../../src/core/course";
import { FlightSimulation } from "../../src/core/flight";
import { GamepadReader } from "../../src/core/gamepad";
import { defaults } from "../../src/core/settings";
import { clamp } from "../../src/core/math";

// The trace still keeps DOM snapshots/actions and a failure screenshot. Recording a
// screencast of every software-rendered frame makes this long replay GPU-bound.
test.use({ trace: { mode: "retain-on-failure", screenshots: false, snapshots: true } });

for (const real of [false, true])
  test(`flies the full ${real ? "Brembilla" : "demo"} course with standard-controller inputs and keeps the finish menu usable after rotation`, async ({
    page,
    browserName,
    isMobile,
  }, info) => {
    test.skip(
      browserName !== "chromium" || isMobile,
      "One deterministic integration replay; layout matrix covers other viewports.",
    );
    test.setTimeout(180000);
    // This test covers the complete flight, not high-resolution GPU throughput.
    // Resolution coverage remains in the separate responsive/pixel-budget test.
    await page.setViewportSize({ width: 480, height: 270 });
    const terrain = real
        ? new GeographicTerrain(
            JSON.parse(
              readFileSync("public/geo/brembilla-centro/terrain.json", "utf8"),
            ) as TerrainData,
          )
        : new DemoTerrain(),
      course = real ? sectorCourse(terrain) : createCourse(terrain),
      buildings = real
        ? new BuildingIndex(
            (
              JSON.parse(
                readFileSync(
                  "public/geo/brembilla-centro/collision.json",
                  "utf8",
                ),
              ) as { buildings: Building[] }
            ).buildings,
          )
        : undefined,
      simulation = new FlightSimulation(
        terrain,
        course,
        real
          ? createGeographicTrees(terrain as GeographicTerrain, buildings!)
          : createTrees(terrain),
        real ? sectorEnvironment(terrain) : undefined,
        buildings,
      );
    const reader = new GamepadReader();
    const pad = {
      id: "Replay standard pad",
      index: 0,
      mapping: "standard",
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    reader.poll([pad], defaults);
    simulation.start();
    const trace: number[][] = [];
    const inverse = (x: number, y: number) => {
      const r = Math.hypot(x, y);
      if (!r) return [0, 0];
      const out = 0.12 + 0.88 * Math.min(1, r);
      return [(x / r) * out, (y / r) * out];
    };
    for (let i = 0; i < 1800 && simulation.status === "flying"; i++) {
      const gate = course[simulation.nextCheckpoint];
      const right = clamp(
        (gate.position.x + gate.normal.x * 7 - simulation.position.x) * 0.17,
        -0.8,
        0.8,
      );
      const forward = clamp(
        -(gate.position.z + gate.normal.z * 7 - simulation.position.z) * 0.17,
        -0.8,
        0.8,
      );
      const up = clamp(
        (gate.position.y - simulation.position.y) * 0.3,
        -0.8,
        0.8,
      );
      pad.axes = [...inverse(right, -forward), ...inverse(0, -up)];
      trace.push([...pad.axes]);
      simulation.update(0.1, reader.poll([pad], defaults).input);
    }
    expect(simulation.status).toBe("finished");
    await page.addInitScript((inputs) => {
      localStorage.setItem(
        "brembo-settings-v2",
        JSON.stringify({ quality: "eco" }),
      );
      const original = requestAnimationFrame.bind(window);
      let timestamp = performance.now(),
        index = 0,
        axes = [0, 0, 0, 0];
      // Accelerated deterministic test clock, never used for reported hardware FPS.
      window.requestAnimationFrame = (callback) =>
        original(() => {
          timestamp = Math.max(timestamp + 100, performance.now());
          if (
            document.querySelector("#app")?.getAttribute("data-status") ===
            "flying"
          )
            axes = inputs[index++] || [0, 0, 0, 0];
          callback(timestamp);
        });
      Object.defineProperty(navigator, "getGamepads", {
        value: () => [
          {
            id: "Replay standard pad",
            index: 0,
            mapping: "standard",
            connected: true,
            axes,
            buttons: Array.from({ length: 17 }, () => ({
              pressed: false,
              value: 0,
            })),
          },
        ],
      });
    }, trace);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(real ? "./" : "./?scenario=demo");
    await expect(page.locator("#start-button")).toBeVisible();
    // Allow the neutral initial sample to arm the controller before takeoff.
    await expect(page.locator("#app")).toHaveAttribute(
      "data-controller",
      "ready",
    );
    await page.locator("#flight-profile").selectOption("sport");
    await page.locator("#activity").selectOption("course");
    await page.locator("#start-button").click();
    await expect(page.locator("#app")).toHaveAttribute(
      "data-status",
      "finished",
      { timeout: 150000 },
    );
    await expect(page.locator("#app")).toHaveAttribute("data-checkpoint", "8");
    for (const [width, height] of [
      [375, 629],
      [812, 375],
      [320, 568],
    ]) {
      await page.setViewportSize({ width, height });
      await page.locator("#restart-button").scrollIntoViewIfNeeded();
      const b = (await page.locator("#restart-button").boundingBox())!;
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(height);
      await expect(page.getByText("La valle è tua.")).toBeVisible();
      if (width === 812)
        await page.screenshot({
          path: info.outputPath("finish-landscape.png"),
        });
    }
    await page.locator("#restart-button").click();
    await expect(page.locator("#app")).toHaveAttribute("data-status", "flying");
    expect(errors).toEqual([]);
  });
