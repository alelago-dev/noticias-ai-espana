// Plays the broadcast as real audio (one MP3 clip per story) through a single
// <audio> element, so it keeps going with the screen locked and exposes lock
// screen controls through the Media Session API. It mirrors the NewsPlayer
// surface (play/pause/next/previous/setRate/snapshot) so the UI drives either.
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

export class ClipPlayer {
  /**
   * @param {{audio: HTMLAudioElement, fetchClip: (clip: any) => Promise<string>, releaseClip?: (url: string) => void,
   *   onChange?: (state: any) => void, onError?: (error: Error, index: number) => void,
   *   mediaSession?: any, makeMetadata?: (init: any) => any, prefetch?: number}} options
   */
  constructor({ audio, fetchClip, releaseClip = () => {}, onChange = () => {}, onError = () => {}, mediaSession = null, makeMetadata = init => init, prefetch = 2 }) {
    Object.assign(this, { audio, fetchClip, releaseClip, onChange, onError, mediaSession, makeMetadata, prefetchCount: prefetch });
    this.clips = []; this.urls = []; this.index = 0; this.status = 'idle'; this.rate = 1;
    this.generation = 0; this.meta = {}; this.lastEmit = 0;
    audio.addEventListener('ended', () => this.ended());
    audio.addEventListener('timeupdate', () => this.tick());
    audio.addEventListener('error', () => this.failed(new Error('audio')));
    this.bindMediaSession();
  }
  get snapshot() {
    const count = this.clips.length, a = this.audio;
    const within = this.status === 'playing' || this.status === 'paused' ? (a.duration > 0 ? Math.min(1, a.currentTime / a.duration) : 0) : 0;
    return { status: this.status, index: this.index, count, rate: this.rate, previewing: false, pendingRate: false, neural: true,
      voiceName: this.clips[this.index]?.voiceName || '', progress: count ? Math.min(1, (this.index + within) / count) : 0 };
  }
  emit() { this.lastEmit = Date.now(); this.onChange(this.snapshot); }
  tick() { if (Date.now() - this.lastEmit > 400) this.emit(); }

  /** Called inside the user's tap so later programmatic play() calls are allowed on mobile. */
  unlock() { try { this.audio.src = SILENCE; const p = this.audio.play(); p?.catch?.(() => {}); } catch {} }

  load(clips, meta = {}) {
    this.stop(); this.clips = clips; this.meta = meta; this.index = 0; this.urls = new Array(clips.length).fill(null);
  }
  clipURL(i) {
    if (i < 0 || i >= this.clips.length) return null;
    if (!this.urls[i]) {
      const promise = this.fetchClip(this.clips[i]);
      promise.catch(() => { if (this.urls[i] === promise) this.urls[i] = null; });
      this.urls[i] = promise;
    }
    return this.urls[i];
  }
  prefetch(from) { for (let n = 1; n <= this.prefetchCount; n++) this.clipURL(from + n)?.catch(() => {}); }

  setRate(rate) {
    const value = Number(rate);
    if (Number.isFinite(value) && value >= .5 && value <= 2) { this.rate = value; this.audio.playbackRate = value; }
    this.emit();
  }
  async jump(index, { quiet = false } = {}) {
    const token = ++this.generation;
    this.index = Math.max(0, index);
    if (this.index >= this.clips.length) return this.finish();
    if (!quiet) this.status = 'loading';
    this.emit(); this.setMetadata();
    let url;
    try { url = await this.clipURL(this.index); } catch (error) { if (token === this.generation) this.failed(error); return; }
    if (token !== this.generation) return;
    this.audio.src = url; this.audio.playbackRate = this.rate;
    try { await this.audio.play(); } catch (error) { if (token === this.generation) this.failed(error); return; }
    if (token !== this.generation) return;
    this.status = 'playing'; this.emit(); this.prefetch(this.index); this.setPlaybackState();
  }
  play(index) {
    if (Number.isInteger(index)) return this.jump(index);
    if (this.status === 'paused') { this.status = 'playing'; this.emit(); this.setPlaybackState(); return this.audio.play().catch(error => this.failed(error)); }
    if (this.status !== 'playing' && this.status !== 'loading') return this.jump(this.status === 'finished' ? 0 : this.index);
  }
  pause() {
    if (this.status !== 'playing') return;
    this.audio.pause(); this.status = 'paused'; this.emit(); this.setPlaybackState();
  }
  next() { return this.jump(this.index + 1); }
  previous() { return this.jump(Math.max(0, this.index - 1)); }
  ended() {
    if (this.status !== 'playing') return;
    // Stay in "playing" across clips so background music does not stutter.
    this.jump(this.index + 1, { quiet: true });
  }
  finish() { this.audio.pause(); this.status = 'finished'; this.index = this.clips.length; this.emit(); this.setPlaybackState(); }
  failed(error) {
    if (this.status === 'idle') return;
    const index = this.index;
    this.generation++; this.audio.pause(); this.status = 'idle'; this.emit();
    this.onError(error instanceof Error ? error : new Error(String(error)), index);
  }
  stop() {
    this.generation++;
    try { this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load?.(); } catch {}
    for (const entry of this.urls) entry?.then?.(url => this.releaseClip(url), () => {});
    this.urls = []; this.status = 'idle'; this.emit(); this.setPlaybackState();
  }

  bindMediaSession() {
    const session = this.mediaSession;
    if (!session) return;
    const handlers = { play: () => this.play(), pause: () => this.pause(), nexttrack: () => this.next(), previoustrack: () => this.previous(),
      seekforward: () => { this.audio.currentTime = Math.min(this.audio.duration || Infinity, this.audio.currentTime + 15); },
      seekbackward: () => { this.audio.currentTime = Math.max(0, this.audio.currentTime - 15); } };
    for (const [action, handler] of Object.entries(handlers)) { try { session.setActionHandler(action, handler); } catch {} }
  }
  setMetadata() {
    if (!this.mediaSession) return;
    try {
      this.mediaSession.metadata = this.makeMetadata({ title: this.meta.titles?.[this.index] || 'Informativo Brújula', artist: 'Brújula', album: this.meta.album || 'Tu informativo', artwork: this.meta.artwork || [] });
    } catch {}
  }
  setPlaybackState() { if (this.mediaSession) try { this.mediaSession.playbackState = this.status === 'playing' ? 'playing' : this.status === 'paused' ? 'paused' : 'none'; } catch {} }
}
