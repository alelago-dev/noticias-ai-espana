import { XMLParser } from 'fast-xml-parser';
import { decodeHTML } from 'entities';
import { readRSSFeed } from './rss-feed.js';

import { categories, regions, annotateArticle, normalizePreferences, normalizeProfile, personalize, normalizeText } from '../public/personalization.js';
export { categories, regions, normalizePreferences, normalizeProfile, personalize };

export const sources = [
  { id: 'elpais', name: 'EL PAÍS', site: 'https://elpais.com', hosts: ['elpais.com'], color: '#303d55', feeds: [
    { url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada' },
    { url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/deportes/portada', category: 'deportes' },
    { url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/cultura/portada', category: 'cultura' },
  ] },
  { id: 'abc', name: 'ABC', site: 'https://www.abc.es', hosts: ['abc.es'], color: '#6e4747', feeds: [{ url: 'https://www.abc.es/rss/feeds/abc_ultima.xml' }] },
  { id: 'eldiario', name: 'elDiario.es', site: 'https://www.eldiario.es', hosts: ['eldiario.es'], color: '#174871', feeds: [{ url: 'https://www.eldiario.es/rss/' }, { url: 'https://www.eldiario.es/rss/cultura/', category: 'cultura' }, { url: 'https://www.eldiario.es/rss/catalunya', region: 'cataluna' }] },
  { id: 'europapress', name: 'Europa Press', site: 'https://www.europapress.es', hosts: ['europapress.es'], color: '#40519c', feeds: [
    { url: 'https://www.europapress.es/rss/rss.aspx' },
    { url: 'https://www.europapress.es/rss/rss.aspx?ch=00066', category: 'deportes' },
    { url: 'https://www.europapress.es/rss/rss.aspx?ch=00067', category: 'economia' },
  ] },
  { id: 'xataka', name: 'Xataka', site: 'https://www.xataka.com', hosts: ['xataka.com'], color: '#486500', feeds: [{ url: 'https://www.xataka.com/index.xml', category: 'tecnologia' }] },
  { id: 'elmundo', name: 'EL MUNDO', site: 'https://www.elmundo.es', hosts: ['elmundo.es'], color: '#394a4d', feeds: [{ url: 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml' }] },
  { id: '20minutos', name: '20minutos', site: 'https://www.20minutos.es', hosts: ['20minutos.es'], color: '#3768ae', feeds: [{ url: 'https://www.20minutos.es/rss/' }, { url: 'https://www.20minutos.es/rss/cataluna/barcelona/', region: 'cataluna' }] },
  { id: 'lavanguardia', name: 'La Vanguardia', site: 'https://www.lavanguardia.com', hosts: ['lavanguardia.com'], color: '#345b81', feeds: [{ url: 'https://www.lavanguardia.com/rss/home.xml' }, { url: 'https://www.lavanguardia.com/rss/local/barcelona.xml', region: 'cataluna' }] },
  { id: 'elperiodico', name: 'El Periódico', site: 'https://www.elperiodico.com', hosts: ['elperiodico.com'], color: '#b52d3a', feeds: [{ url: 'https://www.elperiodico.com/es/rss/rss_portada.xml' }, { url: 'https://www.elperiodico.com/es/rss/barcelona/rss.xml', region: 'cataluna' }] },
  { id: 'elconfidencial', name: 'El Confidencial', site: 'https://www.elconfidencial.com', hosts: ['elconfidencial.com'], color: '#244e74', feeds: [{ url: 'https://rss.elconfidencial.com/espana/', category: 'espana' }] },
  { id: 'elespanol', name: 'EL ESPAÑOL', site: 'https://www.elespanol.com', hosts: ['elespanol.com'], color: '#344659', feeds: [{ url: 'https://www.elespanol.com/rss' }] },
  { id: 'infobae', name: 'Infobae España', site: 'https://www.infobae.com/espana/', hosts: ['infobae.com'], color: '#e47725', feeds: [{ url: 'https://www.infobae.com/arc/outboundfeeds/rss/category/espana/', fallback: 'feedly' }] },
  { id: 'billboard', name: 'Billboard', site: 'https://www.billboard.com', hosts: ['billboard.com'], color: '#5066aa', feeds: [{ url: 'https://www.billboard.com/feed/', category: 'musica', coverage: 'mundo', fallback: 'feedly' }] },
  { id: 'rollingstone', name: 'Rolling Stone', site: 'https://www.rollingstone.com/music/music-news/', hosts: ['rollingstone.com'], color: '#b72c42', feeds: [{ url: 'https://www.rollingstone.com/music/music-news/feed/', category: 'musica', coverage: 'mundo', fallback: 'feedly' }] },
  { id: 'pitchfork', name: 'Pitchfork', site: 'https://pitchfork.com/news/', hosts: ['pitchfork.com'], color: '#7b547d', feeds: [{ url: 'https://pitchfork.com/feed/feed-news/rss', category: 'musica', coverage: 'mundo', fallback: 'feedly' }] },
  { id: 'nme', name: 'NME', site: 'https://www.nme.com/news/music', hosts: ['nme.com'], color: '#a64444', feeds: [{ url: 'https://www.nme.com/news/music/feed', category: 'musica', coverage: 'mundo', fallback: 'feedly' }] },
  { id: 'stereogum', name: 'Stereogum', site: 'https://stereogum.com', hosts: ['stereogum.com'], color: '#5a697d', feeds: [{ url: 'https://stereogum.com/feed', category: 'musica', coverage: 'mundo', fallback: 'feedly' }] },
  { id: 'consequence', name: 'Consequence', site: 'https://consequence.net', hosts: ['consequence.net'], color: '#79679b', feeds: [{ url: 'https://consequence.net/feed/', category: 'musica', coverage: 'mundo', fallback: 'feedly' }] },
  { id: 'guardianmusica', name: 'The Guardian · Música', site: 'https://www.theguardian.com/music', hosts: ['theguardian.com'], color: '#396b85', feeds: [{ url: 'https://www.theguardian.com/music/rss', category: 'musica', coverage: 'mundo', fallback: 'feedly' }] },
  { id: 'jenesaispop', name: 'Jenesaispop', site: 'https://jenesaispop.com', hosts: ['jenesaispop.com'], color: '#aa5390', feeds: [{ url: 'https://jenesaispop.com/feed/', category: 'musica', fallback: 'feedly' }] },
  { id: 'mondosonoro', name: 'Mondo Sonoro', site: 'https://www.mondosonoro.com', hosts: ['mondosonoro.com'], color: '#80713f', feeds: [{ url: 'https://www.mondosonoro.com/feed/', category: 'musica', fallback: 'feedly' }] },
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

// Translate topic cues only inside editorial music feeds. This avoids turning
// a cycling tour or a film festival from a general feed into a music story.
function musicTopicMetadata(text) {
  const normalized = normalizeText(text);
  const cues = [
    [/\b(concerts?|gigs?|tours?|giras?|conciertos?|recitales?)\b/, 'concierto'],
    [/\b(albums?|discos?|singles?|songs?|canciones?|new ep|ep)\b/, 'cancion'],
    [/\b(festivals?|festivales?)\b/, 'festival de musica'],
    [/\b(classical|operas?|orchestras?|symphony|symphonies)\b/, 'musica clasica'],
    [/\b(electronic|electronica|hip hop|reggaeton|regueton|techno|rap|trap|djs?)\b/, 'musica electronica'],
  ];
  return cues.filter(([pattern]) => pattern.test(normalized)).map(([, cue]) => cue).join(' ');
}

export function parseFeed(xml, source, now = Date.now()) {
  const data = parser.parse(xml);
  const feedLanguage = scalar(data.rss?.channel?.language || data.feed?.['@_lang']);
  const language = /^en(?:[-_]|$)/i.test(feedLanguage) ? 'en' : /^es(?:[-_]|$)/i.test(feedLanguage) ? 'es' : undefined;
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
    const topicTags = source.category === 'musica' ? tags + ' ' + musicTopicMetadata(title + ' ' + excerpt + ' ' + tags) : tags;
    
    let hash = 2166136261;
    for (const c of url) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    const article = annotateArticle({ id: source.id + '-' + (hash >>> 0).toString(36), title, excerpt, url, language, publishedAt: published.toISOString(), source: source.id, sourceName: source.name, feedPosition, generalFeed: !source.category && !source.region }, topicTags, source.category || 'espana');
    if (source.category === 'musica') {
      article.category = 'musica';
      if (!article.categories.includes('musica')) article.categories.push('musica');
      if (source.coverage === 'mundo' && !article.topics.includes('musica:internacional')) article.topics.push('musica:internacional');
    }
    // Regional RSS sections supply location even when the headline omits it.
    if (regions.some(r => r.id === source.region) && !article.regions.includes(source.region)) article.regions.push(source.region);
    const internationalSection = /\/(internacional|international|mundo|world)(\/|-)/i.test(new URL(url).pathname) || /\b(internacional|mundo|international|world)\b/.test(normalizeText(tags));
    const domesticSection = /\/(espana|politica|nacional|andalucia|madrid|catalunya|cataluna|comunidad-valenciana)(\/|-)/i.test(new URL(url).pathname);
    const foreign = /\b(ucrania|rusia|israel|gaza|libano|iran|china|estados unidos|trump|zelenski|putin|netanyahu|francia|alemania|reino unido|portugal|argentina|brasil|mexico|venezuela)\b/.test(normalizeText(title));
    article.coverage = internationalSection ? 'mundo' : domesticSection || article.regions.length ? 'espana' : article.category === 'internacional' || foreign ? 'mundo' : source.coverage || 'espana';
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
          const { xml, relayed } = await readRSSFeed(feed, fetcher);
          const items = parseFeed(xml, { ...source, category: feed.category, region: feed.region, coverage: feed.coverage });
          results.push({ source: source.id, available: true, items, relayed });
        } catch (error) {
          console.warn('RSS fetch failed:', source.id, error instanceof Error ? error.message : 'Unknown error');
          results.push({ source: source.id, available: false, items: [], relayed: false });
        }
      }
    }));
    const unique = new Map();
    for (const a of results.flatMap(r => r.items)) {
      const previous = unique.get(a.url);
      if (previous) {
        const regionIds = [...new Set([...previous.regions, ...a.regions])];
        previous.regions = regionIds;
        a.regions = regionIds;
      }
      if (!previous || a.generalFeed && !previous.generalFeed) unique.set(a.url, a);
    }
    // Preserve different publishers' coverage for the bulletin's shared-story ranking.
    const articles = [...unique.values()].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
    const now = Date.now();
    const statuses = sources.map(s => {
      const feeds = results.filter(r => r.source === s.id);
      const items = [...new Map(feeds.flatMap(f => f.items).map(a => [a.url, a])).values()].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
      const latestPublishedAt = items[0]?.publishedAt ?? null;
      return { id: s.id, name: s.name, available: feeds.some(f => f.available), relayed: feeds.some(f => f.relayed), activeFeeds: feeds.filter(f => f.available).length, totalFeeds: s.feeds.length, count: items.length, recentCount: items.filter(a => now - +new Date(a.publishedAt) <= 24 * 3600_000).length, latestPublishedAt, checkedAt: new Date(now).toISOString(), fresh: !!latestPublishedAt && now - +new Date(latestPublishedAt) <= 24 * 3600_000 };
    });
    const data = { articles, sources: statuses, updatedAt: new Date(now).toISOString(), latestPublishedAt: articles[0]?.publishedAt ?? null };
    cached = { fetched: now, data };
    return data;
  })().finally(() => { inflight = null; });
  return inflight;
}

