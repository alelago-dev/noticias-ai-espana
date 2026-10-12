const englishSources = new Set(['billboard', 'rollingstone', 'pitchfork', 'nme', 'stereogum', 'consequence', 'guardianmusica']);
export const isEnglishArticle = article => article.kind !== 'anniversary' && article.language !== 'es' && (article.language === 'en' || englishSources.has(article.source));
export function translatedArticle(article) {
  const t = article.translation;
  return t?.language === 'es' && typeof t.title === 'string' && typeof t.excerpt === 'string' ? { ...article, title: t.title, excerpt: t.excerpt } : article;
}
export const translationMatches = (record, article) => record?.originalTitle === article.title && record?.originalExcerpt === (article.excerpt || '') && record?.translation?.language === 'es';
