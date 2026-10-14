// SPDX-License-Identifier: AGPL-3.0-only
import type { Settings } from "./core/settings";
/** Original procedural audio. No samples, network requests or music playback. */
export class FlightAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private motors?: GainNode;
  private wind?: GainNode;
  private effects?: GainNode;
  private windFilter?: BiquadFilterNode;
  private oscillators: OscillatorNode[] = [];
  private boosted = false;
  enabled = false;
  constructor(private settings: Settings) {}
  async toggle(): Promise<boolean> {
    if (this.enabled) {
      this.enabled = false;
      this.master?.gain.setTargetAtTime(0, this.context!.currentTime, 0.04);
      return false;
    }
    if (!this.context) this.create();
    await this.context!.resume();
    this.enabled = this.context!.state === "running";
    this.master!.gain.setTargetAtTime(
      this.enabled ? 0.65 : 0,
      this.context!.currentTime,
      0.12,
    );
    return this.enabled;
  }
  async resume() {
    if (
      this.enabled &&
      this.context &&
      this.context.state !== "running" &&
      this.context.state !== "closed"
    )
      await this.context.resume();
  }
  private create() {
    const context = (this.context = new AudioContext());
    this.master = context.createGain();
    this.master.gain.value = 0;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.ratio.value = 6;
    this.master.connect(limiter).connect(context.destination);
    this.motors = context.createGain();
    this.motors.gain.value = 0;
    this.motors.connect(this.master);
    this.effects = context.createGain();
    this.effects.connect(this.master);
    const rotorFilter = context.createBiquadFilter();
    rotorFilter.type = "lowpass";
    rotorFilter.frequency.value = 1100;
    rotorFilter.Q.value = 0.3;
    rotorFilter.connect(this.motors);
    for (let i = 0; i < 4; i++) {
      const oscillator = context.createOscillator(),
        gain = context.createGain();
      oscillator.type = i % 2 ? "sine" : "triangle";
      oscillator.frequency.value = 105 + i * 2.7;
      gain.gain.value = 0.13;
      oscillator.connect(gain).connect(rotorFilter);
      oscillator.start();
      this.oscillators.push(oscillator);
    }
    // One reusable two-second noise buffer, filtered into a soft wind layer.
    const buffer = context.createBuffer(
        1,
        context.sampleRate * 2,
        context.sampleRate,
      ),
      samples = buffer.getChannelData(0);
    let previous = 0,
      seed = 721;
    for (let i = 0; i < samples.length; i++) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      previous = (previous + ((seed / 4294967296) * 2 - 1) * 0.08) / 1.08;
      samples[i] = previous * 3;
    }
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    this.windFilter = context.createBiquadFilter();
    this.windFilter.type = "lowpass";
    this.windFilter.frequency.value = 500;
    this.wind = context.createGain();
    this.wind.gain.value = 0;
    noise.connect(this.windFilter).connect(this.wind).connect(this.master);
    noise.start();
  }
  update(speed: number, flying: boolean, thrust = 0, boost = false) {
    if (!this.context || !this.motors || !this.wind || !this.effects) return;
    const now = this.context.currentTime,
      power = Math.min(1, (speed / 34) * 0.65 + Math.abs(thrust) * 0.35);
    const audible = this.enabled && flying;
    this.motors.gain.setTargetAtTime(
      audible ? this.settings.motorVolume * (0.07 + power * 0.07) : 0,
      now,
      0.16,
    );
    this.wind.gain.setTargetAtTime(
      audible
        ? this.settings.motorVolume *
            Math.pow(Math.min(1, speed / 34), 1.5) *
            0.3
        : 0,
      now,
      0.25,
    );
    this.effects.gain.setTargetAtTime(this.settings.effectsVolume, now, 0.06);
    this.windFilter!.frequency.setTargetAtTime(350 + speed * 35, now, 0.2);
    this.oscillators.forEach((osc, i) =>
      osc.frequency.setTargetAtTime(
        105 + i * 2.7 + power * 115 + (boost ? 16 : 0),
        now,
        0.15,
      ),
    );
    if (audible && boost && !this.boosted) this.cue("boost");
    this.boosted = audible && boost;
  }
  cue(kind: "checkpoint" | "collision" | "boost" | "finish") {
    if (!this.enabled || !this.context || !this.effects) return;
    const notes =
      kind === "finish"
        ? [523, 659, 784, 1046]
        : kind === "checkpoint"
          ? [660, 880]
          : kind === "boost"
            ? [180, 270]
            : [90, 45];
    const now = this.context.currentTime;
    notes.forEach((frequency, i) => {
      const oscillator = this.context!.createOscillator(),
        gain = this.context!.createGain();
      const start = now + i * 0.09,
        end = start + 0.23;
      oscillator.type = kind === "collision" ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(
        kind === "boost" ? 0.025 : 0.11,
        start + 0.012,
      );
      gain.gain.exponentialRampToValueAtTime(0.001, end);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(start);
      oscillator.stop(end + 0.01);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }
}
