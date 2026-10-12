import test from 'node:test';
import assert from 'node:assert/strict';
import { anniversaryArticle, chooseAnniversary, appendAnniversary, calendarDay } from '../public/anniversary-news.js';
import { normalizeProfile, hiddenByFeedback } from '../public/personalization.js';
import { sources } from '../server/news.js';
import { api } from '../server/handler.js';
const now = Date.UTC(2026, 9, 12, 10), date = calendarDay(now);
const item = { id: 'anniversary-test', kind: 'events', year: 1984, title: 'Un álbum de rock', text: 'Se publica un álbum de rock.', musicMetadata: 'álbum de rock', sourceName: 'Wikipedia en español', sourceURL: 'https://es.wikipedia.org/wiki/12_de_octubre#Acontecimientos', url: 'https://es.wikipedia.org/wiki/Album', license: 'CC BY-SA 4.0', licenseURL: 'https://creativecommons.org/licenses/by-sa/4.0/' };
const data = { available: true, date, items: [item, { ...item, id: 'birth', year: 1970, kind: 'births', title: 'Una cantante', text: 'Nace una cantante.' }] };
test('An anniversary is a dated historical story, not a current publication', () => {
  const a = anniversaryArticle(item, date);
  assert.equal(a.kind, 'anniversary'); assert.equal(a.historicalYear, 1984); assert.equal(a.publishedAt, null);
  assert.equal(a.calendarDate, date); assert.match(a.title, /1984/); assert.match(a.excerpt, /12 de octubre de 1984/);
  assert.equal(a.url, item.sourceURL); assert.equal(a.license, 'CC BY-SA 4.0');
  assert.ok(a.musicGenres.includes('rock')); assert.equal(a.category, 'musica');
});
test('The anniversary switch defaults on, persists off and validates filters', () => {
  assert.equal(normalizeProfile({}).includeAnniversaries, true);
  assert.equal(normalizeProfile({ includeAnniversaries: false }).includeAnniversaries, false);
  assert.equal(normalizeProfile({ anniversaryEra: 'unknown', anniversaryKind: 'unknown' }).anniversaryEra, 'all');
  assert.equal(chooseAnniversary(data, { includeAnniversaries: false }, { now }), null);
  assert.equal(chooseAnniversary(data, { anniversaryEra: '80s' }, { now }).historicalYear, 1984);
  assert.equal(chooseAnniversary(data, { anniversaryKind: 'births' }, { now }).historicalYear, 1970);
});
test('Historical items honor styles and explicit feedback without pretending to be Spanish tour news', () => {
  const a = chooseAnniversary(data, { musicGenres: ['rock'], musicSpainOnly: true }, { now });
  assert.equal(a.historicalYear, 1984);
  assert.equal(chooseAnniversary(data, { musicGenres: ['grunge'] }, { now }), null);
  assert.equal(chooseAnniversary(data, { blockedTerms: ['álbum', 'cantante'] }, { now }), null);
  assert.equal(chooseAnniversary(data, { hiddenArticles: [a.id], anniversaryEra: '80s' }, { now }), null);
  assert.equal(hiddenByFeedback(a, normalizeProfile({ includeAnniversaries: false })), true);
  assert.equal(chooseAnniversary(data, { excludedSources: ['wikipedia'] }, { now }), null);
});
test('A stale, unavailable or empty calendar never supplies a historical story', () => {
  for (const calendar of [null, { ...data, available: false }, { ...data, date: '2026-10-11' }, { ...data, items: [] }]) assert.equal(chooseAnniversary(calendar, {}, { now }), null);
});
test('Exactly one historical note stays within the edition limit and keeps current news order', () => {
  const current = Array.from({ length: 6 }, (_, i) => ({ id: String(i) }));
  const result = appendAnniversary(current, data, {}, { now, limit: 6 });
  assert.equal(result.length, 6); assert.deepEqual(result.slice(0, 5), current.slice(0, 5));
  assert.equal(result.at(-1).kind, 'anniversary'); assert.deepEqual(current.map(a => a.id), ['0', '1', '2', '3', '4', '5']);
  assert.deepEqual(appendAnniversary([], data, {}, { now }), []);
  assert.deepEqual(appendAnniversary(current, data, { includeAnniversaries: false }, { now, limit: 6 }), current);
});
test('The backend adds a signed historical audio chapter without passing history to the LLM, and disabling it removes it', async () => {
  const original = globalThis.fetch; let wikiCalls = 0; const prompts = [];
  const date = new Date(Date.now() - 3600000).toUTCString();
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    if (href.includes('onthisday')) { wikiCalls++; return new Response(JSON.stringify({ events: [{ year: 1984, text: 'Se publica un álbum de rock.', pages: [{ titles: { normalized: 'Álbum de rock' }, description: 'álbum musical', content_urls: { desktop: { page: 'https://es.wikipedia.org/wiki/Album' } } }] }], births: [], deaths: [] })); }
    if (href.includes('generativelanguage')) {
      const prompt = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text); prompts.push(prompt);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items: prompt.articles.map(a => ({ text: a.title + ', según El País.', sourceIds: [a.id] })) }) }] } }] }));
    }
    const source = sources.find(s => s.feeds.some(f => f.url === href));
    const ids = ['elpais', 'abc', 'eldiario', 'elmundo', '20minutos', 'lavanguardia'];
    const titles = ['El Congreso vota la nueva ley', 'Bajan los precios del alquiler', 'La sanidad pública mejora las consultas', 'La educación estrena nuevas becas', 'El transporte municipal amplía sus rutas', 'La energía solar reduce las facturas'];
    const i = ids.indexOf(source?.id);
    return new Response(`<rss><channel>${i >= 0 ? `<item><title>${titles[i]}</title><link>${source.site}/espana/nota-${i}</link><pubDate>${date}</pubDate></item>` : ''}</channel></rss>`);
  };
  const env = { GEMINI_API_KEY: 'test', AZURE_SPEECH_KEY: 'test', AZURE_SPEECH_REGION: 'westeurope' };
  const generate = profile => api(new Request('https://brujula.test/api/edition', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scope: 'espana', hours: 12, length: 'short', audio: true, profile }) }), env);
  try {
    const enabled = await (await generate({})).json();
    assert.equal(enabled.mode, 'ai'); assert.equal(enabled.articles.length, 6); assert.equal(enabled.audio.clips.length, 6);
    assert.equal(enabled.articles.at(-1).kind, 'anniversary'); assert.match(enabled.audio.clips.at(-1).text, /1984/);
    assert.match(enabled.audio.clips[0].text, /recordamos una efeméride musical/);
    assert.ok(enabled.audio.clips.at(-1).sig); assert.match(enabled.paragraphs.at(-1).text, /Wikipedia/);
    assert.equal(prompts[0].articles.length, 5); assert.ok(prompts[0].articles.every(a => !a.id.startsWith('anniversary-')));
    const disabled = await (await generate({ includeAnniversaries: false })).json();
    assert.equal(disabled.articles.length, 6); assert.ok(disabled.articles.every(a => a.kind !== 'anniversary'));
    assert.equal(wikiCalls, 1);
  } finally { globalThis.fetch = original; }
});
