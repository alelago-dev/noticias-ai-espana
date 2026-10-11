// Short phrases let Web Speech change rate without cancelling or repeating speech.
// This also works on mobile voices that do not emit word-boundary events.
export function speechPhrases(text, maxLength = 100) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const phrases = [];
  let phrase = '';
  for (const word of words) {
    if (phrase && phrase.length + word.length + 1 > maxLength) { phrases.push(phrase); phrase = ''; }
    phrase += (phrase ? ' ' : '') + word;
    if (/[.!?;:]$/.test(word) && phrase.length >= 25) { phrases.push(phrase); phrase = ''; }
  }
  if (phrase) phrases.push(phrase);
  return phrases;
}

export class NewsPlayer {
  constructor({ engine, makeUtterance, onChange = () => {}, onError = () => {} }) {
    this.engine = engine; this.makeUtterance = makeUtterance;
    this.onChange = onChange; this.onError = onError;
    this.tracks = []; this.index = 0; this.phrase = 0;
    this.status = 'idle'; this.rate = 1; this.generation = 0; this.utterance = null;
  }
  get snapshot() {
    const count = this.tracks.length;
    return { status: this.status, index: this.index, count, rate: this.rate,
      pendingRate: !!this.utterance && this.utterance.rate !== this.rate,
      progress: count ? Math.min(1, (this.index + this.phrase / (this.tracks[this.index]?.length || 1)) / count) : 0 };
  }
  emit() { this.onChange(this.snapshot); }
  cancel() { this.generation++; this.engine.cancel(); if (this.engine.paused) this.engine.resume(); this.utterance = null; }
  load(texts) { this.stop(); this.tracks = texts.map(text => speechPhrases(text)); this.index = 0; this.phrase = 0; }
  stop() { this.cancel(); this.status = 'idle'; this.emit(); }
  setRate(rate) { if (Number.isFinite(Number(rate)) && Number(rate) >= .5 && Number(rate) <= 2) this.rate = Number(rate); this.emit(); }
  play(index) {
    if (Number.isInteger(index)) return this.jump(index);
    if (this.status === 'paused') { this.engine.resume(); this.status = 'playing'; this.emit(); if (!this.utterance) this.speak(); }
    else if (this.status !== 'playing') this.jump(this.status === 'finished' ? 0 : this.index);
  }
  pause() { if (this.status !== 'playing') return; this.engine.pause(); this.status = 'paused'; this.emit(); }
  jump(index) {
    this.cancel(); this.index = Math.max(0, index); this.phrase = 0;
    if (this.index >= this.tracks.length) return this.finish();
    this.status = 'playing'; this.speak();
  }
  next() { this.jump(this.index + 1); }
  previous() { this.jump(this.index - 1); }
  finish() { this.utterance = null; this.index = this.tracks.length; this.status = 'finished'; this.emit(); }
  speak() {
    if (this.status !== 'playing') return;
    const text = this.tracks[this.index]?.[this.phrase];
    if (!text) {
      this.index++; this.phrase = 0;
      if (this.index >= this.tracks.length) return this.finish();
      return this.speak();
    }
    const token = this.generation;
    const utterance = this.makeUtterance(text);
    this.utterance = utterance; utterance.lang = 'es-ES'; utterance.rate = this.rate;
    const voices = this.engine.getVoices();
    utterance.voice = voices.find(v => v.lang === 'es-ES') || voices.find(v => v.lang.startsWith('es')) || null;
    utterance.onstart = () => { if (token === this.generation) this.emit(); };
    utterance.onend = () => {
      if (token !== this.generation) return;
      this.utterance = null; this.phrase++;
      if (this.phrase >= this.tracks[this.index].length) { this.index++; this.phrase = 0; }
      if (this.index >= this.tracks.length) this.finish();
      else { this.emit(); this.speak(); }
    };
    utterance.onerror = () => {
      if (token !== this.generation) return;
      this.stop(); this.onError();
    };
    this.emit(); this.engine.speak(utterance);
  }
}
