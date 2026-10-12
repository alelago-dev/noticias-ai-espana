import { normalizeText, personalize, normalizeProfile, hiddenByFeedback } from './personalization.js';
import { musicEventAllowed } from './music-filters.js';

const stopwords = new Set('para como sobre entre tras desde hasta contra segun porque pero esta este estos estas nuevo nueva nuevos nuevas mas muy sus una uno unas unos los las del que con por sin han hay son fue sera ser tiene dice afirma anuncia noticias ultima horas gobierno presidente pais mundo espana'.split(' '));
const tokens = title => new Set(normalizeText(title).split(' ').filter(w => w.length > 3 && !stopwords.has(w)));
function related(a, b) {
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared >= 3 && shared / Math.max(1, Math.min(a.size, b.size)) >= .6;
}

// An automatic ranking heuristic, not objective importance or fact verification.
export function selectBulletin(articles, { scope = 'espana', hours = 12, limit = 12, preferences = {}, profile = {}, now = Date.now() } = {}) {
  hours = [6, 12, 24].includes(Number(hours)) ? Number(hours) : 12;
  limit = [6, 12, 20].includes(Number(limit)) ? Number(limit) : 12;
  if (scope === 'personal') return personalize(articles, preferences, limit, { ...profile, hours }, { now, maxPerSource: 4 });
  const feedback = normalizeProfile(profile);
  const excluded = new Set(feedback.excludedSources);
  const recent = articles.filter(a => {
    const date = +new Date(a.publishedAt);
    return Number.isFinite(date) && date <= now + 300000 && date >= now - hours * 3600000 && !excluded.has(a.source) && !hiddenByFeedback(a, feedback) && musicEventAllowed(a, feedback.musicEventRegion) && a.coverage === (scope === 'mundo' ? 'mundo' : 'espana');
  });
  const clusters = [];
  for (const article of recent) {
    const words = tokens(article.title);
    const existing = clusters.find(c => related(words, c.words) || normalizeText(c.article.title) === normalizeText(article.title));
    if (existing) {
      existing.sources.add(article.source);
      if (article.publishedAt > existing.article.publishedAt) existing.article = article;
    } else clusters.push({ article, words, sources: new Set([article.source]) });
  }
  const publicInterest = new Set(['politica', 'economia', 'internacional', 'sociedad', 'salud', 'medioambiente', 'espana']);
  const candidates = clusters.map(c => {
    const age = Math.max(0, (now - +new Date(c.article.publishedAt)) / 3600000);
    const score = 24 * Math.exp(-age / 8) + Math.min(3, c.sources.size - 1) * 16 + (publicInterest.has(c.article.category) ? 12 : 0) + (c.article.generalFeed ? 8 : 0) + Math.max(0, 8 - (c.article.feedPosition ?? 20) / 3);
    return { ...c, score };
  });
  const selected = [], media = new Map(), categories = new Map();
  while (selected.length < limit && candidates.length) {
    candidates.sort((a, b) => (b.score - (media.get(b.article.source) || 0) * 12 - (categories.get(b.article.category) || 0) * 6) - (a.score - (media.get(a.article.source) || 0) * 12 - (categories.get(a.article.category) || 0) * 6));
    const best = candidates.shift();
    if ((media.get(best.article.source) || 0) >= 4) continue;
    selected.push({ ...best.article, coverageSourceCount: best.sources.size });
    media.set(best.article.source, (media.get(best.article.source) || 0) + 1);
    categories.set(best.article.category, (categories.get(best.article.category) || 0) + 1);
  }
  return selected;
}
