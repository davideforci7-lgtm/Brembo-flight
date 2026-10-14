// SPDX-License-Identifier: AGPL-3.0-only
export type Quality = "auto" | "eco" | "balanced" | "high";
export interface Settings {
  quality: Quality;
  sensitivity: number;
  deadzone: number;
  response: number;
  gamepadLayout: "game" | "mode2";
  touchSize: number;
  touchInset: number;
  showFPS: boolean;
  showMap: boolean;
  motorVolume: number;
  effectsVolume: number;
}
export const defaults: Settings = {
  quality: "auto",
  sensitivity: 1,
  deadzone: 0.12,
  response: 1,
  gamepadLayout: "game",
  touchSize: 1,
  touchInset: 0,
  showFPS: false,
  showMap: false,
  motorVolume: 0.55,
  effectsVolume: 0.65,
};
const ranges = {
  sensitivity: [0.5, 1.5],
  deadzone: [0.04, 0.3],
  response: [1, 2.5],
  touchSize: [0.8, 1.2],
  touchInset: [0, 40],
  motorVolume: [0, 1],
  effectsVolume: [0, 1],
} as const;
export function sanitizeSettings(value: unknown): Settings {
  const out = { ...defaults };
  if (!value || typeof value !== "object") return out;
  const v = value as Record<string, unknown>;
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
    const n = v[key],
      [min, max] = ranges[key];
    if (typeof n === "number" && Number.isFinite(n))
      out[key] = Math.max(min, Math.min(max, n));
  }
  if (["auto", "eco", "balanced", "high"].includes(String(v.quality)))
    out.quality = v.quality as Quality;
  if (v.gamepadLayout === "mode2") out.gamepadLayout = "mode2";
  for (const key of ["showFPS", "showMap"] as const)
    if (typeof v[key] === "boolean") out[key] = v[key];
  return out;
}
export function loadSettings(): Settings {
  try {
    return sanitizeSettings(
      JSON.parse(localStorage.getItem("brembo-settings-v2") || "{}"),
    );
  } catch {
    return { ...defaults };
  }
}
export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(
      "brembo-settings-v2",
      JSON.stringify(sanitizeSettings(settings)),
    );
  } catch {
    /* Optional storage. */
  }
}