const stopwords = new Set('que como las los del una uno unos unas por para con sin sobre mas esta este estos estas hay son fue han hoy noticias noticia quiero saber dime puedes pasa estan ocurre actualidad ultimas ultima ultimos ultimo recientes reciente novedades informacion cuentame'.split(' '));
const aiTerms = ['inteligencia artificial', 'artificial intelligence', 'ia', 'ai', 'openai', 'chatgpt', 'anthropic', 'claude', 'gemini', 'deepseek', 'llm', 'modelo de lenguaje', 'modelos de lenguaje'];
const containsTerm = (text, term) => (' ' + text + ' ').includes(' ' + term + ' ');
function clubSubject(question) {
  const match = question.match(/\bclub(?: de futbol)?\s+(?:(?:atletico|deportivo)\s+(?!de\b))?(.+?)(?=\s+(?:de|en|hoy|ayer|ultimas|recientes|noticias|actualidad|como|que|cuando)\b|$)/);
  return match?.[1]?.trim() || '';
}
export function findEvidence(question, articles) {
  // The phrase and its short acronyms are one topic, not two mandatory words.
  // Do not match "ia" inside unrelated words such as Galicia or inmobiliaria.
  const normalized = normalizeText(cleanText(question)).replace(/\b(?:inteligencia artificial|artificial intelligence|ai)\b/g, 'ia');
  const club = clubSubject(normalized);
  const atlantaArgentina = club === 'atlanta';
  const descriptors = club ? ['club', ...(!containsTerm(club, 'atletico') ? ['atletico'] : []), ...(!containsTerm(club, 'deportivo') ? ['deportivo'] : []), ...(atlantaArgentina ? ['buenos', 'aires', 'argentina'] : [])] : [];
  const tokens = [...new Set(normalized.split(' ').filter(w => (w.length >= 3 || w === 'ia') && !stopwords.has(w) && !descriptors.includes(w)))];
  if (!tokens.length) return [];
  const score = a => {
    const text = normalizeText(a.title + ' ' + (a.excerpt || ''));
    // A club's actual name is mandatory, not merely words like "club" and
    // "atlético". An Argentine Atlanta query must not resolve to the US city.
    if (club && (!containsTerm(text, club) || !(a.category === 'deportes' || a.categories?.includes('deportes') || /\b(club|futbol|football|soccer|equipo|partido|jugador|jugadores|liga|entrenador|fichaje|bohemio|bohemios)\b/.test(text)))) return 0;
    if (atlantaArgentina && !containsTerm(text, 'club atletico atlanta') &&
      (!['buenos aires', 'argentina', 'villa crespo', 'bohemio', 'bohemios', 'primera nacional'].some(term => containsTerm(text, term)) || containsTerm(text, 'atlanta united'))) return 0;
    const hasAI = aiTerms.some(term => containsTerm(text, term));
    if (tokens.includes('ia') && !hasAI) return 0;
    return tokens.filter(w => w === 'ia' ? hasAI : containsTerm(text, w)).length;
  };
  return articles.map(a => ({ a, s: score(a) })).filter(x => x.s >= Math.max(1, Math.ceil(tokens.length * .75))).sort((a, b) => b.s - a.s).slice(0, 6).map(x => x.a);
}
