// Original instrumental news bed, composed locally. No external audio or licensing.
// Broadcast theme: brass accents, a driving clock pulse and newsroom percussion.
export const MUSIC_REVISION = 3;
export const MUSIC_DEFAULT_VOLUME = 38;
export function musicPreferences(input) {
  const validVolume = Number.isFinite(input?.volume);
  const previous = validVolume ? Math.max(0, Math.min(100, input.volume)) : MUSIC_DEFAULT_VOLUME;
  return { enabled: input?.enabled !== false, volume: validVolume && input?.revision !== MUSIC_REVISION && previous > 0 ? Math.min(100, previous + 8) : previous, revision: MUSIC_REVISION };
}
export class NewsMusic {
  constructor({ enabled = true, volume = MUSIC_DEFAULT_VOLUME } = {}) {
    this.enabled = enabled; this.volume = Math.max(0, Math.min(100, Number(volume) || 0));
    this.context = null; this.output = null; this.timer = null; this.nodes = new Set();
    this.playing = false; this.step = 0;
  }
  unlock() {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return false;
    if (!this.context) {
      this.context = new Context(); this.output = this.context.createGain();
      this.output.gain.value = 0;
      this.limiter = this.context.createDynamicsCompressor();
      this.limiter.threshold.value = -8; this.limiter.knee.value = 6;
      this.limiter.ratio.value = 8; this.limiter.attack.value = .003; this.limiter.release.value = .12;
      this.output.connect(this.limiter); this.limiter.connect(this.context.destination);
      this.noiseBuffer = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let seed = 20261011;
      for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
    }
    this.context.resume().catch(() => {});
    return true;
  }
  tone(midi, time, duration, amplitude, type = 'sine', attack = .04) {
    const ctx = this.context, oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = type; oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(amplitude, time + Math.min(attack, duration / 4));
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(gain); gain.connect(this.output);
    this.nodes.add(oscillator);
    oscillator.onended = () => { this.nodes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(time); oscillator.stop(time + duration + .05);
  }
  percussion(time, duration, amplitude, snare = false) {
    const ctx = this.context, source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = snare ? 'bandpass' : 'highpass'; filter.frequency.value = snare ? 1800 : 6500; filter.Q.value = .6;
    gain.gain.setValueAtTime(amplitude, time); gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.output); this.nodes.add(source);
    source.onended = () => { this.nodes.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(time); source.stop(time + duration + .02);
  }
  brass(midi, time, duration, amplitude) {
    const ctx = this.context, oscillator = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    oscillator.type = 'sawtooth'; oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    filter.type = 'lowpass'; filter.Q.value = .7;
    filter.frequency.setValueAtTime(700, time);
    filter.frequency.linearRampToValueAtTime(2400, time + .025);
    filter.frequency.exponentialRampToValueAtTime(650, time + duration);
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(amplitude, time + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(filter); filter.connect(gain); gain.connect(this.output); this.nodes.add(oscillator);
    oscillator.onended = () => { this.nodes.delete(oscillator); oscillator.disconnect(); filter.disconnect(); gain.disconnect(); };
    oscillator.start(time); oscillator.stop(time + duration + .02);
  }
  drum(time, amplitude, frequency = 115, duration = .16) {
    const ctx = this.context, oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(45, time + duration);
    gain.gain.setValueAtTime(amplitude, time); gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(gain); gain.connect(this.output); this.nodes.add(oscillator);
    oscillator.onended = () => { this.nodes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(time); oscillator.stop(time + duration + .02);
  }
  schedule() {
    if (!this.playing || !this.enabled) return;
    const chords = [[50, 53, 57], [46, 50, 53], [41, 45, 48], [48, 52, 55]];
    const sixteenth = 60 / 126 / 4;
    const ostinato = [0, 2, 1, 2, 0, 2, 1, 2];
    while (this.nextTime < this.context.currentTime + .2) {
      const chord = chords[Math.floor(this.step / 32) % chords.length], beat = this.step % 16;
      // Short brass chords replace the sustained, ambient pad.
      if (beat === 0 || beat === 10) {
        chord.forEach(note => this.brass(note + 12, this.nextTime, sixteenth * (beat === 0 ? 3.3 : 1.5), beat === 0 ? .019 : .012));
      }
      // A brief four-note opening signature, then a quieter continuous pulse.
      if (this.step < 32 && this.step % 4 === 0) {
        const motif = [74, 69, 72, 74, 77, 76, 72, 74];
        this.brass(motif[Math.floor(this.step / 4)], this.nextTime, sixteenth * 3.2, .024);
      }
      if (this.step % 2 === 0) {
        this.tone(chord[ostinato[Math.floor(this.step / 2) % 8]] + 24, this.nextTime, sixteenth * 1.3, beat % 4 === 0 ? .027 : .017, 'triangle', .004);
      }
      if (beat % 4 === 0 || beat === 14) {
        this.tone(chord[0] - 12, this.nextTime, sixteenth * 2.5, .07, 'triangle', .005);
        this.drum(this.nextTime, beat === 0 ? .08 : .055);
      }
      this.percussion(this.nextTime, .035, beat % 4 === 0 ? .014 : .007);
      if (beat === 4 || beat === 12) this.percussion(this.nextTime, .12, .046, true);
      if (this.step % 64 >= 60 && this.step % 2 === 0) this.drum(this.nextTime, .035, this.step % 64 === 60 ? 190 : 145, .12);
      this.step++; this.nextTime += sixteenth;
    }
  }
  mix() {
    if (!this.output) return;
    const t = this.context.currentTime;
    this.output.gain.cancelScheduledValues(t);
    this.output.gain.setTargetAtTime(this.playing && this.enabled ? this.volume / 100 : 0, t, .08);
  }
  start() {
    if (!this.enabled || !this.unlock()) return;
    this.playing = true;
    if (!this.timer) { this.nextTime = this.context.currentTime + .05; this.schedule(); this.timer = setInterval(() => this.schedule(), 100); }
    this.mix();
  }
  pause() {
    this.playing = false; clearInterval(this.timer); this.timer = null; this.mix();
    for (const node of this.nodes) { try { node.stop(this.context.currentTime + .25); } catch {} }
  }
  setEnabled(value) { this.enabled = Boolean(value); if (!this.enabled) this.pause(); }
  setVolume(value) { this.volume = Math.max(0, Math.min(100, Number(value) || 0)); this.mix(); }
}
