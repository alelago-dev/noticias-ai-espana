import test from 'node:test';
import assert from 'node:assert/strict';
import { madridDay, normalizeAnniversaries, filterAnniversaries, getMusicAnniversaries } from '../server/music-anniversaries.js';
import { api } from '../server/handler.js';

const page = (title, description = 'compositor español', url = 'https://es.wikipedia.org/wiki/Artista') => ({ titles: { normalized: title }, description, content_urls: { desktop: { page: url } } });
const event = (year, text, pages = [page('Artista')]) => ({ year, text, pages });
const day = { date: '2026-10-12', year: 2026, month: '10', day: '12' };

test('The calendar follows Madrid midnight, including summer and winter offsets', () => {
  assert.equal(madridDay(Date.UTC(2026, 9, 11, 22, 30)).date, '2026-10-12');
  assert.equal(madridDay(Date.UTC(2026, 11, 11, 22, 30)).date, '2026-12-11');
  assert.equal(madridDay(Date.UTC(2026, 11, 11, 23, 30)).date, '2026-12-12');
});

test('Musical anniversaries retain historical years, citations and licensing without inventing dates', async () => {
  const release = event(1984, '<b>Se publica un álbum.</b>', [page('Álbum', 'álbum musical')]);
  const data = { events: [release, release, event(2030, 'Se publica un álbum.'), event(2026, 'Se publica un álbum.'), event(2000, 'Una banda criminal es detenida.', [page('Crimen', 'organización criminal')]), event(1990, 'Nace un cantante.', [page('Ataque', 'cantante', 'https://es.wikipedia.org.attacker.test/wiki/Artista')])], births: [event(1900, 'Nace un compositor.')], deaths: [] };
  const items = await normalizeAnniversaries(data, day);
  assert.equal(items.length, 2);
  assert.equal(items[0].text, 'Se publica un álbum.');
  assert.equal(items[0].year, 1984);
  assert.equal(items[0].yearsAgo, 42);
  assert.equal(items[0].license, 'CC BY-SA 4.0');
  assert.ok(items.every(item => item.url.startsWith('https://es.wikipedia.org/wiki/')));
  assert.equal(items[0].sourceURL, 'https://es.wikipedia.org/wiki/12_de_octubre#Acontecimientos');
  assert.equal(filterAnniversaries(items, { era: '80s' }).length, 1);
  assert.equal(filterAnniversaries(items, { kind: 'births' })[0].year, 1900);
  await assert.rejects(normalizeAnniversaries({}, day), /Invalid anniversary feed/);
});

test('The daily feed is cached, filters do not require more provider calls, and a new day gets its own feed', async () => {
  let requests = 0;
  const fetcher = async url => { requests++; assert.match(url, /onthisday\/all\/10\/(12|13)$/); return new Response(JSON.stringify({ events: [event(1984, 'Se publica un álbum.')], births: [], deaths: [] })); };
  const date = Date.UTC(2035, 9, 12, 12);
  const first = await getMusicAnniversaries(fetcher, date);
  const second = await getMusicAnniversaries(fetcher, date);
  assert.equal(first.date, '2035-10-12');
  assert.equal(first.items[0].year, 1984);
  assert.equal(second.items[0].id, first.items[0].id);
  assert.equal(requests, 1);
  await getMusicAnniversaries(fetcher, date + 86400000);
  assert.equal(requests, 2);
});

test('Unavailable calendars return no invented anniversaries; invalid API filters and methods are rejected', async () => {
  const result = await getMusicAnniversaries(async () => new Response('', { status: 503 }), Date.UTC(2036, 0, 1));
  assert.equal(result.available, false);
  assert.deepEqual(result.items, []);
  assert.equal((await api(new Request('https://brujula.test/api/music-anniversaries?era=unknown'))).status, 400);
  assert.equal((await api(new Request('https://brujula.test/api/music-anniversaries', { method: 'POST' }))).status, 405);
});
