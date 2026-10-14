// SPDX-License-Identifier: AGPL-3.0-only
import { GamepadReader } from "./core/gamepad";
import type { Settings } from "./core/settings";
import { clamp } from "./core/math";
import { neutralInput, type FlightInput } from "./core/flight";

export type Command =
  | "pause"
  | "camera"
  | "respawn"
  | "help"
  | "poi"
  | "confirm"
  | "next"
  | "previous"
  | "left"
  | "right";
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
  activeInput: "keyboard" | "touch" | "gamepad" = matchMedia(
    "(pointer: coarse)",
  ).matches
    ? "touch"
    : "keyboard";
  readonly gamepad = new GamepadReader();
  private padInput = neutralInput();
  get controllerLabel() {
    return this.gamepad.label;
  }
  constructor(
    private onCommand: (command: Command) => void,
    private onBlur: () => void,
    private settings: Settings,
  ) {
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
        this.activeInput = "keyboard";
      }
      if (event.repeat) return;
      if (event.code === "Escape" || event.code === "KeyP") onCommand("pause");
      if (event.code === "KeyC") onCommand("camera");
      if (event.code === "KeyX") onCommand("respawn");
      if (event.code === "KeyI") onCommand("poi");
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
    window.addEventListener("resize", () => this.clear());
    window.addEventListener("gamepadconnected", () => this.pollGamepad());
    window.addEventListener("gamepaddisconnected", (event) => {
      if (
        this.gamepad.identity !== `${event.gamepad.index}:${event.gamepad.id}`
      )
        return;
      this.gamepad.poll([], this.settings);
      this.clear();
      this.activeInput = matchMedia("(pointer: coarse)").matches
        ? "touch"
        : "keyboard";
      if (this.enabled) this.onBlur();
    });
    this.connectStick("move-stick", "move");
    this.connectStick("look-stick", "look");
    this.connectHold("brake-button", (held) => {
      this.touchBrake = held;
      if (held) this.setBoost(false);
    });
    const boost = document.getElementById("boost-button")!;
    boost.addEventListener("pointerdown", (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      this.activeInput = "touch";
      this.setBoost(!this.touchBoost);
    });
    boost.addEventListener("click", (event) => {
      if (event.detail === 0 && this.enabled) this.setBoost(!this.touchBoost);
    });
    boost.addEventListener("pointercancel", () => this.setBoost(false));
  }
  pollGamepad() {
    try {
      if (!navigator.getGamepads) {
        this.gamepad.label =
          "Gamepad API non disponibile (usa HTTPS o localhost)";
        return;
      }
      const result = this.gamepad.poll(
        Array.from(navigator.getGamepads()),
        this.settings,
      );
      this.padInput = result.input;
      if (result.changed && !this.gamepad.identity)
        this.activeInput = matchMedia("(pointer: coarse)").matches
          ? "touch"
          : "keyboard";
      if (result.changed && this.enabled) {
        this.clear();
        this.onBlur();
      }
      if (result.active) this.activeInput = "gamepad";
      for (const command of result.commands) this.onCommand(command);
    } catch {
      const wasConnected = !!this.gamepad.identity;
      this.padInput = neutralInput();
      this.gamepad.poll([], this.settings);
      if (wasConnected && this.enabled) this.onBlur();
      this.gamepad.label =
        "Controller non accessibile in questo browser o contesto";
    }
  }
  clear() {
    this.padInput = neutralInput();
    this.gamepad.disarm();
    this.keys.clear();
    for (const release of this.releases) release();
    this.touchBrake = false;
    this.setBoost(false);
  }
  read(): FlightInput {
    if (!this.enabled) return neutralInput();
    if (this.keys.size) this.activeInput = "keyboard";
    else if (
      this.touchBrake ||
      this.touchBoost ||
      Object.values(this.sticks).some((s) => s.x || s.y)
    )
      this.activeInput = "touch";
    const key = (...codes: string[]) =>
      codes.some((code) => this.keys.has(code)) ? 1 : 0;
    const input = {
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
    // Explicit keyboard/touch wins per axis; brake always wins in the simulation.
    for (const axis of ["forward", "right", "up", "yaw"] as const) {
      input[axis] = input[axis]
        ? clamp(input[axis] * this.settings.sensitivity, -1, 1)
        : this.padInput[axis];
    }
    input.brake ||= this.padInput.brake;
    input.boost = !input.brake && (input.boost || this.padInput.boost);
    return input;
  }
  private setBoost(active: boolean) {
    this.touchBoost = active;
    const button = document.getElementById("boost-button")!;
    button.classList.toggle("held", active);
    button.setAttribute("aria-pressed", String(active));
    button.textContent = active ? "BOOST ON" : "BOOST ↑";
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
      if (axis === "move") this.setBoost(false);
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
      this.activeInput = "touch";
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
      this.activeInput = "touch";
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
