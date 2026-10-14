// SPDX-License-Identifier: AGPL-3.0-only
import { clamp, distance, segmentDistance, type Vec3 } from "./math";
import { crossesCheckpoint, type Checkpoint } from "./course";
import {
  CEILING,
  WATER_LEVEL,
  WORLD_LIMIT,
  type Obstacle,
  type TerrainProvider,
} from "./terrain";

export interface FlightInput {
  forward: number;
  right: number;
  up: number;
  yaw: number;
  boost: boolean;
  brake: boolean;
}
export const neutralInput = (): FlightInput => ({
  forward: 0,
  right: 0,
  up: 0,
  yaw: 0,
  boost: false,
  brake: false,
});
export type FlightProfile = "sport" | "tranquil";
export interface FlightEnvironment {
  spawn: Vec3;
  yaw: number;
  limit: number;
  ceiling: number;
}
const DEMO_ENVIRONMENT: FlightEnvironment = {
  spawn: { x: 28, y: 12, z: 180 },
  yaw: 0,
  limit: WORLD_LIMIT,
  ceiling: CEILING,
};
export type FlightStatus =
  | "ready"
  | "flying"
  | "paused"
  | "crashed"
  | "finished";
export type FlightEvent = "checkpoint" | "finished" | "collision" | null;
const BODY_RADIUS = 0.65;
const FIXED_STEP = 1 / 120;

