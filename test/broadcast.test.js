import test from 'node:test';
import assert from 'node:assert/strict';
import { figuresSupported, vetParagraphs, broadcastFrame, writeBroadcast, buildClips, geminiModels } from '../server/broadcast.js';
import { signClip, verifyClip, voiceFor, splitText, ssml, synthesizeSpeech, VOICES } from '../server/tts.js';
import { cachePut, cachePutJSON, sha256Hex } from '../server/cache.js';

const articles = [
  { id: 'a', title: 'El Gobierno aprueba 300 millones para vivienda', excerpt: 'El Consejo de Ministros ha aprobado el plan este martes.', sourceName: 'EL PAÍS', category: 'economia' },
  { id: 'b', title: 'Alonso saldrá desde el pitlane en Singapur', excerpt: 'Cambia su sexto turbocompresor del año.', sourceName: 'Europa Press', category: 'deportes' },
];
const categories = [{ id: 'economia', name: 'Economía' }, { id: 'deportes', name: 'Deportes' }];
const env = { AZURE_SPEECH_KEY: 'secret-key', AZURE_SPEECH_REGION: 'westeurope' };

test('Clip signatures bind text and voice and need a configured secret', async () => {
  const sig = await signClip('Buenos días', VOICES.female, env);
  assert.equal(await verifyClip('Buenos días', VOICES.female, sig, env), true);
  assert.equal(await verifyClip('Otro texto', VOICES.female, sig, env), false);
  assert.equal(await verifyClip('Buenos días', VOICES.male, sig, env), false);
  assert.equal(await verifyClip('Buenos días', VOICES.female, sig, {}), false);
  assert.equal(await verifyClip('Buenos días', VOICES.female, undefined, env), false);
});

test('Narrators alternate starting with the female voice, or stay on one', () => {
  assert.deepEqual([0, 1, 2].map(i => voiceFor(i, 'alternating')), [VOICES.female, VOICES.male, VOICES.female]);
  assert.equal(voiceFor(1, 'female'), VOICES.female);
  assert.equal(voiceFor(0, 'male'), VOICES.male);
});

test('Long text is split at sentence ends without losing words; SSML is escaped', () => {
  const text = 'Primera frase con datos. '.repeat(40).trim();
  const chunks = splitText(text, 200);
  assert.ok(chunks.length > 1 && chunks.every(c => c.length <= 200));
  assert.equal(chunks.join(' ').replace(/\s+/g, ' '), text);
  assert.equal(splitText('x'.repeat(500), 200).join('').length, 500);
  assert.match(ssml('Tom & "Jerry" <b>', VOICES.male), /Tom &amp; &quot;Jerry&quot; &lt;b&gt;/);
});

