// Original instrumental news bed, composed locally. No external audio or licensing.
// Low, sustained harmony plus a restrained pulse, mixed independently of narration.
export class NewsMusic {
  constructor({ enabled = true, volume = 18 } = {}) {
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
    }
    this.context.resume().catch(() => {});
    return true;
  }
  tone(midi, time, duration, amplitude, type = 'sine') {
    const ctx = this.context, oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = type; oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(amplitude, time + Math.min(.08, duration / 4));
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(gain); gain.connect(this.output);
    this.nodes.add(oscillator);
    oscillator.onended = () => { this.nodes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(time); oscillator.stop(time + duration + .05);
  }
  schedule() {
    if (!this.playing || !this.enabled) return;
    const chords = [[52, 55, 59], [48, 52, 55], [43, 47, 50], [50, 54, 57]];
    const beat = 60 / 96;
    while (this.nextTime < this.context.currentTime + .2) {
      const chord = chords[Math.floor(this.step / 8) % chords.length];
      if (this.step % 8 === 0) {
        chord.forEach(note => this.tone(note, this.nextTime, beat * 7.9, .045));
        this.tone(chord[0] - 12, this.nextTime, beat * 7.8, .05);
      }
      this.tone(chord[this.step % 3] + 12, this.nextTime, beat * .8, .022, 'triangle');
      this.tone(36, this.nextTime, .12, this.step % 2 === 0 ? .025 : .012);
      this.step++; this.nextTime += beat;
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
