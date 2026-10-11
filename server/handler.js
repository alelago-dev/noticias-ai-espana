import { categories, regions, sources, getNews, personalize, findEvidence } from './news.js';
import { synthesize } from './ai.js';
import { selectBulletin } from '../public/bulletin.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const buckets = new Map();
function limited(request) {
  const key = request.headers.get('oai-authenticated-user-id') || request.headers.get('cf-connecting-ip') || 'local';
  const now = Date.now();
  for (const [k, v] of buckets) if (now - v.start > 60_000) buckets.delete(k);
  const bucket = buckets.get(key) || { start: now, count: 0 };
  bucket.count++; buckets.set(key, bucket);
  return bucket.count > 12;
}
async function body(request) {
  if (Number(request.headers.get('content-length')) > 8192) throw new Error('body');
  const text = await request.text();
  if (text.length > 8192) throw new Error('body');
  const input = JSON.parse(text);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('body');
  return input;
}

export async function api(request, env = {}) {
  const path = new URL(request.url).pathname;
  if (path === '/api/config' && request.method === 'GET') return json({ categories: categories.map(c => ({ ...c, topics: c.topics.map(({ id, name }) => ({ id, name })) })), regions: regions.map(({ id, name }) => ({ id, name })), sources: sources.map(({ id, name, color, site }) => ({ id, name, color, site })), aiAvailable: Boolean(env.AI_GATEWAY_API_KEY && env.AI_GATEWAY_MODEL) });
  if (path === '/api/news' && request.method === 'GET') {
    const news = await getNews(fetch, { force: new URL(request.url).searchParams.get('refresh') === '1' });
    return json(news, news.articles.length ? 200 : 503);
  }
  if (path === '/api/edition' || path === '/api/ask') {
    if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origen no permitido.' }, 403);
    if (limited(request)) return json({ error: 'Has hecho varias consultas seguidas. Prueba de nuevo en un minuto.' }, 429);
    let input;
    try { input = await body(request); } catch { return json({ error: 'La solicitud no es válida.' }, 400); }
    const news = await getNews();
    if (!news.articles.length) return json({ error: 'No hay noticias recientes disponibles. Inténtalo más tarde.' }, 503);
    let articles;
    if (path === '/api/ask') {
      if (typeof input.question !== 'string' || input.question.trim().length < 3 || input.question.length > 500) return json({ error: 'Escribe una pregunta de entre 3 y 500 caracteres.' }, 400);
      const cutoff = Date.now() - 24 * 3600000;
      articles = findEvidence(input.question, news.articles.filter(a => +new Date(a.publishedAt) >= cutoff));
      if (!articles.length) return json({ mode: 'insufficient', paragraphs: [], articles: [], message: 'No encuentro fuentes suficientes en las noticias recientes para responder. Prueba con otro tema o consulta los medios originales.' });
    } else {
      const count = input.length === 'long' ? 20 : input.length === 'short' ? 6 : 12;
      if (input.scope && !['espana', 'mundo', 'personal'].includes(input.scope)) return json({ error: 'El ámbito no es válido.' }, 400);
      articles = input.scope ? selectBulletin(news.articles, { scope: input.scope, hours: input.hours, limit: count, preferences: input.preferences, profile: input.profile }) : personalize(news.articles, input.preferences, count, input.profile, { maxPerSource: 4 });
      if (!articles.length) return json({ error: 'No hay noticias en este intervalo. Prueba las últimas 24 horas u otro ámbito.' }, 422);
    }
    const result = await synthesize(articles, env, input.question);
    const text = result.paragraphs.map(p => p.text).join('\n\n');
    return json({ ...result, articles, updatedAt: news.updatedAt, estimatedSeconds: Math.max(1, Math.round(text.split(/\s+/).length / 2.5)), message: path === '/api/ask' && result.mode === 'extractive' ? 'Estas son las fuentes que coinciden con tu pregunta. La respuesta redactada requiere activar la IA.' : result.paragraphs.length ? null : 'Las fuentes disponibles no permiten responder a esa pregunta.' });
  }
  return json({ error: 'Ruta no encontrada.' }, 404);
}
