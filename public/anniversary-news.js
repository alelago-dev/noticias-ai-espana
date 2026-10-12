import { annotateArticle, normalizeProfile, normalizeText, hasTerm, hiddenByFeedback } from './personalization.js';

export function calendarDay(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  return ['year', 'month', 'day'].map(t => parts.find(p => p.type === t).value).join('-');
}
export function anniversaryArticle(item, date) {
  const label = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' }).format(new Date(date + 'T12:00:00Z'));
  const a = annotateArticle({
    id: item.id + '-' + date, kind: 'anniversary', anniversaryKind: item.kind,
    title: `Efemérides musicales: ${item.year} · ${item.title}`,
    excerpt: `Un día como hoy, el ${label} de ${item.year}: ${item.text} Según Wikipedia en español.`,
    calendarDate: date, historicalYear: item.year, publishedAt: null,
    source: 'wikipedia', sourceName: item.sourceName, url: item.sourceURL || item.url,
    biographyURL: item.url, license: item.license, licenseURL: item.licenseURL,
  }, item.musicMetadata || '', 'musica');
  return { ...a, category: 'musica', categories: ['musica'] };
}
export function chooseAnniversary(data, profileInput = {}, { now = Date.now() } = {}) {
  const profile = normalizeProfile(profileInput);
  if (!profile.includeAnniversaries || !data?.available || data.date !== calendarDay(now) || profile.excludedSources.includes('wikipedia')) return null;
  const candidates = (data.items || []).filter(item =>
    (profile.anniversaryEra !== '80s' || item.year >= 1980 && item.year <= 1989) &&
    (profile.anniversaryKind === 'all' || item.kind === profile.anniversaryKind)
  ).map(item => anniversaryArticle(item, data.date)).filter(a => {
    if (hiddenByFeedback(a, profile)) return false;
    if (profile.musicGenres.length && !profile.musicGenres.some(g => a.musicGenres.includes(g))) return false;
    if (profile.topicMode === 'strict' && profile.topics.musica.length && !profile.topics.musica.some(t => a.topics.includes('musica:' + t))) return false;
    return true;
  });
  // Prefer named interests, then keep the calendar's event/year ordering.
  candidates.sort((a, b) => {
    const matches = a => profile.keywords.filter(k => hasTerm(normalizeText(a.title + ' ' + a.excerpt), k)).length;
    return matches(b) - matches(a);
  });
  return candidates[0] || null;
}
export function appendAnniversary(articles, data, profile, { limit = 12, now = Date.now() } = {}) {
  // A historical item never fills an empty window of current news.
  if (!articles.length) return articles;
  const a = chooseAnniversary(data, profile, { now });
  return a ? [...articles.slice(0, Math.max(0, limit - 1)), a] : articles;
}
