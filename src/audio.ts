// SPDX-License-Identifier: AGPL-3.0-only
/** Local synthesis only; no downloads. Created exclusively after a user gesture. */
export class FlightAudio {
  private context?: AudioContext;
  private motor?: OscillatorNode;
  private gain?: GainNode;
  enabled = false;
  async toggle(): Promise<boolean> {
    if (!this.context) {
      this.context = new AudioContext();
      this.motor = this.context.createOscillator();
      this.gain = this.context.createGain();
      this.motor.type = "triangle";
      this.motor.frequency.value = 90;
      this.gain.gain.value = 0;
      this.motor.connect(this.gain).connect(this.context.destination);
      this.motor.start();
    }
    await this.context.resume();
    this.enabled = !this.enabled;
    if (!this.enabled)
      this.gain!.gain.setTargetAtTime(0, this.context.currentTime, 0.08);
    return this.enabled;
  }
  update(speed: number, flying: boolean) {
    if (!this.context || !this.gain || !this.motor) return;
    this.motor.frequency.setTargetAtTime(
      80 + speed * 2.4,
      this.context.currentTime,
      0.1,
    );
    this.gain.gain.setTargetAtTime(
      this.enabled && flying ? 0.025 : 0,
      this.context.currentTime,
      0.1,
    );
  }
  chime() {
    if (!this.enabled || !this.context) return;
    const oscillator = this.context.createOscillator(),
      gain = this.context.createGain(),
      now = this.context.currentTime;
    oscillator.frequency.setValueAtTime(600, now);
    oscillator.frequency.setValueAtTime(900, now + 0.1);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start();
    oscillator.stop(now + 0.4);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
}
