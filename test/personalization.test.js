import test from 'node:test';
import assert from 'node:assert/strict';
import { annotateArticle, normalizeProfile, personalize, categories } from '../public/personalization.js';
import { parseFeed, sources } from '../server/news.js';

const now = Date.UTC(2026, 9, 11, 12);
const article = (id, title, hours, source = 'elpais') => annotateArticle({ id, title, excerpt: '', source, publishedAt: new Date(now - hours * 3600000).toISOString() });
test('Selected subtopics change the order within one category', () => {
  const items = [article('phone', 'Nuevos móviles Android', 2), article('ai', 'OpenAI presenta un modelo de inteligencia artificial', 2)];
  const ranked = personalize(items, { tecnologia: 2 }, 10, { topics: { tecnologia: ['ia'] } }, { now });
  assert.equal(ranked[0].id, 'ai');
  assert.ok(ranked[0].matchReasons.includes('Inteligencia artificial'));
  const inverse = personalize(items, { tecnologia: 2 }, 10, { topics: { tecnologia: ['gadgets'] } }, { now });
  assert.equal(inverse[0].id, 'phone');
});
test('Strict topic filter does not fill the feed with other subtopics', () => {
  const items = [article('phone', 'Nuevos móviles Android', 2), article('ai', 'OpenAI y la inteligencia artificial', 2)];
  assert.deepEqual(personalize(items, { tecnologia: 3 }, 10, { topicMode: 'strict', topics: { tecnologia: ['ia'] } }, { now }).map(a => a.id), ['ai']);
});
test('Freshness window excludes old stories even when affinity is high', () => {
  const items = [article('old', 'OpenAI presenta ChatGPT', 30), article('new', 'Los precios del alquiler en Madrid', 1)];
  assert.deepEqual(personalize(items, { tecnologia: 3, economia: 1 }, 10, { topics: { tecnologia: ['ia'] } }, { now }).map(a => a.id), ['new']);
  const expanded = personalize(items, { tecnologia: 3, economia: 1 }, 10, { hours: 48, topics: { tecnologia: ['ia'] } }, { now });
  assert.deepEqual(expanded.map(a => a.id), ['new', 'old']);
  assert.equal(personalize(items, { economia: 1 }, 10, { hours: 6 }, { now: now + 6 * 3600000 }).length, 0);
});
test('Geography, custom interests and source exclusions alter the selection', () => {
  const items = [article('madrid', 'Bajan los precios del alquiler en Madrid', 2), article('malaga', 'Bajan los precios del alquiler en Málaga', 2, 'abc')];
  assert.equal(personalize(items, { economia: 2 }, 10, { region: 'andalucia' }, { now })[0].id, 'malaga');
  assert.equal(personalize(items, { economia: 2 }, 10, { keywords: ['Madrid'] }, { now })[0].id, 'madrid');
  assert.deepEqual(personalize(items, { economia: 2 }, 10, { excludedSources: ['abc'] }, { now }).map(a => a.id), ['madrid']);
});
test('Word boundaries stop spurious art, sport and AI categorisation', () => {
  const a = article('a', 'Una parte de la población obliga a revisar el plan', 1);
  assert.ok(!a.topics.includes('cultura:arte'));
  assert.ok(!a.categories.includes('deportes'));
  assert.ok(!a.topics.includes('tecnologia:ia'));
});
test('Profile validation limits topics and rejects unknown values', () => {
  const ids = categories.find(c => c.id === 'tecnologia').topics.map(t => t.id);
  const p = normalizeProfile({ topics: { tecnologia: ['fake', ...ids, 'ia'] }, region: 'fake', hours: 999, keywords: ['x', 'OpenAI', 4], excludedSources: null });
  assert.equal(p.topics.tecnologia.length, 5);
  assert.ok(!p.topics.tecnologia.includes('fake'));
  assert.equal(p.region, ''); assert.equal(p.hours, 24);
  assert.deepEqual(p.keywords, ['OpenAI']);
  assert.equal(normalizeProfile(null).hours, 24);
});
test('RSS namespace title collisions retain the original headline', () => {
  const date = new Date(now - 3600000).toUTCString();
  const xml = `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel><item><title>OpenAI presenta ChatGPT</title><media:title>Fotografía del evento</media:title><link>https://elpais.com/a</link><pubDate>${date}</pubDate></item></channel></rss>`;
  const parsed = parseFeed(xml, sources[0], now);
  assert.equal(parsed[0].title, 'OpenAI presenta ChatGPT');
});
test('Atom feeds provide dated original links and real headlines', () => {
  const source = sources.find(s => s.id === 'elconfidencial');
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Vivienda y alquiler</title><link rel="self" href="https://rss.elconfidencial.com/a"/><link rel="alternate" href="https://www.elconfidencial.com/espana/a"/><published>${new Date(now - 3600000).toISOString()}</published><summary>Los precios del alquiler.</summary></entry></feed>`;
  assert.equal(parseFeed(xml, source, now)[0].url, 'https://www.elconfidencial.com/espana/a');
});
