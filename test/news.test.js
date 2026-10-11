import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, sources, personalize, normalizePreferences, findEvidence, articleURL, cleanText, getNews } from '../server/news.js';
import { validateCitations, synthesize } from '../server/ai.js';
import { api } from '../server/handler.js';

const now = Date.UTC(2026, 9, 10, 10);
function rss(date, url = 'https://elpais.com/espana/prueba.html') {
  return `<?xml version="1.0"?><rss><channel><item><title>El Gobierno anuncia medidas sobre vivienda</title><link>${url}</link><pubDate>${date}</pubDate><description><![CDATA[<p>El ministro presenta una propuesta.</p><script>alert(1)</script>]]></description></item></channel></rss>`;
}
test('RSS: dates, original links, attribution and clean excerpts', () => {
  const items = parseFeed(rss(new Date(now - 3600000).toUTCString()), sources[0], now);
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceName, 'EL PAÍS');
  assert.ok(items[0].categories.includes('economia'));
  assert.ok(items[0].topics.includes('economia:vivienda'));
  assert.equal(items[0].excerpt, 'El ministro presenta una propuesta.');
  assert.equal(parseFeed(rss('no date'), sources[0], now).length, 0);
  assert.equal(parseFeed(rss(new Date(now - 96 * 3600000).toUTCString()), sources[0], now).length, 0);
  assert.equal(parseFeed(rss(new Date(now + 3600000).toUTCString()), sources[0], now).length, 0);
});
test('RSS rejects external links, spoofed domains and non-HTTPS', () => {
  for (const url of ['javascript:alert(1)', 'https://elpais.com.attacker.test/a', 'https://attacker.test/a', 'http://elpais.com/a', 'https://user:pass@elpais.com/a']) assert.equal(articleURL(url, sources[0]), null);
  assert.equal(articleURL('https://elpais.com/a?utm_source=test#abc', sources[0]), 'https://elpais.com/a');
  assert.equal(cleanText('<script>alert(1)</script><b>Una noticia</b>'), 'Una noticia');
});
test('Regional RSS supplies its location without changing topic classification', () => {
  const source = sources.find(s => s.id === 'lavanguardia');
  const [article] = parseFeed(rss(new Date(now - 3600000).toUTCString(), 'https://www.lavanguardia.com/local/barcelona/noticia.html'), { ...source, region: 'cataluna' }, now);
  assert.ok(article.regions.includes('cataluna'));
  assert.ok(article.topics.includes('economia:vivienda'));
  assert.equal(article.coverage, 'espana');
  assert.equal(article.generalFeed, false);
});
test('An article in general and regional feeds retains its local metadata once', async () => {
  const fixture = rss(new Date().toUTCString(), 'https://www.lavanguardia.com/local/barcelona/prueba.html');
  const news = await getNews(async url => new Response(url.includes('lavanguardia.com/rss/') ? fixture : '<rss><channel></channel></rss>'), { force: true });
  assert.equal(news.articles.length, 1);
  assert.ok(news.articles[0].regions.includes('cataluna'));
  assert.equal(news.articles[0].generalFeed, true);
  assert.equal(news.articles[0].source, 'lavanguardia');
});
test('Interests select and rank articles, excluded categories stay out', () => {
  const articles = [{ id: 'a', category: 'economia', publishedAt: '2026-10-10T09:30:00Z' }, { id: 'b', category: 'tecnologia', publishedAt: '2026-10-10T09:00:00Z' }, { id: 'c', category: 'deportes', publishedAt: '2026-10-10T10:00:00Z' }];
  assert.deepEqual(personalize(articles, { economia: 1, tecnologia: 3 }, 30, {}, { now }).map(a => a.id), ['b', 'a']);
  assert.equal(normalizePreferences({ economia: 99, tecnologia: '3' }).economia, 0);
  assert.equal(normalizePreferences(null).economia, 0);
  assert.equal(personalize(articles, {}).length, 0);
});
test('Evidence search abstains when no source matches', () => {
  const items = [{ id: 'a', title: 'Vivienda en Madrid', excerpt: 'Nuevos precios del alquiler' }];
  assert.equal(findEvidence('¿Qué hay sobre vivienda?', items).length, 1);
  assert.equal(findEvidence('Elecciones en Japón', items).length, 0);
});
test('Citations must resolve and unconfigured AI is clearly extractive', async () => {
  const items = [{ id: 'a', title: 'Un titular', excerpt: 'Un extracto' }];
  assert.equal(validateCitations([{ text: 'Dato', sourceIds: ['unknown'] }], items), false);
  assert.equal(validateCitations([{ text: 'Dato', sourceIds: [] }], items), false);
  assert.equal(validateCitations([{ text: 'Dato', sourceIds: ['a'] }], items), true);
  const result = await synthesize(items, {});
  assert.equal(result.mode, 'extractive');
  assert.deepEqual(result.paragraphs[0].sourceIds, ['a']);
});
test('API rejects cross-origin generation and malformed requests', async () => {
  const forbidden = await api(new Request('https://brujula.test/api/edition', { method: 'POST', headers: { origin: 'https://attacker.test' }, body: '{}' }));
  assert.equal(forbidden.status, 403);
  const malformed = await api(new Request('https://brujula.test/api/ask', { method: 'POST', body: 'not json' }));
  assert.equal(malformed.status, 400);
  const config = await (await api(new Request('https://brujula.test/api/config'))).json();
  assert.equal(config.categories.length, 13);
  assert.equal(config.sources.length, 21);
  assert.ok(config.categories.find(c => c.id === 'tecnologia').topics.some(t => t.id === 'ia'));
  assert.equal(config.aiAvailable, false);
});
