import test from 'node:test';
import assert from 'node:assert/strict';
import { ClipPlayer } from '../public/clip-player.js';

class FakeAudio extends EventTarget {
  constructor() { super(); this.src = ''; this.currentTime = 0; this.duration = 10; this.playbackRate = 1; this.plays = []; this.paused = true; this.failPlay = false; }
  async play() { if (this.failPlay) throw new Error('blocked'); this.paused = false; this.plays.push(this.src); }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
  load() {}
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup({ failClip } = {}) {
  const audio = new FakeAudio(), states = [], errors = [], fetched = [], released = [], actions = {};
  const mediaSession = { metadata: null, playbackState: 'none', setActionHandler: (name, handler) => { actions[name] = handler; } };
  const player = new ClipPlayer({
    audio, mediaSession, makeMetadata: init => init,
    fetchClip: async clip => { fetched.push(clip.text); if (clip.text === failClip) throw new Error('boom'); return 'blob:' + clip.text; },
    releaseClip: url => released.push(url), onChange: s => states.push(s), onError: (e, i) => errors.push([e.message, i]),
  });
  player.load([{ text: 'uno', voiceName: 'Elvira' }, { text: 'dos', voiceName: 'Álvaro' }, { text: 'tres', voiceName: 'Elvira' }], { titles: ['Uno', 'Dos', 'Tres'] });
  return { audio, player, states, errors, fetched, released, actions, mediaSession };
}

test('Plays clips in order, prefetches ahead and finishes after the last one', async () => {
  const { audio, player, fetched } = setup();
  await player.play(0);
  assert.equal(player.snapshot.status, 'playing'); assert.deepEqual(audio.plays, ['blob:uno']);
  await tick(); assert.deepEqual(fetched, ['uno', 'dos', 'tres'], 'next two clips are fetched while the first plays');
  audio.dispatchEvent(new Event('ended')); await tick();
  assert.deepEqual(audio.plays, ['blob:uno', 'blob:dos']); assert.equal(player.snapshot.index, 1); assert.equal(player.snapshot.status, 'playing');
  audio.dispatchEvent(new Event('ended')); await tick(); audio.dispatchEvent(new Event('ended')); await tick();
  assert.equal(player.snapshot.status, 'finished'); assert.equal(player.snapshot.progress, 1);
});

test('Pause, resume, skip and previous keep one clip playing at a time', async () => {
  const { audio, player } = setup();
  await player.play(0);
  player.pause(); assert.equal(player.snapshot.status, 'paused'); assert.equal(audio.paused, true);
  await player.play(); assert.equal(player.snapshot.status, 'playing'); assert.deepEqual([...new Set(audio.plays)], ['blob:uno'], 'resume does not reload the clip');
  await player.next(); assert.equal(player.snapshot.index, 1);
  await player.previous(); assert.equal(player.snapshot.index, 0);
  await player.previous(); assert.equal(player.snapshot.index, 0, 'previous never goes below the first story');
  assert.equal(audio.plays.at(-1), 'blob:uno');
});

test('Speed applies to the clip immediately and to the next ones', async () => {
  const { audio, player } = setup();
  await player.play(0); player.setRate(1.5);
  assert.equal(audio.playbackRate, 1.5); assert.equal(player.snapshot.pendingRate, false);
  audio.dispatchEvent(new Event('ended')); await tick();
  assert.equal(audio.playbackRate, 1.5);
  player.setRate(9); assert.equal(player.rate, 1.5, 'out-of-range values are ignored');
});

test('A clip that cannot be fetched reports the story to resume from', async () => {
  const { player, errors } = setup({ failClip: 'dos' });
  await player.play(0);
  player.audio.dispatchEvent(new Event('ended')); await tick(); await tick();
  assert.deepEqual(errors, [['boom', 1]]); assert.equal(player.snapshot.status, 'idle');
});

test('Blocked playback is reported instead of hanging in a loading state', async () => {
  const { audio, player, errors } = setup(); audio.failPlay = true;
  await player.play(0);
  assert.equal(errors.length, 1); assert.equal(player.snapshot.status, 'idle');
});

test('Lock screen controls and metadata follow the player; stop releases the clips', async () => {
  const { player, actions, mediaSession, released } = setup();
  await player.play(0);
  assert.equal(mediaSession.metadata.title, 'Uno'); assert.equal(mediaSession.playbackState, 'playing');
  actions.pause(); assert.equal(player.snapshot.status, 'paused'); assert.equal(mediaSession.playbackState, 'paused');
  await actions.nexttrack(); assert.equal(mediaSession.metadata.title, 'Dos');
  await tick(); player.stop(); await tick();
  assert.equal(player.snapshot.status, 'idle'); assert.ok(released.includes('blob:uno'));
});

test('Stale async results from a skipped clip never start playing', async () => {
  const { audio, player } = setup();
  const first = player.play(0); const second = player.play(2);
  await Promise.all([first, second]);
  assert.deepEqual(audio.plays, ['blob:tres']); assert.equal(player.snapshot.index, 2);
});
