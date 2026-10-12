import test from 'node:test';
import assert from 'node:assert/strict';
import { annotateArticle, normalizeProfile, personalize, hiddenByFeedback, categories } from '../public/personalization.js';
import { selectBulletin } from '../public/bulletin.js';
import { api } from '../server/handler.js';
const now = Date.UTC(2026, 9, 12, 10);
const article = (id, title, extra = {}) => annotateArticle({ id, title, excerpt: '', source: 'elpais', publishedAt: new Date(now - 3600000).toISOString(), coverage: 'espana', ...extra });
test('A single dismissal hides only that ID, without inferring dislikes', () => {
  const articles = [article('a', 'OpenAI presenta ChatGPT'), article('b', 'OpenAI anuncia nuevos modelos')];
  assert.deepEqual(personalize(articles, { tecnologia: 3 }, 10, { hiddenArticles: ['a'] }, { now }).map(a => a.id), ['b']);
  assert.deepEqual(normalizeProfile({ hiddenArticles: ['a'] }).blockedTopics, []);
  assert.deepEqual(personalize(articles, { tecnologia: 3 }, 10, {}, { now }).map(a => a.id), ['a', 'b']);
});
test('Excluded subtopics override affinity, keywords and multiple categories', () => {
  const articles = [article('a', 'Fútbol y las empresas que patrocinan al Real Madrid'), article('b', 'Las empresas renuevan sus acuerdos')];
  assert.deepEqual(personalize(articles, { deportes: 3, economia: 3 }, 10, { blockedTopics: ['deportes:futbol'], keywords: ['Real Madrid'] }, { now }).map(a => a.id), ['b']);
});
test('Excluded names match phrases, accents and boundaries in title or excerpt', () => {
  const profile = normalizeProfile({ blockedTerms: ['Taylor Swift', 'RAP'] });
  assert.equal(hiddenByFeedback(article('a', 'TAYLOR SWIFT anuncia disco'), profile), true);
  assert.equal(hiddenByFeedback(article('b', 'Un nuevo álbum', { excerpt: 'Una canción de Taylor Swift.' }), profile), true);
  assert.equal(hiddenByFeedback(article('c', 'Rap y trap'), profile), true);
  assert.equal(hiddenByFeedback(article('d', 'Atrapado en la carretera'), profile), false);
  assert.equal(hiddenByFeedback(article('e', 'Taylor y Swift compiten por separado'), profile), false);
  assert.equal(hiddenByFeedback(article('f', 'Málaga anuncia un concierto'), normalizeProfile({ blockedTerms: ['Malaga'] })), true);
});
test('All bulletin scopes apply explicit feedback without changing their scopes', () => {
  const articles = [article('a', 'OpenAI presenta ChatGPT'), article('b', 'OpenAI anuncia novedades', { coverage: 'mundo' }), article('c', 'El Congreso vota una ley')];
  const profile = { blockedTerms: ['OpenAI'] };
  assert.deepEqual(selectBulletin(articles, { now, scope: 'espana', profile }).map(a => a.id), ['c']);
  assert.equal(selectBulletin(articles, { now, scope: 'mundo', profile }).length, 0);
  assert.deepEqual(selectBulletin(articles, { now, scope: 'personal', profile, preferences: { politica: 2, tecnologia: 3 } }).map(a => a.id), ['c']);
});
test('Malformed/old profiles normalize safely with bounded feedback arrays', () => {
  assert.deepEqual(normalizeProfile(null).hiddenArticles, []);
  const topics = categories.flatMap(c => c.topics.map(t => c.id + ':' + t.id));
  const p = normalizeProfile({ hiddenArticles: [1, null, 'x'.repeat(100), ...Array.from({ length: 80 }, (_, i) => 'id' + i)], blockedTopics: ['fake', ...topics], blockedTerms: ['x', 'Taylor Swift', 'taylor SWIFT', 1, ...Array.from({ length: 20 }, (_, i) => 'Band ' + i)] });
  assert.equal(p.hiddenArticles.length, 50); assert.equal(p.blockedTopics.length, 20); assert.equal(p.blockedTerms.length, 10);
  assert.equal(p.blockedTerms.filter(t => t.toLowerCase() === 'taylor swift').length, 1);
  assert.equal(normalizeProfile({ blockedTerms: {} }).blockedTerms.length, 0);
});
test('Feedback is per profile and does not mutate shared articles, preferences or saved copies', () => {
  const a = article('a', 'Pearl Jam anuncia un disco'), articles = [a], before = structuredClone(a);
  const preferences = { musica: 3 };
  assert.equal(personalize(articles, preferences, 10, { hiddenArticles: ['a'] }, { now }).length, 0);
  assert.equal(personalize(articles, preferences, 10, {}, { now }).length, 1);
  assert.deepEqual(a, before); assert.deepEqual(preferences, { musica: 3 });
});
test('API-generated editions honor feedback sent from the browser and remain extractive without credentials', async () => {
  const original = globalThis.fetch;
  const date = new Date(Date.now() - 3600000).toUTCString();
  globalThis.fetch = async url => new Response(`<rss><channel>${String(url).includes('feeds.elpais.com') ? [['a', 'OpenAI presenta ChatGPT'], ['b', 'El Congreso vota una ley']].map(([id, title]) => `<item><title>${title}</title><link>https://elpais.com/espana/${id}</link><pubDate>${date}</pubDate></item>`).join('') : ''}</channel></rss>`);
  try {
    const response = await api(new Request('https://brujula.test/api/edition', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scope: 'espana', hours: 12, length: 'short', profile: { blockedTerms: ['OpenAI'] } }) }), {});
    assert.equal(response.status, 200);
    const edition = await response.json(); assert.equal(edition.mode, 'extractive');
    assert.deepEqual(edition.articles.map(a => a.title), ['El Congreso vota una ley']);
  } finally { globalThis.fetch = original; }
});
