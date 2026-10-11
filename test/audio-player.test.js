import test from 'node:test';
import assert from 'node:assert/strict';
import { NewsPlayer, speechPhrases } from '../public/audio-player.js';
function setup() {
  const spoken = [], changes = [], errors = [];
  const engine = { cancelled: 0, paused: false, cancel() { this.cancelled++; }, pause() { this.paused = true; }, resume() { this.paused = false; }, getVoices() { return []; }, speak(u) { spoken.push(u); u.onstart(); } };
  const player = new NewsPlayer({ engine, makeUtterance: text => ({ text }), onChange: s => changes.push(s), onError: () => errors.push(true) });
  return { player, spoken, engine, changes, errors };
}
const longText = 'Una primera frase completa con noticias de la mañana. Una segunda frase con los datos del medio original. Una tercera frase para seguir el informativo hasta el final.';
test('Changing speed preserves the current phrase and reads the following text once', () => {
  const { player, engine, spoken } = setup(); player.load([longText]); player.play();
  const first = spoken[0], cancels = engine.cancelled;
  player.setRate(1.5);
  assert.equal(engine.cancelled, cancels); assert.equal(spoken.length, 1);
  assert.equal(player.snapshot.pendingRate, true);
  first.onend();
  assert.equal(spoken[1].rate, 1.5); assert.notEqual(spoken[1].text, first.text);
  while (player.status !== 'finished') spoken.at(-1).onend();
  assert.equal(spoken.map(u => u.text).join(' '), longText);
});
test('Skipping jumps to the next story and ignores cancelled speech callbacks', () => {
  const { player, spoken } = setup(); player.load([longText, 'La segunda noticia es distinta.']); player.play();
  const abandoned = spoken[0]; player.next();
  assert.equal(player.index, 1); assert.equal(spoken.at(-1).text, 'La segunda noticia es distinta.');
  const count = spoken.length; abandoned.onend(); abandoned.onerror({ error: 'interrupted' });
  assert.equal(spoken.length, count); assert.equal(player.index, 1); assert.equal(player.status, 'playing');
});
test('Pause, change speed and resume keep position without replaying the start', () => {
  const { player, spoken, engine } = setup(); player.load([longText]); player.play(); spoken[0].onend();
  const phrase = spoken.at(-1), count = spoken.length;
  player.pause(); player.setRate(2); player.play();
  assert.equal(engine.paused, false); assert.equal(spoken.length, count);
  phrase.onend(); assert.equal(spoken.at(-1).rate, 2); assert.equal(player.phrase, 2);
});
test('Skipping the last story finishes; replay and previous remain available', () => {
  const { player, spoken } = setup(); player.load(['Primera noticia.', 'Segunda noticia.']); player.play(1); player.next();
  assert.equal(player.status, 'finished'); assert.equal(player.snapshot.progress, 1);
  player.previous(); assert.equal(spoken.at(-1).text, 'Segunda noticia.');
  player.next(); player.play(); assert.equal(spoken.at(-1).text, 'Primera noticia.');
});
test('Closing cancels pending callbacks and speech errors stop playback', () => {
  const { player, spoken, errors } = setup(); player.load([longText]); player.play();
  const pending = spoken[0]; player.stop(); const count = spoken.length; pending.onend();
  assert.equal(spoken.length, count); assert.equal(player.status, 'idle');
  player.play(0); spoken.at(-1).onerror({ error: 'voice-unavailable' });
  assert.equal(player.status, 'idle'); assert.equal(errors.length, 1);
});
test('Phrase segmentation preserves words, punctuation and attribution', () => {
  const text = 'Según EL PAÍS. El coste subió un 2,5 % y los datos son provisionales. Una palabra extraordinariamenteprolongada permanece completa.';
  assert.equal(speechPhrases(text, 50).join(' '), text);
  assert.deepEqual(speechPhrases(''), []);
});
