// SPDX-License-Identifier: AGPL-3.0-only
import type { Quality } from "./settings";
export type Preset = Exclude<Quality, "auto">;
export const PRESETS = {
  eco: { ratio: 1, pixels: 1_250_000, shadows: false },
  balanced: { ratio: 1.5, pixels: 2_200_000, shadows: false },
  high: { ratio: 2, pixels: 4_200_000, shadows: true },
} as const;
export function renderSize(
  width: number,
  height: number,
  dpr: number,
  preset: Preset,
) {
  const w = Math.max(1, width),
    h = Math.max(1, height),
    p = PRESETS[preset];
  const ratio = Math.min(
    Math.max(1, dpr),
    p.ratio,
    Math.sqrt(p.pixels / (w * h)),
  );
  return {
    width: Math.max(1, Math.floor(w * ratio)),
    height: Math.max(1, Math.floor(h * ratio)),
    ratio,
  };
}
/** An eight-second observation window, never a hardware performance guarantee. */
export class GraphicsGovernor {
  preset: Preset;
  fps = 0;
  private seconds = 0;
  private frames = 0;
  private slowSeconds = 0;
  constructor(
    public choice: Quality,
    private compact: boolean,
  ) {
    this.preset = choice === "auto" ? (compact ? "eco" : "balanced") : choice;
  }
  select(choice: Quality) {
    this.choice = choice;
    this.preset =
      choice === "auto" ? (this.compact ? "eco" : "balanced") : choice;
    this.seconds = this.frames = this.slowSeconds = 0;
  }
  observe(dt: number, active: boolean) {
    if (!active || !Number.isFinite(dt) || dt <= 0 || dt > 2) {
      this.seconds = this.frames = this.slowSeconds = 0;
      return false;
    }
    this.seconds += dt;
    this.frames++;
    if (this.seconds < 1) return false;
    this.fps = this.frames / this.seconds;
    this.slowSeconds = this.fps < 42 ? this.slowSeconds + this.seconds : 0;
    this.seconds = this.frames = 0;
    if (
      this.choice === "auto" &&
      this.preset !== "eco" &&
      this.slowSeconds >= 8
    ) {
      this.preset = "eco";
      this.slowSeconds = 0;
      return true;
    }
    return false;
  }
}
