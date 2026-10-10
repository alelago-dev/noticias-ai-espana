import { XMLParser } from 'fast-xml-parser';
import { decodeHTML } from 'entities';

export const categories = [
  { id: 'espana', name: 'España', icon: '◈' },
  { id: 'politica', name: 'Política', icon: '⚑' },
  { id: 'economia', name: 'Economía', icon: '↗' },
  { id: 'tecnologia', name: 'Tecnología', icon: '⌘' },
  { id: 'internacional', name: 'Internacional', icon: '◎' },
  { id: 'deportes', name: 'Deportes', icon: '◉' },
  { id: 'ciencia', name: 'Ciencia', icon: '✳' },
  { id: 'cultura', name: 'Cultura', icon: '▤' },
  { id: 'salud', name: 'Salud', icon: '✚' },
  { id: 'medioambiente', name: 'Medioambiente', icon: '❋' },
  { id: 'sociedad', name: 'Sociedad', icon: '◌' },
  { id: 'educacion', name: 'Educación', icon: '▱' },
];

export const sources = [
  { id: 'elpais', name: 'EL PAÍS', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', hosts: ['elpais.com'], color: '#303d55' },
  { id: 'abc', name: 'ABC', url: 'https://www.abc.es/rss/feeds/abc_ultima.xml', hosts: ['abc.es'], color: '#6e4747' },
  { id: 'eldiario', name: 'elDiario.es', url: 'https://www.eldiario.es/rss/', hosts: ['eldiario.es'], color: '#174871' },
  { id: 'europapress', name: 'Europa Press', url: 'https://www.europapress.es/rss/rss.aspx', hosts: ['europapress.es'], color: '#40519c' },
  { id: 'xataka', name: 'Xataka', url: 'https://www.xataka.com/index.xml', hosts: ['xataka.com'], color: '#486500', category: 'tecnologia' },
  { id: 'elmundo', name: 'EL MUNDO', url: 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml', hosts: ['elmundo.es'], color: '#394a4d' },
];

const parser = new XMLParser({ ignoreAttributes: false, processEntities: true });
const scalar = value => typeof value === 'object' && value ? String(value['#text'] ?? '') : String(value ?? '');
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

const rules = [
  ['deportes', /fútbol|futbol|liga|deporte|tenis|baloncesto|selección|atlético|barça|real madrid|formula 1|mundial/],
  ['educacion', /educación|educacion|escuela|universidad|profesor|alumno|enseñanza|beca/],
  ['salud', /sanidad|salud|hospital|médic|cáncer|vacuna|enfermedad|paciente/],
  ['medioambiente', /clima|climático|medioambiente|medio ambiente|emisiones|sequía|ecolog|renovable/],
  ['ciencia', /ciencia|científic|investigación|astronom|nasa|espacio|física|arqueolog/],
  ['tecnologia', /tecnología|tecnologia|inteligencia artificial|openai|chatgpt|software|iphone|google|robot|móvil|chip/],
  ['economia', /economía|economia|económ|empresa|banco|inflación|empleo|bolsa|salario|mercado|ibex|vivienda/],
  ['cultura', /cultura|cine|película|música|libro|literatura|teatro|festival|arte|museo/],
  ['internacional', /internacional|ucrania|israel|gaza|trump|rusia|china|estados unidos|irán|unión europea/],
  ['politica', /política|politica|gobierno|congreso|sánchez|feijóo|eleccion|partido|psoe|ministro|parlamento/],
  ['sociedad', /sociedad|suceso|policía|violencia|igualdad|migración|accidente|tribunal|juez/],
];
export function classify(text, fallback = 'espana') {
  return rules.find(([, rule]) => rule.test(text.toLowerCase()))?.[0] || fallback;
}

export function parseFeed(xml, source, now = Date.now()) {
  const data = parser.parse(xml);
  const items = data.rss?.channel?.item ?? data.feed?.entry ?? [];
  return (Array.isArray(items) ? items : [items]).flatMap((item) => {
    const link = Array.isArray(item.link) ? item.link.find(x => x['@_rel'] === 'alternate')?.['@_href'] : item.link?.['@_href'] || item.link;
    const url = articleURL(link, source);
    const title = cleanText(item.title).slice(0, 300);
    const published = new Date(scalar(item.pubDate || item.published || item.updated || item['dc:date']));
    // No dates invented, no future or stale items in the current edition.
    if (!url || !title || Number.isNaN(+published) || +published > now + 5 * 60_000 || now - +published > 72 * 3600_000) return [];
    // Keep only the short RSS excerpt; never fetch or reproduce whole articles.
    const rawExcerpt = cleanText(item.description || item.summary).slice(0, 600);
    const excerpt = rawExcerpt.length > 450 ? rawExcerpt.slice(0, 447).replace(/\s\S*$/, '') + '…' : rawExcerpt;
    const tags = (Array.isArray(item.category) ? item.category : [item.category]).map(cleanText).join(' ');
    const category = classify(tags + ' ' + title, source.category || 'espana');
    let hash = 2166136261;
    for (const c of url) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    return [{ id: source.id + '-' + (hash >>> 0).toString(36), title, excerpt, url, publishedAt: published.toISOString(), category, source: source.id, sourceName: source.name }];
  });
}

export function normalizePreferences(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  return Object.fromEntries(categories.map(c => [c.id, Number.isInteger(input[c.id]) && input[c.id] >= 0 && input[c.id] <= 3 ? input[c.id] : 0]));
}
export function personalize(articles, preferences, limit = 30) {
  const p = normalizePreferences(preferences);
  return articles.filter(a => p[a.category] > 0).sort((a, b) => p[b.category] - p[a.category] || +new Date(b.publishedAt) - +new Date(a.publishedAt)).slice(0, limit);
}

let cached = null;
let inflight = null;
export async function getNews(fetcher = fetch) {
  if (cached && Date.now() - cached.fetched < 5 * 60_000) return cached.data;
  if (inflight) return inflight;
  inflight = (async () => {
    const results = await Promise.all(sources.map(async s => {
      try {
        const r = await fetcher(s.url, { headers: { 'User-Agent': 'Brujula/1.0 (RSS news reader)', Accept: 'application/rss+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(12_000) });
        if (!r.ok) throw new Error('RSS unavailable');
        const xml = await r.text();
        if (xml.length > 3_000_000) throw new Error('Feed too large');
        const items = parseFeed(xml, s);
        return { items, status: { id: s.id, name: s.name, available: true, count: items.length } };
      } catch { return { items: [], status: { id: s.id, name: s.name, available: false, count: 0 } }; }
    }));
    const unique = new Map();
    for (const a of results.flatMap(r => r.items)) unique.set(a.url, a);
    const data = { articles: [...unique.values()].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)), sources: results.map(r => r.status), updatedAt: new Date().toISOString() };
    cached = { fetched: Date.now(), data };
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
