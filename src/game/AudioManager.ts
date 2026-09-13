/**
 * Procedural audio (docs/08-roadmap-phases.md Phase 5): footsteps,
 * combat SFX, and an ambient drone, all synthesized live via the Web
 * Audio API — oscillators and generated noise buffers, no external
 * sound files, since this project has no audio-authoring pipeline or
 * sound-generation tool available. Same deliberately-untested category
 * as `Game.ts`/`Textures.ts`/every DOM-overlay UI class
 * (docs/11-testing-strategy.md#non-goals) — `AudioContext` doesn't
 * exist in this project's Vitest `node` environment, and "does this
 * sound right" is a human judgment call regardless.
 *
 * Browsers refuse to produce actual sound from an `AudioContext` until
 * a real user gesture has occurred — nodes can be scheduled before
 * that, they just stay silent until `resume()` succeeds. `ensureContext`
 * (called by every sound-playing method) retries the resume every time,
 * so the first genuine player input — a move, which plays a footstep —
 * is what actually wakes audio up, with no separate "click to enable
 * sound" step needed.
 */
export class AudioManager {
  private ctx: AudioContext | undefined;
  private readonly ambientNodes: Array<{ gain: GainNode }> = [];
  private muted = false;

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    for (const { gain } of this.ambientNodes) {
      gain.gain.setTargetAtTime(muted ? 0 : AMBIENT_GAIN, this.ensureContext().currentTime, 0.2);
    }
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private playTone(freq: number, duration: number, type: OscillatorType, peakGain: number): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(peakGain, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.05);
  }

  private playNoiseBurst(duration: number, peakGain: number, lowpassFreq: number): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lowpassFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
  }

  /** A single grid step — a short, dull noise thump. */
  playFootstep(): void {
    this.playNoiseBurst(0.08, 0.12, 300);
  }

  /** Any resolved combat action (attack, ability, item) landing — a generic impact, not yet differentiated by action or damage type. */
  playHit(): void {
    this.playNoiseBurst(0.12, 0.22, 1400);
    this.playTone(130, 0.14, "square", 0.09);
  }

  /** A monster noticing the party and combat starting. */
  playEncounterStinger(): void {
    this.playTone(180, 0.3, "sawtooth", 0.12);
  }

  playVictoryStinger(): void {
    this.playTone(330, 0.12, "triangle", 0.12);
    setTimeout(() => this.playTone(440, 0.18, "triangle", 0.12), 110);
  }

  playDefeatStinger(): void {
    this.playTone(160, 0.35, "sawtooth", 0.14);
    setTimeout(() => this.playTone(110, 0.4, "sawtooth", 0.12), 150);
  }

  playFleeStinger(): void {
    this.playTone(260, 0.18, "triangle", 0.1);
  }

  /**
   * Starts the low ambient drone — two barely-detuned sine oscillators,
   * per Act 1's "quietly wrong" tone (docs/02-setting-and-story.md)
   * rather than anything melodic. Safe to call more than once; only the
   * first call actually starts anything.
   */
  startAmbient(): void {
    if (this.ambientNodes.length > 0) return;
    const ctx = this.ensureContext();
    for (const detune of [0, 7]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = AMBIENT_BASE_FREQ;
      osc.detune.value = detune;
      const gain = ctx.createGain();
      gain.gain.value = this.muted ? 0 : AMBIENT_GAIN;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      this.ambientNodes.push({ gain });
    }
  }
}

const AMBIENT_BASE_FREQ = 55; // low A -- a hum, not a note anyone would call music
const AMBIENT_GAIN = 0.035; // quiet enough to sit under everything else, per pillar 3's "readable at a glance" applied to audio
