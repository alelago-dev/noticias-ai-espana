import { decodeHTML } from 'entities';
import { cacheGetJSON, cachePutJSON, sha256Hex } from './cache.js';

const inflight = new Map();
const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';
const textOnly = value => decodeHTML(String(value ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const normalized = value => textOnly(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const music = /\b(cantantes?|cantautor(?:a|es|as)?|compositor(?:a|es|as)?|musicos?|musicas?|musical(?:es)?|pianistas?|guitarristas?|bajistas?|violinistas?|vocalistas?|saxofonistas?|flautistas?|bateristas?|sopranos?|tenor(?:es)?|baritonos?|operas?|orquestas?|cancion(?:es)?|album(?:es)?|rock|pop|jazz|rap|hip hop|regueton)\b/;
const kinds = { events: 'Acontecimiento', births: 'Nacimiento', deaths: 'Fallecimiento' };
const anchors = { events: 'Acontecimientos', births: 'Nacimientos', deaths: 'Fallecimientos' };

function calendarURL(day) {
  const month = new Intl.DateTimeFormat('es-ES', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(day.year, Number(day.month) - 1, Number(day.day))));
  return 'https://es.wikipedia.org/wiki/' + Number(day.day) + '_de_' + month;
}

export function madridDay(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const part = type => parts.find(p => p.type === type).value;
  return { date: `${part('year')}-${part('month')}-${part('day')}`, year: Number(part('year')), month: part('month'), day: part('day') };
}

function wikiURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'es.wikipedia.org' && url.pathname.startsWith('/wiki/') && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export async function normalizeAnniversaries(data, day) {
  if (!data || !Object.keys(kinds).some(kind => Array.isArray(data[kind]))) throw new Error('Invalid anniversary feed');
  const items = [], seen = new Set();
  for (const [kind, label] of Object.entries(kinds)) {
    for (const event of (data[kind] || []).slice(0, 500)) {
      if (!event || !Number.isInteger(event.year) || event.year < 1 || event.year >= day.year) continue;
      const text = textOnly(event.text);
      const pages = Array.isArray(event.pages) ? event.pages : [];
      const musicalPages = pages.filter(page => music.test(normalized(page.description)) || /\b(album|cancion|opera)\b/.test(normalized(page.titles?.normalized || page.title)));
      // A generic "banda" may mean a gang. Require musical text or a musical
      // biography/album page rather than treating that word as sufficient.
      if (!music.test(normalized(text)) && !musicalPages.length) continue;
      const ordered = [...musicalPages, ...pages];
      const page = ordered.find(p => wikiURL(p.content_urls?.desktop?.page));
      const url = page && wikiURL(page.content_urls.desktop.page);
      if (!url || !text) continue;
      const dedupKey = kind + '/' + event.year + '/' + normalized(text);
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      const excerpt = text.length > 500 ? text.slice(0, 497).replace(/\s\S*$/, '') + '…' : text;
      items.push({ id: 'anniversary-' + (await sha256Hex(dedupKey)).slice(0, 16), kind, label, year: event.year, yearsAgo: day.year - event.year, title: textOnly(page.titles?.normalized || page.title).replace(/_/g, ' ').slice(0, 160), text: excerpt, url, sourceURL: calendarURL(day) + '#' + anchors[kind], sourceName: 'Wikipedia en español', license: 'CC BY-SA 4.0', licenseURL: LICENSE_URL });
    }
  }
  return items.sort((a, b) => Object.keys(kinds).indexOf(a.kind) - Object.keys(kinds).indexOf(b.kind) || b.year - a.year).slice(0, 80);
}

export function filterAnniversaries(items, { era = 'all', kind = 'all' } = {}) {
  return items.filter(item => (era !== '80s' || item.year >= 1980 && item.year <= 1989) && (kind === 'all' || item.kind === kind));
}

export async function getMusicAnniversaries(fetcher = fetch, now = Date.now()) {
  const day = madridDay(now), key = 'music-anniversaries/' + day.date;
  const cached = await cacheGetJSON(key);
  if (cached?.date === day.date && Array.isArray(cached.items)) return cached;
  if (inflight.has(key)) return inflight.get(key);
  const job = (async () => {
    const paths = [`https://es.wikipedia.org/api/rest_v1/feed/onthisday/all/${day.month}/${day.day}`, `https://api.wikimedia.org/feed/v1/wikipedia/es/onthisday/all/${day.month}/${day.day}`];
    for (const url of paths) {
      try {
        const r = await fetcher(url, { headers: { 'User-Agent': 'Brujula/2.0 (https://github.com/alelago-dev/noticias-ai-espana)', Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error('Anniversary HTTP ' + r.status);
        const body = await r.text();
        if (body.length > 3_000_000) throw new Error('Anniversary feed too large');
        const items = await normalizeAnniversaries(JSON.parse(body), day);
        const result = { date: day.date, timezone: 'Europe/Madrid', available: true, items, checkedAt: new Date(now).toISOString(), sourceName: 'Wikipedia en español', sourceURL: calendarURL(day), license: 'CC BY-SA 4.0', licenseURL: LICENSE_URL };
        await cachePutJSON(key, result, 6 * 3600);
        return result;
      } catch {}
    }
    return { date: day.date, timezone: 'Europe/Madrid', available: false, items: [], checkedAt: new Date(now).toISOString(), sourceName: 'Wikipedia en español', sourceURL: 'https://es.wikipedia.org', license: 'CC BY-SA 4.0', licenseURL: LICENSE_URL };
  })();
  inflight.set(key, job);
  try { return await job; } finally { inflight.delete(key); }
}
