import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMusic, musicGenres, musicEventAllowed } from '../public/music-filters.js';
import { annotateArticle, normalizeProfile, personalize } from '../public/personalization.js';
import { parseFeed, sources } from '../server/news.js';
import { selectBulletin } from '../public/bulletin.js';
import { api } from '../server/handler.js';
const now = Date.UTC(2026, 9, 11, 12);
const music = (id, title, hours = 1, source = 'nme') => annotateArticle({ id, title, excerpt: '', source, publishedAt: new Date(now - hours * 3600000).toISOString(), coverage: 'mundo' }, '', 'musica');

test('Genres recognize bands and English or Spanish style labels', () => {
  for (const [title, genre] of [['Arctic Monkeys announce new music', 'indie'], ['Foo Fighters share a new album', 'rock'], ['Radiohead share a song', 'alternativo'], ['Pearl Jam announce their next album', 'grunge'], ['Green Day announce new music', 'punk'], ['Oasis anuncia nuevo disco', 'britpop'], ['Una banda de rock alternativo presenta canciones', 'alternativo'], ['New indie pop songs', 'indie']]) {
    assert.ok(classifyMusic({ title }).musicGenres.includes(genre), title);
  }
  const grunge = classifyMusic({ title: 'Soundgarden', excerpt: '' }, '', true).musicGenres;
  assert.ok(grunge.includes('grunge') && grunge.includes('alternativo') && grunge.includes('rock'));
});
test('Ambiguous names and indie games do not become music news', () => {
  for (const title of ['El oasis del desierto', 'Blur effect tutorial', 'Pulp production in Spain', 'Cast your vote in Madrid', 'Indie game launches a single player mode', 'Rock formations in Spain', 'The national budget rises']) {
    assert.deepEqual(classifyMusic({ title }).musicGenres, [], title);
  }
  assert.ok(classifyMusic({ title: 'Oasis announce reunion' }, '', true).musicGenres.includes('britpop'));
});
test('Spanish event filter requires both a live event and Spanish location', () => {
  for (const title of ['Pearl Jam anuncia conciertos en España', 'Arctic Monkeys announce tour dates in Barcelona', 'Radiohead tocará en Madrid', 'Oasis encabeza el Mad Cool']) assert.equal(classifyMusic({ title }, '', true).musicSpainEvent, true, title);
  for (const title of ['Oasis anuncia nuevo disco en Madrid', 'Pearl Jam announce concerts in London', 'Foo Fighters announce a European tour', 'El festival de cine de Barcelona', 'Primavera Sound Porto lineup announced']) assert.equal(classifyMusic({ title }).musicSpainEvent, false, title);
});

test('Live visits recognize Spain, continental Europe and the UK without turning albums into tours', () => {
  for (const title of ['Pearl Jam concierto en Madrid', 'Radiohead announce a European tour', 'Oasis announce UK tour dates', 'The Strokes play London', 'Foo Fighters concierto en París', 'Pearl Jam at Glastonbury']) {
    const article = music('event', title);
    assert.equal(musicEventAllowed(article), true, title);
    if (article.musicLiveEvent) assert.ok(article.musicEventLocations.includes('europe'), title);
  }
  for (const title of ['Pearl Jam announce Australian tour', 'Radiohead announce concerts in Melbourne', 'Oasis announce US tour dates in Los Angeles', 'Foo Fighters gira por Japón', 'Arctic Monkeys concierto en Buenos Aires']) {
    const article = music('event', title);
    assert.equal(musicEventAllowed(article), false, title);
    assert.equal(musicEventAllowed(article, 'world'), true, title);
  }
  const album = annotateArticle({title:'Pearl Jam announce new album',excerpt:'Recorded in Australia after their tour in Sydney.'}, '', 'musica');
  assert.equal(album.musicLiveEvent, false);
  assert.equal(musicEventAllowed(album), true);
  assert.equal(musicEventAllowed(music('unknown', 'Pearl Jam announce a tour')), true, 'unknown destination is not a foreign visit');
});

