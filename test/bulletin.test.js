import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBulletin } from '../public/bulletin.js';
import { parseFeed, sources } from '../server/news.js';
const now = Date.UTC(2026, 9, 11, 8);
const item = (id, extra = {}) => ({ id, title: 'Titular de actualidad ' + id, excerpt: '', category: 'politica', coverage: 'espana', source: id, publishedAt: new Date(now - 3600000).toISOString(), ...extra });
test('Morning bulletin works without interests and keeps geographic scopes apart', () => {
  const articles = [item('national'), item('world', { coverage: 'mundo', category: 'internacional' })];
  assert.deepEqual(selectBulletin(articles, { now }).map(a => a.id), ['national']);
  assert.deepEqual(selectBulletin(articles, { now, scope: 'mundo', preferences: { deportes: 3 } }).map(a => a.id), ['world']);
});
test('Empty recent windows are not filled with stale news; exclusions remain effective', () => {
  const articles = [item('old', { publishedAt: new Date(now - 20 * 3600000).toISOString() }), item('excluded')];
  assert.equal(selectBulletin(articles, { now, profile: { excludedSources: ['excluded'] } }).length, 0);
  assert.deepEqual(selectBulletin(articles, { now, hours: 24, profile: { excludedSources: ['excluded'] } }).map(a => a.id), ['old']);
});
test('Independent coverage raises a story and produces one attributed item', () => {
  const articles = [item('a', { title: 'El alquiler aumenta durante septiembre en Madrid' }), item('b', { title: 'Aumenta el alquiler durante septiembre en Madrid' }), item('single', { title: 'Un festival cultural reúne músicos locales' })];
  const result = selectBulletin(articles, { now });
  assert.equal(result.length, 2);
  assert.equal(result[0].coverageSourceCount, 2);
  assert.ok(['a', 'b'].includes(result[0].id));
});
test('Bulletins cap one publisher and the personalized scope preserves topic filtering', () => {
  const articles = Array.from({ length: 8 }, (_, i) => item(String(i), { source: 'same', title: ['Economía local', 'Temporal costero', 'Comisión parlamentaria', 'Vivienda alquiler', 'Educación primaria', 'Sanidad pública', 'Justicia penal', 'Transporte urbano'][i], category: i ? 'politica' : 'tecnologia', topics: i ? [] : ['tecnologia:ia'] }));
  assert.equal(selectBulletin(articles, { now }).length, 4);
  assert.deepEqual(selectBulletin(articles, { now, scope: 'personal', preferences: { tecnologia: 3 }, profile: { topics: { tecnologia: ['ia'] }, topicMode: 'strict' } }).map(a => a.id), ['0']);
});
test('RSS section geography takes precedence over broad keywords', () => {
  const xml = `<rss><channel><item><title>España pide un acuerdo internacional</title><link>https://elpais.com/internacional/acuerdo.html</link><pubDate>${new Date(now).toUTCString()}</pubDate></item><item><title>El Congreso debate su relación con Estados Unidos</title><link>https://elpais.com/espana/congreso.html</link><pubDate>${new Date(now).toUTCString()}</pubDate></item></channel></rss>`;
  const articles = parseFeed(xml, sources[0], now);
  assert.deepEqual(articles.map(a => a.coverage), ['mundo', 'espana']);
  assert.deepEqual(articles.map(a => a.feedPosition), [0, 1]);
});
