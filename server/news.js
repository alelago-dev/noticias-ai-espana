import { XMLParser } from 'fast-xml-parser';
import { decodeHTML } from 'entities';

import { categories, regions, annotateArticle, normalizePreferences, normalizeProfile, personalize, normalizeText } from '../public/personalization.js';
export { categories, regions, normalizePreferences, normalizeProfile, personalize };

export const sources = [
  { id: 'elpais', name: 'EL PAÍS', site: 'https://elpais.com', hosts: ['elpais.com'], color: '#303d55', feeds: [
    { url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada' },
    { url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/deportes/portada', category: 'deportes' },
    { url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/cultura/portada', category: 'cultura' },
  ] },
  { id: 'abc', name: 'ABC', site: 'https://www.abc.es', hosts: ['abc.es'], color: '#6e4747', feeds: [{ url: 'https://www.abc.es/rss/feeds/abc_ultima.xml' }] },
  { id: 'eldiario', name: 'elDiario.es', site: 'https://www.eldiario.es', hosts: ['eldiario.es'], color: '#174871', feeds: [{ url: 'https://www.eldiario.es/rss/' }, { url: 'https://www.eldiario.es/rss/cultura/', category: 'cultura' }] },
  { id: 'europapress', name: 'Europa Press', site: 'https://www.europapress.es', hosts: ['europapress.es'], color: '#40519c', feeds: [
    { url: 'https://www.europapress.es/rss/rss.aspx' },
    { url: 'https://www.europapress.es/rss/rss.aspx?ch=00066', category: 'deportes' },
    { url: 'https://www.europapress.es/rss/rss.aspx?ch=00067', category: 'economia' },
  ] },
  { id: 'xataka', name: 'Xataka', site: 'https://www.xataka.com', hosts: ['xataka.com'], color: '#486500', feeds: [{ url: 'https://www.xataka.com/index.xml', category: 'tecnologia' }] },
  { id: 'elmundo', name: 'EL MUNDO', site: 'https://www.elmundo.es', hosts: ['elmundo.es'], color: '#394a4d', feeds: [{ url: 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml' }] },
  { id: '20minutos', name: '20minutos', site: 'https://www.20minutos.es', hosts: ['20minutos.es'], color: '#3768ae', feeds: [{ url: 'https://www.20minutos.es/rss/' }] },
  { id: 'lavanguardia', name: 'La Vanguardia', site: 'https://www.lavanguardia.com', hosts: ['lavanguardia.com'], color: '#345b81', feeds: [{ url: 'https://www.lavanguardia.com/rss/home.xml' }] },
  { id: 'elconfidencial', name: 'El Confidencial', site: 'https://www.elconfidencial.com', hosts: ['elconfidencial.com'], color: '#244e74', feeds: [{ url: 'https://rss.elconfidencial.com/espana/', category: 'espana' }] },
  { id: 'elespanol', name: 'EL ESPAÑOL', site: 'https://www.elespanol.com', hosts: ['elespanol.com'], color: '#344659', feeds: [{ url: 'https://www.elespanol.com/rss' }] },
  { id: 'infobae', name: 'Infobae España', site: 'https://www.infobae.com/espana/', hosts: ['infobae.com'], color: '#e47725', feeds: [{ url: 'https://www.infobae.com/arc/outboundfeeds/rss/category/espana/?outputType=xml' }] },
];

const parser = new XMLParser({ ignoreAttributes: false, processEntities: true, removeNSPrefix: true });
const scalar = value => Array.isArray(value) ? scalar(value[0]) : typeof value === 'object' && value ? String(value['#text'] ?? '') : String(value ?? '');
export function cleanText(value) {
  return decodeHTML(scalar(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}
export function articleURL(value, source) {
  try {
    const u = new URL(scalar(value));
    if (u.protocol !== 'https:' || u.username || u.password || !source.hosts.some(h => u.hostname === h || u.hostname.endsWith('.' + h))) return null;
    for (const key of [...u.searchParams.keys()]) if (/^utm_|^fbclid$/.test(key)) u.searchParams.delete(key);
    u.hash = '';
    return u.href;
  } catch { return null; }
}

export function classify(text, fallback = 'espana') {
  return annotateArticle({ title: text, excerpt: '' }, '', fallback).category;
}

export function parseFeed(xml, source, now = Date.now()) {
  const data = parser.parse(xml);
  const items = data.rss?.channel?.item ?? data.feed?.entry ?? [];
  return (Array.isArray(items) ? items : [items]).flatMap((item, feedPosition) => {
    const link = Array.isArray(item.link) ? item.link.find(x => x['@_rel'] === 'alternate')?.['@_href'] : item.link?.['@_href'] || item.link;
    const url = articleURL(link, source);
    const title = cleanText(item.title).slice(0, 300);
    const published = new Date(scalar(item.pubDate || item.published || item.updated || item.date || item['dc:date']));
    // No dates invented, no future or stale items in the current edition.
    if (!url || !title || Number.isNaN(+published) || +published > now + 5 * 60_000 || now - +published > 48 * 3600_000) return [];
    // Keep only the short RSS excerpt; never fetch or reproduce whole articles.
    const rawExcerpt = cleanText(item.description || item.summary).slice(0, 600);
    const excerpt = rawExcerpt.length > 450 ? rawExcerpt.slice(0, 447).replace(/\s\S*$/, '') + '…' : rawExcerpt;
    const tags = (Array.isArray(item.category) ? item.category : [item.category]).map(cleanText).join(' ');
    
    let hash = 2166136261;
    for (const c of url) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    const article = annotateArticle({ id: source.id + '-' + (hash >>> 0).toString(36), title, excerpt, url, publishedAt: published.toISOString(), source: source.id, sourceName: source.name, feedPosition, generalFeed: !source.category }, tags, source.category || 'espana');
    const internationalSection = /\/(internacional|international|mundo|world)(\/|-)/i.test(new URL(url).pathname) || /\b(internacional|mundo|international|world)\b/.test(normalizeText(tags));
    const domesticSection = /\/(espana|politica|nacional|andalucia|madrid|catalunya|cataluna|comunidad-valenciana)(\/|-)/i.test(new URL(url).pathname);
    const foreign = /\b(ucrania|rusia|israel|gaza|libano|iran|china|estados unidos|trump|zelenski|putin|netanyahu|francia|alemania|reino unido|portugal|argentina|brasil|mexico|venezuela)\b/.test(normalizeText(title));
    article.coverage = internationalSection ? 'mundo' : domesticSection || article.regions.length ? 'espana' : article.category === 'internacional' || foreign ? 'mundo' : 'espana';
    return [article];
  });
}

let cached = null;
let inflight = null;
export async function getNews(fetcher = fetch, { force = false } = {}) {
  if (cached && Date.now() - cached.fetched < (force ? 30_000 : 120_000)) return cached.data;
  if (inflight) return inflight;
  inflight = (async () => {
    const tasks = sources.flatMap(source => source.feeds.map(feed => ({ source, feed })));
    const results = [];
    // Four feeds at a time keeps feed parsing within the Worker memory budget.
    let cursor = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (cursor < tasks.length) {
        const { source, feed } = tasks[cursor++];
        try {
          const r = await fetcher(feed.url, { headers: { 'User-Agent': 'Brujula/2.0 (RSS news reader)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(8000) });
          if (!r.ok) throw new Error('RSS unavailable');
          const xml = await r.text();
          if (xml.length > 3_000_000) throw new Error('Feed too large');
          const items = parseFeed(xml, { ...source, category: feed.category });
          results.push({ source: source.id, available: true, items });
        } catch { results.push({ source: source.id, available: false, items: [] }); }
      }
    }));
    const unique = new Map();
    for (const a of results.flatMap(r => r.items)) {
      const previous = unique.get(a.url);
      if (!previous || a.generalFeed && !previous.generalFeed) unique.set(a.url, a);
    }
    // Preserve different publishers' coverage for the bulletin's shared-story ranking.
    const articles = [...unique.values()].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
    const now = Date.now();
    const statuses = sources.map(s => {
      const feeds = results.filter(r => r.source === s.id);
      const items = [...new Map(feeds.flatMap(f => f.items).map(a => [a.url, a])).values()].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
      const latestPublishedAt = items[0]?.publishedAt ?? null;
      return { id: s.id, name: s.name, available: feeds.some(f => f.available), activeFeeds: feeds.filter(f => f.available).length, totalFeeds: s.feeds.length, count: items.length, recentCount: items.filter(a => now - +new Date(a.publishedAt) <= 24 * 3600_000).length, latestPublishedAt, checkedAt: new Date(now).toISOString(), fresh: !!latestPublishedAt && now - +new Date(latestPublishedAt) <= 24 * 3600_000 };
    });
    const data = { articles, sources: statuses, updatedAt: new Date(now).toISOString(), latestPublishedAt: articles[0]?.publishedAt ?? null };
    cached = { fetched: now, data };
    return data;
  })().finally(() => { inflight = null; });
  return inflight;
}

const stopwords = new Set('que qué como cómo las los del una uno unos unas por para con sin sobre más esta este estos estas hay son fue han hoy noticias noticia quiero saber dime puedes pasa está están ocurre actualidad'.split(' '));
export function findEvidence(question, articles) {
  const words = cleanText(question).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]{3,}/g) || [];
  const tokens = [...new Set(words.filter(w => !stopwords.has(w)))];
  if (!tokens.length) return [];
  const score = a => {
    const text = (a.title + ' ' + a.excerpt).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return tokens.filter(w => text.includes(w)).length;
  };
  return articles.map(a => ({ a, s: score(a) })).filter(x => x.s >= Math.min(2, tokens.length)).sort((a, b) => b.s - a.s).slice(0, 6).map(x => x.a);
}
