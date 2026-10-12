// Explicit, reversible feedback. No guesses about a reader from one dismissal.
export const FEEDBACK_LIMITS = { hiddenArticles: 50, blockedTopics: 20, blockedTerms: 10 };
export function normalizeFeedback(input, validTopics, normalizeText) {
  const strings = (value, maxLength) => Array.isArray(value) ? [...new Set(value.filter(x => typeof x === 'string' && x.length > 0 && x.length <= maxLength))] : [];
  const terms = Array.isArray(input.blockedTerms) ? input.blockedTerms.filter(x => typeof x === 'string').map(x => x.trim().slice(0, 50)).filter(x => normalizeText(x).length >= 3) : [];
  return {
    hiddenArticles: strings(input.hiddenArticles, 80).slice(0, FEEDBACK_LIMITS.hiddenArticles),
    blockedTopics: strings(input.blockedTopics, 60).filter(x => validTopics.has(x)).slice(0, FEEDBACK_LIMITS.blockedTopics),
    blockedTerms: [...new Map(terms.map(t => [normalizeText(t), t])).values()].slice(0, FEEDBACK_LIMITS.blockedTerms),
  };
}
export function isHiddenArticle(article, profile, normalizeText, hasTerm) {
  if (article.kind === 'anniversary' && profile.includeAnniversaries === false) return true;
  if (profile.hiddenArticles.includes(article.id)) return true;
  if (profile.blockedTopics.some(t => article.topics?.includes(t))) return true;
  const text = normalizeText(article.title + ' ' + (article.excerpt || '') + (article.translation?.language === 'es' ? ' ' + article.translation.title + ' ' + article.translation.excerpt : ''));
  return profile.blockedTerms.some(term => hasTerm(text, normalizeText(term)));
}