test('Headline destinations override incidental background; mixed tours and artist origins are handled', () => {
  const classify = (title, excerpt = '') => classifyMusic({title, excerpt}, '', true);
  assert.equal(musicEventAllowed(classify('Radiohead concerts in Sydney', 'They last played Madrid and London.')), false);
  assert.equal(musicEventAllowed(classify('London band announce Australian tour')), false);
  assert.equal(musicEventAllowed(classify('Australian band announce concerts in London')), true);
  assert.equal(musicEventAllowed(classify('Pearl Jam announce tour in Australia and Europe')), true);
  assert.equal(musicEventAllowed(classify('Oasis announce tour dates', 'Shows in Berlin and Madrid.')), true);
  assert.equal(musicEventAllowed({...classify('Radiohead concierto en Tokio'),kind:'anniversary'}), true);
  assert.equal(musicEventAllowed({title:'El Tour de Francia llega a París', category:'deportes'}), true);
});

test('Visit destinations affect the radar and every edition while preserving general band news', () => {
  const items = [music('spain', 'Pearl Jam concierto Madrid'), music('uk', 'Pearl Jam concierto Londres'), music('australia', 'Pearl Jam concierto Melbourne'), music('album', 'Pearl Jam nuevo disco en Australia')];
  const ids = list => list.map(a => a.id).sort();
  assert.deepEqual(ids(personalize(items, {musica:3}, 10, {}, {now})), ['album','spain','uk']);
  for (const scope of ['personal','mundo','espana']) {
    const articles = items.map(a => ({...a,coverage:scope==='espana'?'espana':'mundo'}));
    const opts = {scope,now,preferences:{musica:3},profile:{}};
    assert.deepEqual(ids(selectBulletin(articles,opts)), ['album','spain','uk']);
    assert.deepEqual(ids(selectBulletin(articles,{...opts,profile:{musicEventRegion:'spain'}})), ['album','spain']);
    assert.deepEqual(ids(selectBulletin(articles,{...opts,profile:{musicEventRegion:'world'}})), ['album','australia','spain','uk']);
  }
});