test('Speech is requested per chunk, concatenated, cached and fails loudly', async () => {
  const calls = [];
  const fetcher = async (url, init) => { calls.push({ url, init }); return new Response(new Uint8Array([calls.length, calls.length]), { status: 200 }); };
  const text = 'Una frase bastante larga para el informativo de radio. '.repeat(70).trim() + ' [unico-' + Math.random() + ']';
  const first = await synthesizeSpeech(text, VOICES.female, env, fetcher);
  assert.ok(calls.length >= 2);
  assert.equal(first.length, calls.length * 2);
  assert.equal(calls[0].url, 'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
  assert.equal(calls[0].init.headers['Ocp-Apim-Subscription-Key'], 'secret-key');
  assert.equal(calls[0].init.headers['X-Microsoft-OutputFormat'], 'audio-24khz-48kbitrate-mono-mp3');
  const before = calls.length;
  await synthesizeSpeech(text, VOICES.female, env, fetcher);
  assert.equal(calls.length, before, 'second request is served from the cache');
  await assert.rejects(synthesizeSpeech('Texto distinto ' + Math.random(), VOICES.male, env, async () => new Response('no', { status: 401 })), /tts-401/);
});

test('Radio cadence preserves punctuation and escapes text and voice attributes for both narrators', () => {
  const text = 'Según el medio, creció un 3,5%. EE. UU. publica el dato. Tom & Jerry <break time="9s"/>.';
  for (const voice of Object.values(VOICES)) {
    const markup = ssml(text, voice);
    assert.match(markup, /<prosody rate='\+4%'>/);
    assert.match(markup, /type='Sentenceboundary-exact' value='240ms'/);
    assert.match(markup, /creció un 3,5%\. EE\. UU\. publica el dato\./);
    assert.match(markup, /Tom &amp; Jerry &lt;break time=&quot;9s&quot;\/&gt;/);
    assert.doesNotMatch(markup, /express-as|pitch=/);
  }
  assert.match(ssml('Hola', "voz' fake='value"), /name='voz&apos; fake=&apos;value'/);
});

test('A cadence update replaces old neutral cached audio and caches the new rendering', async () => {
  const text = 'Noticia de prueba para renovar la locución ' + Math.random();
  await cachePut('tts/' + await sha256Hex(VOICES.female + '\n' + text), new Uint8Array([1]).buffer, 3600);
  let requests = 0;
  const fetcher = async () => { requests++; return new Response(new Uint8Array([2, 3])); };
  assert.deepEqual([...await synthesizeSpeech(text, VOICES.female, env, fetcher)], [2, 3]);
  assert.deepEqual([...await synthesizeSpeech(text, VOICES.female, env, fetcher)], [2, 3]);
  assert.equal(requests, 1);
});

test('Figures written by the model must come from the cited sources', () => {
  assert.equal(figuresSupported({ text: 'El Gobierno destina 300 millones.', sourceIds: ['a'] }, articles), true);
  assert.equal(figuresSupported({ text: 'El Gobierno destina 500 millones.', sourceIds: ['a'] }, articles), false);
  assert.equal(figuresSupported({ text: 'Sin cifras.', sourceIds: ['b'] }, articles), true);
});

test('Vetting drops uncited paragraphs, replaces invented figures and reads skipped stories', () => {
  const vetted = vetParagraphs([{ text: 'Pasamos a economía: 900 millones para vivienda, según EL PAÍS.', sourceIds: ['a'] }, { text: 'Párrafo sin fuente válida.', sourceIds: ['zzz'] }], articles);
  assert.equal(vetted.length, 2);
  assert.match(vetted[0].text, /^El Gobierno aprueba 300 millones/, 'invented figure falls back to the original headline');
  assert.deepEqual(vetted[1].sourceIds, ['b'], 'skipped story is still read from its excerpt');
  assert.equal(vetParagraphs([{ text: 'Nada válido', sourceIds: ['zzz'] }], articles), null);
});

test('Opening gives the Madrid time and the greeting that fits the hour', () => {
  const afternoon = broadcastFrame({ scope: 'espana', hours: 12, now: Date.UTC(2026, 9, 11, 12, 14) });
  assert.match(afternoon.intro, /^Buenas tardes\. Esto es Brújula, el informativo de España\. Son las 14 horas y 14 minutos, hora de Madrid\./);
  assert.match(broadcastFrame({ now: Date.UTC(2026, 9, 11, 6, 0) }).intro, /^Buenos días.*Son las 8 horas, hora de Madrid/);
  assert.match(broadcastFrame({ scope: 'mundo', now: Date.UTC(2026, 9, 11, 22, 0) }).intro, /^Buenas noches.*informativo del mundo/);
});

test('Gemini script is parsed, vetted and cached; failures fall back to the excerpts', async () => {
  const geminiEnv = { GEMINI_API_KEY: 'g-key', GEMINI_ENDPOINT: 'https://gemini.test' };
  let requests = 0;
  const ok = async (url, init) => {
    requests++;
    assert.match(url, /^https:\/\/gemini\.test\/v1beta\/models\/gemini-3\.5-flash-lite:generateContent$/);
    assert.equal(init.headers['x-goog-api-key'], 'g-key');
    assert.match(JSON.parse(init.body).systemInstruction.parts[0].text, /EXCLUSIVAMENTE/);
    assert.match(JSON.parse(init.body).systemInstruction.parts[0].text, /Alterna frases cortas/);
    assert.match(JSON.parse(init.body).systemInstruction.parts[0].text, /transiciones breves solo cuando/);
    const items = [{ text: 'En economía, el Gobierno aprueba 300 millones para vivienda, según EL PAÍS.', sourceIds: ['a'] }, { text: 'Y en deporte, Alonso saldrá desde el pitlane, según Europa Press.', sourceIds: ['b'] }];
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items }) }] } }] }));
  };
  const unique = articles.map(a => ({ ...a, id: a.id, title: a.title + ' ' + Math.random() }));
  const oldKey = 'script/' + await sha256Hex(JSON.stringify([unique.map(a => [a.id, a.title, a.excerpt]), 'medium', 'gemini']));
  await cachePutJSON(oldKey, { mode: 'ai', paragraphs: [{ text: 'Guion neutro anterior.', sourceIds: ['a'] }] }, 1800);
  const first = await writeBroadcast(unique, geminiEnv, { length: 'medium' }, ok);
  assert.equal(first.mode, 'ai'); assert.equal(first.paragraphs.length, 2);
  await writeBroadcast(unique, geminiEnv, { length: 'medium' }, ok);
  assert.equal(requests, 1, 'identical selection reuses the stored script');
  const failed = await writeBroadcast(articles.map(a => ({ ...a, title: a.title + ' ' + Math.random() })), geminiEnv, {}, async () => new Response('x', { status: 500 }));
  assert.equal(failed.mode, 'extractive'); assert.ok(failed.notice);
  assert.equal((await writeBroadcast(articles, {}, {})).mode, 'extractive');
});

