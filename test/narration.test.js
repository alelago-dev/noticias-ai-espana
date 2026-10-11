import test from 'node:test';
import assert from 'node:assert/strict';
import { NewsPlayer, speechPhrases } from '../public/audio-player.js';
import { narratorFor, resolveNarrators, voiceRole, spokenText } from '../public/narration.js';
const female = { name: 'Microsoft Elvira Online (Natural)', lang: 'es-ES', voiceURI: 'elvira' };
const male = { name: 'Microsoft Alvaro Online (Natural)', lang: 'es-ES', voiceURI: 'alvaro' };
test('Named female and male voices alternate by complete story; preference favors Spanish from Spain', () => {
  const voices = [{ name: 'Google US English', lang: 'en-US' }, { name: 'Paulina', lang: 'es-MX', voiceURI: 'paulina' }, male, female];
  assert.equal(narratorFor(0, voices), female); assert.equal(narratorFor(1, voices), male); assert.equal(narratorFor(2, voices), female);
  assert.equal(narratorFor(1, voices, { mode: 'female' }), female);
  assert.equal(narratorFor(0, voices, { mode: 'male' }), male);
});
test('One voice never pretends to be two; unknown genders require user choices', () => {
  const unknown = { name: 'Google español', lang: 'es-ES', voiceURI: 'google-es' };
  assert.equal(voiceRole(unknown), null); assert.equal(resolveNarrators([unknown]).distinct, false);
  assert.equal(narratorFor(0, [unknown]), unknown); assert.equal(narratorFor(1, [unknown]), unknown);
  const another = { name: 'Spanish voice 2', lang: 'es-ES', voiceURI: 'second' };
  assert.equal(resolveNarrators([unknown, another], { female: 'google-es', male: 'second' }).distinct, true);
  assert.equal(narratorFor(1, [unknown, another], { female: 'google-es', male: 'second' }), another);
  assert.equal(resolveNarrators([]).fallback, null);
});
test('Real voice stays constant within a story after speed and settings changes', () => {
  const spoken = []; let settings = {};
  const engine = { cancel() {}, resume() {}, pause() {}, getVoices: () => [female, male], speak(u) { spoken.push(u); u.onstart(); } };
  const player = new NewsPlayer({ engine, makeUtterance: text => ({ text }), chooseVoice: (i, voices) => narratorFor(i, voices, settings) });
  player.load(['Primera frase informativa. Segunda frase del mismo tema.', 'Noticia siguiente.']); player.play();
  assert.equal(spoken.at(-1).voice, female);
  settings = { mode: 'male' }; player.setRate(1.5); spoken.at(-1).onend();
  assert.equal(spoken.at(-1).voice, female); assert.equal(spoken.at(-1).pitch, 1);
  spoken.at(-1).onend(); assert.equal(spoken.at(-1).voice, male);
});
test('Preview pauses the bulletin and resumes its current story rather than restarting', () => {
  const spoken = [], engine = { cancel() {}, resume() {}, pause() {}, getVoices: () => [female, male], speak(u) { spoken.push(u); u.onstart?.(); } };
  const player = new NewsPlayer({ engine, makeUtterance: text => ({ text }), chooseVoice: (i, voices) => narratorFor(i, voices) });
  player.load(['Primera noticia.', 'Primera frase de la segunda noticia. Segunda frase con más información.']); player.play(1); spoken.at(-1).onend();
  const position = player.phrase; player.preview('Una prueba de voz.', female); assert.equal(player.status, 'paused'); assert.equal(player.snapshot.previewing, true);
  const preview = spoken.at(-1); player.play(); assert.equal(player.index, 1); assert.equal(player.phrase, position); assert.equal(spoken.at(-1).voice, male);
  preview.onend(); assert.equal(player.status, 'playing');
});
test('Narration keeps complete sentences and reads common symbols without changing figures', () => {
  const sentence = 'El Gobierno presenta en el Congreso una propuesta para mejorar el acceso a la vivienda en las ciudades españolas.';
  assert.deepEqual(speechPhrases(sentence), [sentence]);
  assert.equal(spokenText('La IA en la UE crece un 2,5 % y cuesta 20 €.'), 'La inteligencia artificial en la Unión Europea crece un 2,5 por ciento y cuesta 20 euros.');
  const abbreviation = 'El Sr. García explica los datos.'; assert.deepEqual(speechPhrases(abbreviation), [abbreviation]);
});