test('Old profiles adopt Europe for visits and retain the separate Spain-only event mode', () => {
  for (const value of [undefined,null,'invalid',{},true]) assert.equal(normalizeProfile({musicEventRegion:value}).musicEventRegion,'europe');
  for (const region of ['spain','europe','world']) assert.equal(normalizeProfile({musicEventRegion:region}).musicEventRegion,region);
  assert.equal(normalizeProfile({musicSpainOnly:true}).musicSpainOnly,true);
});
test('Music genres and Spanish event mode intersect, and can return no matches', () => {
  const articles = [music('rock-spain', 'Pearl Jam concierto en Madrid'), music('rock-london', 'Pearl Jam concierto en Londres'), music('rock-album', 'Pearl Jam nuevo disco'), music('pop-spain', 'Taylor Swift concierto en Madrid')];
  const profile = { musicGenres: ['grunge'], musicSpainOnly: true };
  assert.deepEqual(personalize(articles, { musica: 3 }, 10, profile, { now }).map(a => a.id), ['rock-spain']);
  assert.deepEqual(selectBulletin(articles, { scope: 'personal', now, hours: 12, preferences: { musica: 3 }, profile }).map(a => a.id), ['rock-spain']);
  assert.equal(personalize(articles, { musica: 3 }, 10, { musicGenres: ['punk'], musicSpainOnly: true }, { now }).length, 0);
  assert.equal(personalize(articles, { musica: 3 }, 10, { musicGenres: ['grunge'] }, { now }).length, 3);
  assert.equal(personalize(articles, { musica: 3 }, 10, {}, { now }).length, 4);
});
test('Music filters retain freshness, exclusions, custom priority and other categories', () => {
  const articles = [music('old', 'Pearl Jam concierto Madrid', 30), music('new', 'Pearl Jam concierto Barcelona', 1, 'excluded'), music('fav', 'Radiohead concierto Madrid', 1), music('other', 'Foo Fighters concierto Bilbao', 1), annotateArticle({ id: 'tech', title: 'OpenAI presenta ChatGPT', excerpt: '', source: 'xataka', publishedAt: new Date(now - 3600000).toISOString() })];
  const profile = { musicGenres: ['rock'], musicSpainOnly: true, excludedSources: ['excluded'], keywords: ['Radiohead'] };
  const chosen = personalize(articles, { musica: 3, tecnologia: 2 }, 10, profile, { now });
  assert.deepEqual(chosen.map(a => a.id), ['fav', 'tech', 'other']);
  assert.ok(chosen[0].matchReasons.includes('Conciertos en España'));
  assert.ok(chosen[0].matchReasons.includes('Radiohead'));
  assert.deepEqual(selectBulletin(articles, { scope: 'mundo', now, profile }).map(a => a.id), selectBulletin(articles, { scope: 'mundo', now, profile: { excludedSources: ['excluded'] } }).map(a => a.id));
});
test('Old profiles keep defaults and genre settings are validated independently of subtopics', () => {
  assert.deepEqual(normalizeProfile({}).musicGenres, []);
  assert.equal(normalizeProfile({ musicSpainOnly: 'true' }).musicSpainOnly, false);
  const p = normalizeProfile({ musicGenres: ['invalid', ...musicGenres.map(g => g.id), 'indie'], musicSpainOnly: true, topics: { musica: ['conciertos'] } });
  assert.equal(p.musicGenres.length, 6); assert.equal(p.musicSpainOnly, true);
  assert.deepEqual(p.topics.musica, ['conciertos']);
});
test('Genre information from RSS tags and general outlets survives parsing with stable IDs', () => {
  const source = sources.find(s => s.id === 'elpais');
  const xml = `<rss><channel><item><title>Radiohead presenta un nuevo disco</title><link>https://elpais.com/cultura/music-story</link><pubDate>${new Date(now - 3600000).toUTCString()}</pubDate><category>Alternative rock</category></item></channel></rss>`;
  const [article] = parseFeed(xml, source, now);
  assert.ok(article.musicGenres.includes('alternativo'));
  assert.ok(article.categories.includes('musica'));
  assert.equal(personalize([article], { musica: 3 }, 10, { musicGenres: ['alternativo'] }, { now }).length, 1);
  let hash = 2166136261;
  for (const c of article.url) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  assert.equal(article.id, 'elpais-' + (hash >>> 0).toString(36));
});
test('Config advertises all six music genres', async () => {
  const config = await (await api(new Request('https://brujula.test/api/config'), {})).json();
  assert.deepEqual(config.musicGenres.map(g => g.id), ['indie', 'rock', 'alternativo', 'grunge', 'punk', 'britpop']);
});
test('Published API contract applies both filters to personal editions without a voice provider', async () => {
  const original = globalThis.fetch;
  const date = new Date(Date.now() - 3600000).toUTCString();
  const entries = [['local', 'Pearl Jam anuncia concierto en Madrid'], ['world', 'Pearl Jam anuncia concierto en Londres'], ['pop', 'Taylor Swift anuncia concierto en Madrid'], ['australia', 'Pearl Jam anuncia concierto en Melbourne'], ['album', 'Pearl Jam nuevo disco']];
  globalThis.fetch = async url => new Response(`<rss><channel>${String(url).includes('nme.com') ? entries.map(([id, title]) => `<item><title>${title}</title><link>https://www.nme.com/news/music/${id}</link><pubDate>${date}</pubDate></item>`).join('') : ''}</channel></rss>`);
  try {
    const make = profile => api(new Request('https://brujula.test/api/edition', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scope: 'personal', hours: 12, length: 'short', preferences: { musica: 3 }, profile, audio: true }) }), {});
    const response = await make({ musicGenres: ['grunge'], musicSpainOnly: true });
    assert.equal(response.status, 200);
    const edition = await response.json();
    assert.equal(edition.mode, 'extractive');
    assert.equal(edition.audio, undefined);
    assert.equal(edition.articles.length, 1);
    assert.equal(edition.articles[0].title, entries[0][1]);
    const europe = await (await make({musicGenres:['grunge']})).json();
    assert.ok(europe.articles.some(a => a.title === entries[1][1]));
    assert.ok(europe.articles.some(a => a.title === entries[4][1]));
    assert.ok(!europe.articles.some(a => a.title === entries[3][1]));
    assert.equal((await make({ musicGenres: ['punk'], musicSpainOnly: true })).status, 422);
  } finally { globalThis.fetch = original; }
});