test('Clips keep story order, read the opening first and the closing last, and are signed', async () => {
  const edition = { mode: 'ai', paragraphs: [{ text: 'Primera noticia.', sourceIds: ['a'] }, { text: 'Segunda noticia.', sourceIds: ['b'] }] };
  const clips = await buildClips(edition, articles, categories, env, { narration: 'alternating', scope: 'espana', hours: 12, now: Date.UTC(2026, 9, 11, 12, 14) });
  assert.equal(clips.length, 2);
  assert.match(clips[0].text, /^Buenas tardes.*Primera noticia\.$/);
  assert.match(clips[1].text, /^Segunda noticia\. Hasta aquí el informativo de Brújula/);
  assert.deepEqual(clips.map(c => c.voice), [VOICES.female, VOICES.male]);
  assert.deepEqual(clips.map(c => c.voiceName), ['Elvira', 'Álvaro']);
  for (const clip of clips) assert.equal(await verifyClip(clip.text, clip.voice, clip.sig, env), true);
});

test('A 404 for one Gemini model moves on to the next candidate; other errors stop', async () => {
  assert.deepEqual(geminiModels({}), ['gemini-3.5-flash-lite', 'gemini-3.8-flash']);
  assert.deepEqual(geminiModels({ GEMINI_MODEL: 'custom-model' }), ['custom-model', 'gemini-3.5-flash-lite', 'gemini-3.8-flash']);
  const geminiEnv = { GEMINI_API_KEY: 'g-key', GEMINI_ENDPOINT: 'https://gemini.test', GEMINI_MODEL: 'gemini-2.5-flash' };
  const fresh = () => articles.map(a => ({ ...a, title: a.title + ' ' + Math.random() }));
  const tried = [];
  const fetcher = async url => {
    const model = url.match(/models\/([^:]+):/)[1]; tried.push(model);
    if (model !== 'gemini-3.8-flash') return new Response('{"error":{"status":"NOT_FOUND"}}', { status: 404 });
    const items = [{ text: 'En economía, según EL PAÍS, el Gobierno aprueba 300 millones para vivienda.', sourceIds: ['a'] }, { text: 'Y en deporte, según Europa Press, Alonso saldrá desde el pitlane.', sourceIds: ['b'] }];
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items }) }] } }] }));
  };
  assert.equal((await writeBroadcast(fresh(), geminiEnv, {}, fetcher)).mode, 'ai');
  assert.deepEqual(tried, ['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash']);
  assert.equal((await writeBroadcast(fresh(), geminiEnv, {}, async () => new Response('{}', { status: 404 }))).mode, 'extractive', 'still falls back to headlines and excerpts');
  const urls = [];
  const stopped = await writeBroadcast(fresh(), geminiEnv, {}, async url => { urls.push(url); return new Response('{}', { status: 403 }); });
  assert.equal(stopped.mode, 'extractive'); assert.equal(urls.length, 1, 'a non-404 error is not retried on other models');
});
