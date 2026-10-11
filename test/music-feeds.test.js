import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, sources, personalize } from '../server/news.js';
import { selectBulletin } from '../public/bulletin.js';

const now = Date.UTC(2026, 9, 11, 12);
function story(sourceId, title, hours = 1) {
  const source = sources.find(s => s.id === sourceId);
  const feed = source.feeds[0];
  const url = source.site.replace(/\/$/, '') + '/music-story';
  const xml = `<rss><channel><item><title>${title}</title><link>${url}</link><pubDate>${new Date(now - hours * 3600000).toUTCString()}</pubDate><description>RSS summary.</description></item></channel></rss>`;
  return parseFeed(xml, { ...source, ...feed }, now);
}

test('English music feeds preserve headlines and match strict musical subtopics', () => {
  const title = 'A new artist announces tour dates and songs at a festival';
  const [article] = story('rollingstone', title);
  assert.equal(article.title, title);
  assert.equal(article.category, 'musica');
  for (const topic of ['conciertos', 'lanzamientos', 'festivales', 'internacional']) assert.ok(article.topics.includes('musica:' + topic));
  const chosen = personalize([article], { musica: 3 }, 10, { topicMode: 'strict', topics: { musica: ['conciertos'] } }, { now });
  assert.equal(chosen.length, 1);
  assert.ok(chosen[0].matchReasons.includes('Conciertos y giras'));
});

test('Musical stories respect geography, source exclusions and freshness', () => {
  const world = story('pitchfork', 'An artist announces a new album');
  const local = story('jenesaispop', 'Un artista anuncia un concierto');
  assert.equal(world[0].coverage, 'mundo');
  assert.equal(local[0].coverage, 'espana');
  assert.equal(story('billboard', 'A band announces a concert in Barcelona')[0].coverage, 'espana');
  assert.deepEqual(selectBulletin([...world, ...local], { now, scope: 'mundo' }).map(a => a.source), ['pitchfork']);
  assert.deepEqual(selectBulletin([...world, ...local], { now, scope: 'espana' }).map(a => a.source), ['jenesaispop']);
  assert.equal(story('mondosonoro', 'Nuevo disco', 72).length, 0);
  assert.equal(personalize(world, { musica: 3 }, 10, { excludedSources: ['pitchfork'] }, { now }).length, 0);
  assert.equal(personalize(world, { musica: 3 }, 10, { topicMode: 'strict', topics: { musica: ['conciertos'] } }, { now }).length, 0);
});

test('Music-specific cues do not classify general cycling tours or film festivals as music', () => {
  const [cycling] = story('elpais', 'El Tour de Francia anuncia sus etapas');
  const [film] = story('elpais', 'El festival de cine presenta sus películas');
  assert.ok(!cycling.categories.includes('musica'));
  assert.ok(!cycling.topics.includes('musica:conciertos'));
  assert.ok(!film.topics.includes('musica:festivales'));
  assert.equal(film.category, 'cultura');
});
