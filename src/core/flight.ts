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
  yaw = 0;
  status: FlightStatus = "ready";
  nextCheckpoint = 0;
  elapsed = 0;
  penalties = 0;
  crashes = 0;
  crashReason = "";
  private accumulator = 0;
  private resumeStatus: "flying" | "crashed" = "flying";
  constructor(
    readonly terrain: TerrainProvider,
    readonly checkpoints: Checkpoint[],
    readonly obstacles: Obstacle[],
  ) {}
  get speed() {
    return Math.hypot(this.velocity.x, this.velocity.y, this.velocity.z);
  }
  get altitude() {
    return (
      this.position.y -
      Math.max(
        WATER_LEVEL,
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
    this.position = { x: 28, y: 12, z: 180 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
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
    this.elapsed += dt;
    const old = { ...this.position };
    const turn = clamp(input.yaw, -1, 1);
    this.yaw -= turn * 1.4 * dt;
    const speed = input.boost ? 34 : 21;
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
          y: clamp(input.up, -1, 1) * 11,
          z:
            (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * right) *
            speed,
        };
    const blend = 1 - Math.exp(-(input.brake ? 10 : 3) * dt);
    for (const axis of ["x", "y", "z"] as const) {
      this.velocity[axis] += (target[axis] - this.velocity[axis]) * blend;
      this.position[axis] += this.velocity[axis] * dt;
    }
    if (this.position.y > CEILING) {
      this.position.y = CEILING;
      this.velocity.y = Math.min(0, this.velocity.y);
    }
    if (
      Math.abs(this.position.x) > WORLD_LIMIT ||
      Math.abs(this.position.z) > WORLD_LIMIT
    ) {
      this.position.x = clamp(this.position.x, -WORLD_LIMIT, WORLD_LIMIT);
      this.position.z = clamp(this.position.z, -WORLD_LIMIT, WORLD_LIMIT);
      this.velocity.x = 0;
      this.velocity.z = 0;
    }
    const floor = Math.max(
      WATER_LEVEL,
      this.terrain.heightAt(this.position.x, this.position.z),
    );
    if (this.position.y - BODY_RADIUS <= floor)
      return this.collide(
        floor === WATER_LEVEL
          ? "Contatto con l’acqua"
          : "Contatto con il terreno",
      );
    for (const tree of this.obstacles) {
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
      )
        return this.collide("Contatto con un albero");
    }
    const gate = this.checkpoints[this.nextCheckpoint];
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
