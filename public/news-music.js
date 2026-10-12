// Breaking News Bed: original music supplied by Brújula's owner.
export const MUSIC_REVISION = 4;
export const MUSIC_DEFAULT_VOLUME = 38;
export const MUSIC_BED_URL = '/breaking-news-bed.mp3';
export function musicPreferences(input) {
  const validVolume = Number.isFinite(input?.volume);
  const volume = validVolume ? Math.max(0, Math.min(100, input.volume)) : MUSIC_DEFAULT_VOLUME;
  // A new track must not turn up a user's saved volume or override mute.
  return { enabled: input?.enabled !== false, volume, revision: MUSIC_REVISION };
}
export class NewsMusic {
  constructor({ enabled = true, volume = MUSIC_DEFAULT_VOLUME, audio = null } = {}) {
    this.enabled = enabled;
    this.volume = Math.max(0, Math.min(100, Number(volume) || 0));
    this.playing = false;
    this.audio = audio || (typeof globalThis.Audio === 'function' ? new globalThis.Audio(MUSIC_BED_URL) : null);
    if (this.audio) {
      this.audio.src = MUSIC_BED_URL;
      this.audio.loop = true;
      this.audio.preload = 'none';
      this.audio.volume = 0;
    }
  }
  playMedia() {
    if (!this.audio || !this.audio.paused) return;
    try {
      const result = this.audio.play();
      Promise.resolve(result).then(() => {
        // Unlock may finish after the user pauses or closes the informativo.
        if (!this.playing || !this.enabled) this.audio.pause();
      }).catch(() => {}); // A blocked/failed bed must never interrupt the voice.
    } catch {}
  }
  unlock() {
    if (!this.audio || !this.enabled) return false;
    this.mix();
    this.playMedia(); // Prime this element within the user's tap, silently.
    return true;
  }
  mix() {
    if (!this.audio) return;
    // Leave room for the presenter while keeping the existing 0–100% control.
    this.audio.volume = this.playing && this.enabled ? this.volume / 100 * .5 : 0;
  }
  start() {
    if (!this.enabled || !this.audio) return;
    this.playing = true;
    this.mix();
    this.playMedia();
  }
  pause() {
    this.playing = false;
    this.mix();
    this.audio?.pause(); // Preserve the bed's position for a natural resume.
  }
  setEnabled(value) { this.enabled = Boolean(value); if (!this.enabled) this.pause(); }
  setVolume(value) { this.volume = Math.max(0, Math.min(100, Number(value) || 0)); this.mix(); }
}
