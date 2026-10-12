/**
 * Procedural Web Audio Engine for Car Driving Simulator (Phase 7).
 * Real-time dynamic engine RPM synthesis, tire squeal / skid filtering,
 * collision impact bursts, turn signal relay clicks, and vehicle horn.
 */
export class ProceduralVehicleAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private squealGain: GainNode | null = null;
  private squealFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private isInitialized = false;
  private isMuted = false;

  public init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.65, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // --- ENGINE SOUND GENERATOR ---
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
      this.engineFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

      // Osc 1: Deep sawtooth cylinder pulses
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.setValueAtTime(48, this.ctx.currentTime);

      // Osc 2: Harmonic body rumble
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.setValueAtTime(72, this.ctx.currentTime);

      const oscMix = this.ctx.createGain();
      oscMix.gain.setValueAtTime(0.5, this.ctx.currentTime);

      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineOsc1.start();
      this.engineOsc2.start();

      // --- TIRE SQUEAL / SKID SOUND ---
      this.squealGain = this.ctx.createGain();
      this.squealGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

      this.squealFilter = this.ctx.createBiquadFilter();
      this.squealFilter.type = 'bandpass';
      this.squealFilter.frequency.setValueAtTime(1750, this.ctx.currentTime);
      this.squealFilter.Q.setValueAtTime(5.0, this.ctx.currentTime);

      // 2 seconds looping white noise buffer
      const bufferSize = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this.noiseSource = this.ctx.createBufferSource();
      this.noiseSource.buffer = this.noiseBuffer;
      this.noiseSource.loop = true;
      this.noiseSource.connect(this.squealFilter);
      this.squealFilter.connect(this.squealGain);
      this.squealGain.connect(this.masterGain);
      this.noiseSource.start();

      this.isInitialized = true;
    } catch (err) {
      console.warn('[VehicleAudio] Web Audio initialization deferred:', err);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended' && !muted) {
      this.ctx.resume();
    }
    const target = muted ? 0 : 0.65;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  public update(speedKmh: number, throttle: number, isBraking: boolean, isSkidding: boolean) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const t = this.ctx.currentTime;
    const speedRatio = Math.min(speedKmh / 130, 1.0);

    // Dynamic Engine Pitch
    const baseFreq = 48 + speedRatio * 160 + throttle * 28;
    this.engineOsc1?.frequency.setTargetAtTime(baseFreq, t, 0.08);
    this.engineOsc2?.frequency.setTargetAtTime(baseFreq * 1.5, t, 0.08);

    // Filter opens with speed and acceleration load
    const filterCutoff = 420 + speedRatio * 1800 + throttle * 550;
    this.engineFilter?.frequency.setTargetAtTime(filterCutoff, t, 0.08);

    // Engine volume scales with throttle
    const engineVol = 0.28 + speedRatio * 0.45 + throttle * 0.2;
    this.engineGain?.gain.setTargetAtTime(engineVol, t, 0.08);

    // Tire Squeal Modulation
    const targetSquealVol = isSkidding ? 0.25 : 0.0001;
    this.squealGain?.gain.setTargetAtTime(targetSquealVol, t, 0.06);
  }

  public playCrash(intensity = 1.0) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110 * intensity, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 0.35);

      gain.gain.setValueAtTime(Math.min(0.8 * intensity, 0.95), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 0.42);
    } catch {
      // Audio fallback silent
    }
  }

  public playBlinkerClick() {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1150, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // Audio fallback
    }
  }

  public playHorn() {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(554, now);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain!);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.36);
      osc2.stop(now + 0.36);
    } catch {
      // Audio fallback
    }
  }

  public dispose() {
    try {
      this.engineOsc1?.stop();
      this.engineOsc2?.stop();
      this.noiseSource?.stop();
      this.ctx?.close();
      this.isInitialized = false;
    } catch {
      // Safe cleanup
    }
  }
}
