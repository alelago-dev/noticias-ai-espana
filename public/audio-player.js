// Breath groups let Web Speech change rate without cancelling or repeating speech.
// This also works on mobile voices that do not emit word-boundary events.
export function speechPhrases(text, maxLength = 240) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const phrases = [];
  let phrase = '';
  for (const word of words) {
    if (phrase && phrase.length + word.length + 1 > maxLength) { phrases.push(phrase); phrase = ''; }
    phrase += (phrase ? ' ' : '') + word;
    const sentenceEnd = /[.!?;:]$/.test(word) && !/^(?:[A-ZÁÉÍÓÚÑ]\.|Sr\.|Sra\.|Dr\.|Dra\.|EE\.|UU\.)$/.test(word);
    if (sentenceEnd || /,$/.test(word) && phrase.length >= Math.min(120, maxLength)) { phrases.push(phrase); phrase = ''; }
  }
  if (phrase) phrases.push(phrase);
  return phrases;
}

export class NewsPlayer {
  constructor({ engine, makeUtterance, chooseVoice, onChange = () => {}, onError = () => {} }) {
    this.engine = engine; this.makeUtterance = makeUtterance;
    this.onChange = onChange; this.onError = onError;
    this.chooseVoice = chooseVoice || ((_index, voices) => voices.find(v => v.lang === 'es-ES') || voices.find(v => v.lang.startsWith('es')) || null);
    this.tracks = []; this.index = 0; this.phrase = 0;
    this.status = 'idle'; this.rate = 1; this.generation = 0; this.utterance = null;
    this.trackVoice = null; this.voiceAssigned = false; this.previewing = false;
  }
  get snapshot() {
    const count = this.tracks.length;
    return { status: this.status, index: this.index, count, rate: this.rate, previewing: this.previewing, voiceName: this.trackVoice?.name || '',
      pendingRate: !!this.utterance && this.utterance.rate !== this.rate,
      progress: count ? Math.min(1, (this.index + this.phrase / (this.tracks[this.index]?.length || 1)) / count) : 0 };
  }
  emit() { this.onChange(this.snapshot); }
  cancel() { this.generation++; this.engine.cancel(); if (this.engine.paused) this.engine.resume(); this.utterance = null; this.previewing = false; }
  load(texts) { this.stop(); this.tracks = texts.map(text => speechPhrases(text)); this.index = 0; this.phrase = 0; this.trackVoice = null; this.voiceAssigned = false; }
  stop() { this.cancel(); this.status = 'idle'; this.emit(); }
  setRate(rate) { if (Number.isFinite(Number(rate)) && Number(rate) >= .5 && Number(rate) <= 2) this.rate = Number(rate); this.emit(); }
  play(index) {
    if (this.previewing) this.cancel();
    if (Number.isInteger(index)) return this.jump(index);
    if (this.status === 'paused') { this.engine.resume(); this.status = 'playing'; this.emit(); if (!this.utterance) this.speak(); }
    else if (this.status !== 'playing') this.jump(this.status === 'finished' ? 0 : this.index);
  }
  pause() { if (this.status !== 'playing') return; this.engine.pause(); this.status = 'paused'; this.emit(); }
  jump(index) {
    this.cancel(); this.index = Math.max(0, index); this.phrase = 0; this.trackVoice = null; this.voiceAssigned = false;
    if (this.index >= this.tracks.length) return this.finish();
    this.status = 'playing'; this.speak();
  }
  next() { this.jump(this.index + 1); }
  previous() { this.jump(this.index - 1); }
  preview(text, voice) {
    this.cancel(); this.status = this.tracks.length && this.index < this.tracks.length ? 'paused' : 'idle';
    const token = this.generation, utterance = this.makeUtterance(text);
    this.previewing = true; utterance.voice = voice; utterance.lang = voice?.lang || 'es-ES'; utterance.rate = 1; utterance.pitch = 1;
    utterance.onend = () => { if (token !== this.generation) return; this.previewing = false; this.emit(); };
    utterance.onerror = () => { if (token !== this.generation) return; this.previewing = false; this.emit(); this.onError(); };
    this.emit(); this.engine.speak(utterance);
  }
  finish() { this.utterance = null; this.index = this.tracks.length; this.status = 'finished'; this.emit(); }
  speak() {
    if (this.status !== 'playing') return;
    const text = this.tracks[this.index]?.[this.phrase];
    if (!text) {
      this.index++; this.phrase = 0; this.trackVoice = null; this.voiceAssigned = false;
      if (this.index >= this.tracks.length) return this.finish();
      return this.speak();
    }
    const token = this.generation;
    const utterance = this.makeUtterance(text);
    this.utterance = utterance; utterance.lang = 'es-ES'; utterance.rate = this.rate;
    const voices = this.engine.getVoices();
    // Keep one real voice throughout a story, including after rate changes.
    if (!this.voiceAssigned) { this.trackVoice = this.chooseVoice(this.index, voices); this.voiceAssigned = true; }
    utterance.voice = this.trackVoice; utterance.lang = this.trackVoice?.lang || 'es-ES'; utterance.pitch = 1;
    utterance.onstart = () => { if (token === this.generation) this.emit(); };
    utterance.onend = () => {
      if (token !== this.generation) return;
      this.utterance = null; this.phrase++;
      if (this.phrase >= this.tracks[this.index].length) { this.index++; this.phrase = 0; this.trackVoice = null; this.voiceAssigned = false; }
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
