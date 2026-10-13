// SPDX-License-Identifier: AGPL-3.0-only
import { clamp } from "./core/math";
import { neutralInput, type FlightInput } from "./core/flight";

export type Command = "pause" | "camera" | "respawn" | "help";
const flightKeys = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyQ",
  "KeyE",
  "KeyR",
  "KeyF",
  "Space",
  "ShiftLeft",
  "ShiftRight",
]);
export class Controls {
  private keys = new Set<string>();
  private sticks = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 } };
  private releases: Array<() => void> = [];
  private touchBrake = false;
  private touchBoost = false;
  enabled = false;
  constructor(onCommand: (command: Command) => void, onBlur: () => void) {
    window.addEventListener("keydown", (event) => {
      if (
        event.target instanceof HTMLElement &&
        ["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)
      )
        return;
      if (
        event.target instanceof HTMLButtonElement &&
        (event.code === "Space" || event.code === "Enter")
      )
        return;
      if (flightKeys.has(event.code) && this.enabled) {
        event.preventDefault();
        this.keys.add(event.code);
      }
      if (event.repeat) return;
      if (event.code === "Escape" || event.code === "KeyP") onCommand("pause");
      if (event.code === "KeyC") onCommand("camera");
      if (event.code === "KeyX") onCommand("respawn");
      if (event.code === "KeyH") onCommand("help");
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.code));
    window.addEventListener("blur", () => {
      this.clear();
      onBlur();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.clear();
        onBlur();
      }
    });
    this.connectStick("move-stick", "move");
    this.connectStick("look-stick", "look");
    this.connectHold("brake-button", (held) => (this.touchBrake = held));
    this.connectHold("boost-button", (held) => (this.touchBoost = held));
  }
  clear() {
    this.keys.clear();
    for (const release of this.releases) release();
    this.touchBrake = this.touchBoost = false;
  }
  read(): FlightInput {
    if (!this.enabled) return neutralInput();
    const key = (...codes: string[]) =>
      codes.some((code) => this.keys.has(code)) ? 1 : 0;
    return {
      forward: clamp(
        key("KeyW", "ArrowUp") - key("KeyS", "ArrowDown") - this.sticks.move.y,
        -1,
        1,
      ),
      right: clamp(
        key("KeyD", "ArrowRight") -
          key("KeyA", "ArrowLeft") +
          this.sticks.move.x,
        -1,
        1,
      ),
      up: clamp(key("KeyR") - key("KeyF") - this.sticks.look.y, -1, 1),
      yaw: clamp(key("KeyE") - key("KeyQ") + this.sticks.look.x, -1, 1),
      brake: !!key("Space") || this.touchBrake,
      boost: !!key("ShiftLeft", "ShiftRight") || this.touchBoost,
    };
  }
  private connectStick(id: string, axis: "move" | "look") {
    const el = document.getElementById(id)!;
    const thumb = el.querySelector<HTMLElement>(".stick-thumb")!;
    let pointer: number | null = null;
    const reset = () => {
      if (pointer !== null && el.hasPointerCapture(pointer))
        el.releasePointerCapture(pointer);
      pointer = null;
      this.sticks[axis] = { x: 0, y: 0 };
      thumb.style.transform = "";
      el.classList.remove("held");
    };
    this.releases.push(reset);
    const move = (event: PointerEvent) => {
      if (pointer !== event.pointerId) return;
      const rect = el.getBoundingClientRect(),
        radius = rect.width * 0.34;
      let x = (event.clientX - rect.left - rect.width / 2) / radius;
      let y = (event.clientY - rect.top - rect.height / 2) / radius;
      const magnitude = Math.hypot(x, y);
      if (magnitude > 1) {
        x /= magnitude;
        y /= magnitude;
      }
      const dead = (n: number) =>
        Math.abs(n) < 0.1 ? 0 : (Math.sign(n) * (Math.abs(n) - 0.1)) / 0.9;
      this.sticks[axis] = { x: dead(x), y: dead(y) };
      thumb.style.transform = `translate(${x * radius}px, ${y * radius}px)`;
    };
    el.addEventListener("pointerdown", (event) => {
      if (!this.enabled || pointer !== null) return;
      event.preventDefault();
      pointer = event.pointerId;
      el.setPointerCapture(pointer);
      el.classList.add("held");
      move(event);
    });
    el.addEventListener("pointermove", move);
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      el.addEventListener(type, (event) => {
        if ((event as PointerEvent).pointerId === pointer) reset();
      });
    }
  }
  private connectHold(id: string, set: (held: boolean) => void) {
    const el = document.getElementById(id)!;
    let pointer: number | null = null;
    const reset = () => {
      if (pointer !== null && el.hasPointerCapture(pointer))
        el.releasePointerCapture(pointer);
      pointer = null;
      set(false);
      el.classList.remove("held");
    };
    this.releases.push(reset);
    el.addEventListener("pointerdown", (event) => {
      if (!this.enabled || pointer !== null) return;
      event.preventDefault();
      pointer = event.pointerId;
      el.setPointerCapture(pointer);
      set(true);
      el.classList.add("held");
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      el.addEventListener(type, (event) => {
        if ((event as PointerEvent).pointerId === pointer) reset();
      });
    }
  }
}