export class FlightSimulation {
  position: Vec3 = { x: 28, y: 12, z: 180 };
  velocity: Vec3 = { x: 0, y: 0, z: 0 };
  mode: "course" | "explore" = "course";
  profile: FlightProfile = "sport";
  yaw = 0;
  status: FlightStatus = "ready";
  nextCheckpoint = 0;
  elapsed = 0;
  penalties = 0;
  crashes = 0;
  crashReason = "";
  private obstacleCells = new Map<string, Obstacle[]>();
  private accumulator = 0;
  private resumeStatus: "flying" | "crashed" = "flying";
  constructor(
    readonly terrain: TerrainProvider,
    readonly checkpoints: Checkpoint[],
    readonly obstacles: Obstacle[],
    readonly environment: FlightEnvironment = DEMO_ENVIRONMENT,
    private readonly structures?: {
      hit(position: Vec3, radius?: number): unknown;
    },
  ) {
    this.position = { ...environment.spawn };
    this.yaw = environment.yaw;
    for (const obstacle of obstacles) {
      const p = obstacle.position,
        r = obstacle.radius + 1;
      for (
        let x = Math.floor((p.x - r) / 50);
        x <= Math.floor((p.x + r) / 50);
        x++
      )
        for (
          let z = Math.floor((p.z - r) / 50);
          z <= Math.floor((p.z + r) / 50);
          z++
        ) {
          const key = `${x},${z}`,
            cell = this.obstacleCells.get(key) ?? [];
          cell.push(obstacle);
          this.obstacleCells.set(key, cell);
        }
    }
  }
  get speed() {
    return Math.hypot(this.velocity.x, this.velocity.y, this.velocity.z);
  }
  get altitude() {
    return (
      this.position.y -
      Math.max(
        this.terrain.waterAt?.(this.position.x, this.position.z) ?? WATER_LEVEL,
        this.terrain.heightAt(this.position.x, this.position.z),
      )
    );
  }
  get scoreTime() {
    return this.elapsed + this.penalties;
  }
  start() {
    if (this.status === "ready") this.status = "flying";
  }
  pause() {
    if (this.status === "flying" || this.status === "crashed") {
      this.resumeStatus = this.status;
      this.status = "paused";
      this.accumulator = 0;
    }
  }
  resume() {
    if (this.status === "paused") this.status = this.resumeStatus;
  }
  restart() {
    this.position = { ...this.environment.spawn };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.yaw = this.environment.yaw;
    this.nextCheckpoint = 0;
    this.elapsed = 0;
    this.penalties = 0;
    this.crashes = 0;
    this.accumulator = 0;
    this.status = "flying";
    this.crashReason = "";
  }
  respawn() {
    if (this.status !== "crashed" && this.status !== "flying") return;
    if (this.mode === "explore") {
      const crashes = this.crashes;
      this.restart();
      this.crashes = crashes;
      return;
    }
    this.penalties += 5;
    const gate = this.checkpoints[this.nextCheckpoint];
    if (!gate) return;
    this.position = {
      x: gate.position.x - gate.normal.x * 23,
      y: gate.position.y,
      z: gate.position.z - gate.normal.z * 23,
    };
    this.position.y = Math.max(
      this.position.y,
      this.terrain.heightAt(this.position.x, this.position.z) + 5,
    );
    this.yaw = Math.atan2(-gate.normal.x, -gate.normal.z);
    this.velocity = { x: 0, y: 0, z: 0 };
    this.accumulator = 0;
    this.status = "flying";
  }
  update(frameDelta: number, input: FlightInput): FlightEvent {
    if (
      this.status !== "flying" ||
      !Number.isFinite(frameDelta) ||
      frameDelta <= 0
    )
      return null;
    this.accumulator += Math.min(frameDelta, 0.1);
    let event: FlightEvent = null;
    while (this.accumulator >= FIXED_STEP && this.status === "flying") {
      this.accumulator -= FIXED_STEP;
      const nextEvent = this.step(FIXED_STEP, input);
      if (nextEvent) event = nextEvent;
    }
    return event;
  }
  private step(dt: number, input: FlightInput): FlightEvent {
    if (this.mode === "course") this.elapsed += dt;
    const old = { ...this.position };
    const turn = clamp(input.yaw, -1, 1);
    this.yaw -= turn * (this.profile === "tranquil" ? 0.9 : 1.4) * dt;
    // Sport keeps the original flight constants.
    const speed = this.profile === "tranquil" ? 10 : input.boost ? 34 : 21;
    let forward = clamp(input.forward, -1, 1),
      right = clamp(input.right, -1, 1);
    const length = Math.hypot(forward, right);
    if (length > 1) {
      forward /= length;
      right /= length;
    }
    const target = input.brake
      ? { x: 0, y: 0, z: 0 }
      : {
          x:
            (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * right) *
            speed,
          y: clamp(input.up, -1, 1) * (this.profile === "tranquil" ? 6 : 11),
          z:
            (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * right) *
            speed,
        };
    const blend = 1 - Math.exp(-(input.brake ? 10 : 3) * dt);
    for (const axis of ["x", "y", "z"] as const) {
      this.velocity[axis] += (target[axis] - this.velocity[axis]) * blend;
      this.position[axis] += this.velocity[axis] * dt;
    }
    if (this.position.y > this.environment.ceiling) {
      this.position.y = this.environment.ceiling;
      this.velocity.y = Math.min(0, this.velocity.y);
    }
    if (
      Math.abs(this.position.x) > this.environment.limit ||
      Math.abs(this.position.z) > this.environment.limit
    ) {
      this.position.x = clamp(
        this.position.x,
        -this.environment.limit,
        this.environment.limit,
      );
      this.position.z = clamp(
        this.position.z,
        -this.environment.limit,
        this.environment.limit,
      );
      this.velocity.x = 0;
      this.velocity.z = 0;
    }
    const floor = Math.max(
      this.terrain.waterAt?.(this.position.x, this.position.z) ?? WATER_LEVEL,
      this.terrain.heightAt(this.position.x, this.position.z),
    );
    if (this.profile === "tranquil" && this.position.y < floor + 5) {
      // Accessibility assistance only: follow terrain at a minimum clearance.
      this.position.y = floor + 5;
      this.velocity.y = Math.max(0, this.velocity.y);
    }
    if (this.position.y - BODY_RADIUS <= floor)
      return this.collide(
        floor === WATER_LEVEL
          ? "Contatto con l’acqua"
          : "Contatto con il terreno",
      );
    if (this.structures?.hit(this.position, BODY_RADIUS)) {
      if (this.profile === "tranquil") {
        this.position = old;
        this.velocity = { x: 0, y: 0, z: 0 };
        return null;
      }
      return this.collide("Contatto con un edificio");
    }
    for (const tree of this.obstacleCells.get(
      `${Math.floor(this.position.x / 50)},${Math.floor(this.position.z / 50)}`,
    ) ?? []) {
      if (
        Math.abs(this.position.x - tree.position.x) > tree.radius + 1 ||
        Math.abs(this.position.z - tree.position.z) > tree.radius + 1
      )
        continue;
      // A vertical capsule conservatively encloses each visible crown and trunk.
      const closest = {
        x: tree.position.x,
        y: clamp(
          this.position.y,
          tree.position.y,
          tree.position.y + tree.height,
        ),
        z: tree.position.z,
      };
      if (
        segmentDistance(closest, old, this.position) <=
        tree.radius + BODY_RADIUS
      ) {
        if (this.profile === "tranquil") {
          this.position = old;
          this.velocity = { x: 0, y: 0, z: 0 };
          return null;
        }
        return this.collide("Contatto con un albero");
      }
    }
    const gate =
      this.mode === "course"
        ? this.checkpoints[this.nextCheckpoint]
        : undefined;
    if (gate && crossesCheckpoint(old, this.position, gate)) {
      this.nextCheckpoint++;
      if (this.nextCheckpoint === this.checkpoints.length) {
        this.status = "finished";
        return "finished";
      }
      return "checkpoint";
    }
    // A hit on the active ring is a collision, including a swept high-speed pass.
    if (gate) {
      const relative = {
        x: this.position.x - gate.position.x,
        y: this.position.y - gate.position.y,
        z: this.position.z - gate.position.z,
      };
      const plane = relative.x * gate.normal.x + relative.z * gate.normal.z;
      const radial = Math.sqrt(
        Math.max(0, distance(this.position, gate.position) ** 2 - plane ** 2),
      );
      if (Math.hypot(plane, radial - gate.radius) < BODY_RADIUS + 0.23)
        return this.collide("Contatto con l’anello");
    }
    return null;
  }
  private collide(reason: string): FlightEvent {
    this.status = "crashed";
    this.crashes++;
    this.crashReason = reason;
    this.velocity = { x: 0, y: 0, z: 0 };
    this.accumulator = 0;
    return "collision";
  }
}
