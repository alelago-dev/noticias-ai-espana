import test from 'node:test';
import assert from 'node:assert/strict';
import { NewsMusic, musicPreferences, MUSIC_BED_URL, MUSIC_REVISION } from '../public/news-music.js';
function fakeAudio() {
  return { paused: true, currentTime: 12, playbackRate: 1, volume: 0, calls: 0,
    play() { this.calls++; this.paused = false; return Promise.resolve(); }, pause() { this.paused = true; } };
}
test('Changing the music preserves saved volume and disabled/zero preferences', () => {
  assert.deepEqual(musicPreferences({ enabled: false, volume: 24, revision: 3 }), { enabled: false, volume: 24, revision: MUSIC_REVISION });
  assert.equal(musicPreferences({ volume: 0, revision: 2 }).volume, 0);
  assert.equal(musicPreferences(null).volume, 38);
});
test('The owner track loops, resumes at its position and respects volume/mute', async () => {
  const audio = fakeAudio(), music = new NewsMusic({ audio, volume: 40 });
  assert.equal(audio.src, MUSIC_BED_URL); assert.equal(audio.loop, true);
  music.start(); await Promise.resolve(); assert.equal(audio.paused, false);
  assert.equal(audio.volume, .2);
  music.start(); assert.equal(audio.calls, 1); // Time updates do not restart the bed.
  music.pause(); assert.equal(audio.paused, true); assert.equal(audio.volume, 0);
  assert.equal(audio.currentTime, 12);
  music.start(); music.setVolume(60); assert.equal(audio.volume, .3);
  assert.equal(audio.playbackRate, 1); // Narration speed must not speed up music.
  music.setEnabled(false); assert.equal(audio.paused, true);
  music.start(); assert.equal(audio.paused, true);
  music.setEnabled(true); music.start(); assert.equal(audio.paused, false);
  music.setVolume(0); assert.equal(audio.volume, 0);
});
test('Unlock is silent and a late play resolution cannot revive a paused bed', async () => {
  const audio = fakeAudio(); let resolve;
  audio.play = () => { audio.paused = false; return new Promise(r => { resolve = r; }); };
  const music = new NewsMusic({ audio });
  music.unlock(); assert.equal(audio.volume, 0);
  music.start(); music.pause(); resolve(); await Promise.resolve();
  assert.equal(audio.paused, true); assert.equal(music.playing, false);
});
test('An unavailable bed or rejected play does not throw or block narration', async () => {
  const music = new NewsMusic(); assert.equal(music.unlock(), false);
  assert.doesNotThrow(() => { music.start(); music.pause(); });
  const audio = fakeAudio(); audio.play = () => Promise.reject(new Error('blocked'));
  const blocked = new NewsMusic({ audio }); blocked.start(); await new Promise(r => setImmediate(r));
  assert.doesNotThrow(() => blocked.pause());
});
