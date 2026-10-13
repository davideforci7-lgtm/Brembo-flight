// SPDX-License-Identifier: AGPL-3.0-only
import { neutralInput, type FlightInput } from "./flight";
import { clamp } from "./math";
import type { Settings } from "./settings";
export type PadCommand =
  | "camera"
  | "pause"
  | "confirm"
  | "next"
  | "previous"
  | "left"
  | "right";
export interface PadSnapshot {
  id: string;
  index: number;
  mapping: string;
  connected: boolean;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}
const safe = (n: number | undefined) =>
  Number.isFinite(n) ? clamp(n!, -1, 1) : 0;
/** Radial deadzone: no jump at the boundary; full stick still reaches full speed. */
export function analogStick(
  x: number,
  y: number,
  deadzone: number,
  response: number,
  sensitivity: number,
) {
  x = safe(x);
  y = safe(y);
  const length = Math.hypot(x, y);
  if (length <= deadzone) return { x: 0, y: 0 };
  const gain = Math.min(
    1,
    Math.pow((Math.min(1, length) - deadzone) / (1 - deadzone), response) *
      sensitivity,
  );
  return { x: (x / length) * gain, y: (y / length) * gain };
}
/** Pure adapter. Never infer vendor-specific axis mappings from a controller name. */
export class GamepadReader {
  identity = "";
  label = "Premi un tasto sul controller per collegarlo";
  armed = false;
  private previous: boolean[] = [];
  disarm() {
    this.armed = false;
  }
  poll(pads: readonly (PadSnapshot | null)[], settings: Settings) {
    const available = pads.filter(
      (p): p is PadSnapshot => !!p?.connected && p.mapping === "standard",
    );
    const pad =
      available.find((p) => `${p.index}:${p.id}` === this.identity) ??
      available[0];
    const identity = pad ? `${pad.index}:${pad.id}` : "";
    const changed = identity !== this.identity;
    if (changed) {
      this.identity = identity;
      this.armed = false;
      this.previous = [];
    }
    const result: {
      input: FlightInput;
      commands: PadCommand[];
      changed: boolean;
      active: boolean;
    } = { input: neutralInput(), commands: [], changed, active: false };
    if (!pad) {
      this.label = pads.some((p) => p?.connected)
        ? "Mappatura non standard: usa tastiera o touch"
        : "Premi un tasto sul controller per collegarlo";
      return result;
    }
    const buttons = pad.buttons.map((b) => b.pressed || b.value > 0.5);
    const left = analogStick(
      pad.axes[0],
      pad.axes[1],
      settings.deadzone,
      settings.response,
      settings.sensitivity,
    );
    const right = analogStick(
      pad.axes[2],
      pad.axes[3],
      settings.deadzone,
      settings.response,
      settings.sensitivity,
    );
    if (!this.armed) {
      // Returning from background or plugging a held stick never launches the drone.
      this.armed =
        !left.x && !left.y && !right.x && !right.y && !buttons.some(Boolean);
      this.previous = buttons;
      this.label = this.armed ? pad.id : `${pad.id} · rilascia stick e tasti`;
      return result;
    }
    this.label = pad.id;
    const mapping: [number, PadCommand][] = [
      [3, "camera"],
      [9, "pause"],
      [0, "confirm"],
      [12, "previous"],
      [13, "next"],
      [14, "left"],
      [15, "right"],
    ];
    for (const [index, command] of mapping)
      if (buttons[index] && !this.previous[index])
        result.commands.push(command);
    this.previous = buttons;
    const move = settings.gamepadLayout === "mode2" ? right : left;
    const look = settings.gamepadLayout === "mode2" ? left : right;
    result.input = {
      forward: -move.y,
      right: move.x,
      up: -look.y,
      yaw: look.x,
      brake: buttons[6] || buttons[4] || false,
      boost: buttons[7] || buttons[5] || false,
    };
    result.active = !!(
      move.x ||
      move.y ||
      look.x ||
      look.y ||
      buttons.some(Boolean)
    );
    return result;
  }
}
