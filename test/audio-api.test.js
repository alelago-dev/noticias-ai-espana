import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../server/handler.js';

const env = { AZURE_SPEECH_KEY: 'secret-key', AZURE_SPEECH_REGION: 'westeurope', GEMINI_API_KEY: 'g-key' };
const iso = minutes => new Date(Date.now() - minutes * 60_000).toUTCString();
const item = (n, title, excerpt) => `<item><title>${title}</title><link>https://elpais.com/espana/nota-${n}.html</link><pubDate>${iso(10 * n)}</pubDate><description>${excerpt}</description></item>`;
const feed = `<?xml version="1.0"?><rss><channel>${item(1, 'El Gobierno aprueba 300 millones para vivienda', 'El Consejo de Ministros ha aprobado el plan.')}${item(2, 'Alonso saldrá desde el pitlane en Singapur', 'Cambia su sexto turbocompresor del año.')}${item(3, 'Madrid abre una nueva línea de metro', 'La línea conecta el centro con el sur de la ciudad.')}</channel></rss>`;

function mockNetwork(log) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    log.push(href);
    if (href.includes('generativelanguage.googleapis.com')) {
      const prompt = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
      const items = prompt.articles.map(a => ({ text: `Pasamos a la siguiente: ${a.title}, según ${a.sourceName}.`, sourceIds: [a.id] }));
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items }) }] } }] }));
    }
    if (href.includes('tts.speech.microsoft.com')) return new Response(new Uint8Array([0xff, 0xfb, 0x90, 0x64]));
    return new Response(feed, { headers: { 'content-type': 'application/rss+xml' } });
  };
  return () => { globalThis.fetch = original; };
}
const post = (path, body) => api(new Request('https://brujula.test' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), env);

test('Config reports neural audio only when Azure Speech is configured', async () => {
  const on = await (await api(new Request('https://brujula.test/api/config'), env)).json();
  assert.equal(on.audioAvailable, true); assert.deepEqual(on.audioVoices, ['Elvira', 'Álvaro']); assert.equal(on.aiAvailable, true);
  const off = await (await api(new Request('https://brujula.test/api/config'), {})).json();
  assert.equal(off.audioAvailable, false); assert.deepEqual(off.audioVoices, []);
});

test('Edition with audio returns a vetted script, signed clips and the transcript sources', async () => {
  const log = [], restore = mockNetwork(log);
  try {
    const response = await post('/api/edition', { scope: 'espana', hours: 24, length: 'short', audio: true, narration: 'alternating', preferences: {}, profile: {} });
    assert.equal(response.status, 200);
    const edition = await response.json();
    assert.equal(edition.mode, 'ai');
    assert.ok(edition.articles.length >= 1);
    assert.equal(edition.audio.clips.length, edition.paragraphs.length);
    assert.match(edition.audio.clips[0].text, /Esto es Brújula, el informativo de España/);
    assert.match(edition.audio.clips.at(-1).text, /Gracias por escucharnos\.$/);
    assert.equal(edition.audio.clips[0].voice, 'es-ES-ElviraNeural');
    assert.ok(edition.estimatedSeconds >= 1);
    // The signed clip can be turned into audio; tampering or reusing a signature for other text cannot.
    const clip = edition.audio.clips[0];
    const audio = await post('/api/tts', { text: clip.text, voice: clip.voice, sig: clip.sig });
    assert.equal(audio.status, 200); assert.equal(audio.headers.get('content-type'), 'audio/mpeg');
    assert.deepEqual([...new Uint8Array(await audio.arrayBuffer())], [0xff, 0xfb, 0x90, 0x64]);
    assert.equal((await post('/api/tts', { text: clip.text + ' extra', voice: clip.voice, sig: clip.sig })).status, 400);
    assert.equal((await post('/api/tts', { text: clip.text, voice: 'es-ES-AlvaroNeural', sig: clip.sig })).status, 400);
    assert.equal((await post('/api/tts', { text: 'texto arbitrario', voice: clip.voice, sig: 'x' })).status, 400);
  } finally { restore(); }
});

test('Without audio the edition stays exactly as before and TTS is unavailable', async () => {
  const log = [], restore = mockNetwork(log);
  try {
    const edition = await (await post('/api/edition', { scope: 'espana', hours: 24, length: 'short', preferences: {}, profile: {} })).json();
    assert.equal(edition.audio, undefined);
    assert.equal(log.some(u => u.includes('tts.speech.microsoft.com')), false);
    const response = await api(new Request('https://brujula.test/api/tts', { method: 'POST', body: '{}' }), {});
    assert.equal(response.status, 503);
    assert.equal((await api(new Request('https://brujula.test/api/tts'), env)).status, 405);
    assert.equal((await api(new Request('https://brujula.test/api/tts', { method: 'POST', headers: { origin: 'https://attacker.test' }, body: '{}' }), env)).status, 403);
  } finally { restore(); }
});
