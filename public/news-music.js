// Original instrumental news bed, composed locally. No external audio or licensing.
// Radio bulletin bed: a clear clock-like pulse, bass, light percussion and arpeggios.
export const MUSIC_REVISION = 2;
export const MUSIC_DEFAULT_VOLUME = 30;
export function musicPreferences(input) {
  const validVolume = Number.isFinite(input?.volume);
  const previous = validVolume ? Math.max(0, Math.min(100, input.volume)) : MUSIC_DEFAULT_VOLUME;
  return { enabled: input?.enabled !== false, volume: validVolume && input?.revision !== MUSIC_REVISION && previous > 0 ? Math.min(100, previous + 12) : previous, revision: MUSIC_REVISION };
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
      this.output.gain.value = 0; this.output.connect(this.context.destination);
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
  schedule() {
    if (!this.playing || !this.enabled) return;
    const chords = [[50, 53, 57], [46, 50, 53], [41, 45, 48], [48, 52, 55]];
    const eighth = 60 / 112 / 2;
    const arpeggio = [0, 1, 2, 1, 0, 2, 1, 2];
    while (this.nextTime < this.context.currentTime + .2) {
      const chord = chords[Math.floor(this.step / 16) % chords.length];
      if (this.step % 16 === 0) {
        chord.forEach(note => this.tone(note, this.nextTime, eighth * 15.8, .038, 'sine', .08));
      }
      this.tone(chord[arpeggio[this.step % 8]] + 12, this.nextTime, eighth * .8, this.step % 2 === 0 ? .045 : .025, 'triangle', .01);
      if (this.step % 2 === 0) {
        this.tone(chord[0] - 12, this.nextTime, eighth * 1.65, .075, 'triangle', .012);
        this.tone(36, this.nextTime, .11, this.step % 8 === 0 ? .06 : .035, 'sine', .005);
      }
      this.percussion(this.nextTime, .045, this.step % 2 === 0 ? .014 : .009);
      if (this.step % 8 === 2 || this.step % 8 === 6) this.percussion(this.nextTime, .1, .025, true);
      this.step++; this.nextTime += eighth;
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
