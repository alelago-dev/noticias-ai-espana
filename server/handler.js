import { translateArticles } from './translation.js';
import { isEnglishArticle, translatedArticle } from '../public/translation.js';
import { musicGenres } from '../public/music-filters.js';
import { categories, regions, sources, getNews, personalize, findEvidence } from './news.js';
import { appendAnniversary } from '../public/anniversary-news.js';
import { normalizeProfile, hiddenByFeedback } from '../public/personalization.js';
import { synthesize, extractive } from './ai.js';
import { writeBroadcast, buildClips, llmAvailable } from './broadcast.js';
import { ttsAvailable, synthesizeSpeech, verifyClip, VOICE_NAMES, MAX_CLIP_CHARS } from './tts.js';
import { selectBulletin } from '../public/bulletin.js';
import { getMusicAnniversaries, filterAnniversaries } from './music-anniversaries.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const buckets = new Map(), speechBuckets = new Map();
function limited(request, store = buckets, max = 12) {
  const key = request.headers.get('oai-authenticated-user-id') || request.headers.get('cf-connecting-ip') || 'local';
  const now = Date.now();
  for (const [k, v] of store) if (now - v.start > 60_000) store.delete(k);
  const bucket = store.get(key) || { start: now, count: 0 };
  bucket.count++; store.set(key, bucket);
  return bucket.count > max;
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
  if (path === '/api/music-anniversaries') {
    if (request.method !== 'GET') return json({ error: 'Método no permitido.' }, 405);
    const params = new URL(request.url).searchParams;
    const era = params.get('era') || 'all', kind = params.get('kind') || 'all';
    if (!['all', '80s'].includes(era) || !['all', 'events', 'births', 'deaths'].includes(kind)) return json({ error: 'El filtro de efemérides no es válido.' }, 400);
    const data = await getMusicAnniversaries();
    return json({ ...data, items: filterAnniversaries(data.items, { era, kind }) }, data.available ? 200 : 503);
  }
  if (path === '/api/config' && request.method === 'GET') return json({ translationAvailable: llmAvailable(env), musicGenres, categories: categories.map(c => ({ ...c, topics: c.topics.map(({ id, name }) => ({ id, name })) })), regions: regions.map(({ id, name }) => ({ id, name })), sources: sources.map(({ id, name, color, site }) => ({ id, name, color, site })), aiAvailable: llmAvailable(env), audioAvailable: ttsAvailable(env), audioVoices: ttsAvailable(env) ? Object.values(VOICE_NAMES) : [] });
  if (path === '/api/news' && request.method === 'GET') {
    const news = await getNews(fetch, { force: new URL(request.url).searchParams.get('refresh') === '1' });
    return json(news, news.articles.length ? 200 : 503);
  }
  if (path === '/api/translate') {
    if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origen no permitido.' }, 403);
    if (limited(request)) return json({ error: 'Has hecho varias consultas seguidas. Prueba de nuevo en un minuto.' }, 429);
    let input;
    try { input = await body(request); } catch { return json({ error: 'La solicitud no es válida.' }, 400); }
    if (typeof input.id !== 'string' || !input.id.trim() || input.id.length > 80) return json({ error: 'La noticia no es válida.' }, 400);
    const news = await getNews();
    const article = news.articles.find(a => a.id === input.id);
    if (!article) return json({ error: 'Esta noticia ya no está disponible entre las fuentes recientes.' }, 404);
    if (!isEnglishArticle(article)) return json({ error: 'Esta noticia ya está en español.' }, 400);
    if (!llmAvailable(env)) return json({ error: 'La traducción no está disponible ahora. Puedes consultar el original.' }, 503);
    try { return json({ translation: (await translateArticles([article], env))[0] }); }
    catch { return json({ error: 'No se pudo traducir ahora. Conservamos el texto original; puedes volver a intentarlo.' }, 502); }
  }
  if (path === '/api/tts') {
    if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
    if (!ttsAvailable(env)) return json({ error: 'La voz neuronal no está activada.' }, 503);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origen no permitido.' }, 403);
    if (limited(request, speechBuckets, 80)) return json({ error: 'Demasiadas solicitudes de audio seguidas. Prueba de nuevo en un minuto.' }, 429);
    let input;
    try { input = await body(request); } catch { return json({ error: 'La solicitud no es válida.' }, 400); }
    if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > MAX_CLIP_CHARS || typeof input.voice !== 'string' || !(input.voice in VOICE_NAMES) || !(await verifyClip(input.text, input.voice, input.sig, env))) return json({ error: 'El fragmento de audio no es válido.' }, 400);
    try {
      const audio = await synthesizeSpeech(input.text, input.voice, env);
      return new Response(audio, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=21600', 'content-length': String(audio.length) } });
    } catch { return json({ error: 'No se pudo generar el audio. Se usará la voz de tu dispositivo.' }, 502); }
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
      if (!articles.length) return json({ mode: 'insufficient', paragraphs: [], articles: [], message: 'No encuentro noticias que coincidan con el tema consultado en las fuentes de las últimas 24 horas. Puedes preguntar por cualquier país, pero la cobertura depende de los medios disponibles. Esto no significa que no existan noticias sobre ese tema.' });
    } else {
      const count = input.length === 'long' ? 20 : input.length === 'short' ? 6 : 12;
      if (input.scope && !['espana', 'mundo', 'personal'].includes(input.scope)) return json({ error: 'El ámbito no es válido.' }, 400);
      articles = input.scope ? selectBulletin(news.articles, { scope: input.scope, hours: input.hours, limit: count, preferences: input.preferences, profile: input.profile }) : personalize(news.articles, input.preferences, count, input.profile, { maxPerSource: 4 });
      if (!articles.length) return json({ error: 'No hay noticias en este intervalo. Prueba las últimas 24 horas u otro ámbito.' }, 422);
    }
    if (path === '/api/edition' && normalizeProfile(input.profile).includeAnniversaries) {
      const calendar = await getMusicAnniversaries();
      const count = input.length === 'long' ? 20 : input.length === 'short' ? 6 : 12;
      articles = appendAnniversary(articles, calendar, input.profile, { limit: count });
    }
    let translationNotice;
    if (path === '/api/edition' && llmAvailable(env) && articles.some(isEnglishArticle)) {
      try {
        const translations = await translateArticles(articles, env);
        articles = articles.map(a => { const translation = translations.find(t => t.id === a.id); return translation ? { ...a, translation } : a; });
      } catch { translationNotice = 'No se pudo traducir parte del contenido. Se conserva el original.'; }
    }
    if (path === '/api/edition') {
      const profile = normalizeProfile(input.profile);
      articles = articles.filter(a => !hiddenByFeedback(a, profile));
      if (!articles.some(a => a.kind !== 'anniversary')) return json({ error: 'Tus filtros excluyen estas noticias. Prueba otro ámbito o revisa Mis intereses.' }, 422);
    }
    const wantsAudio = path === '/api/edition' && input.audio === true && ttsAvailable(env);
    const narration = ['alternating', 'female', 'male'].includes(input.narration) ? input.narration : 'alternating';
    const currentNews = articles.filter(a => a.kind !== 'anniversary').map(translatedArticle), historical = articles.filter(a => a.kind === 'anniversary');
    const generated = wantsAudio ? await writeBroadcast(currentNews, env, { length: input.length, scope: input.scope, hours: input.hours }) : await synthesize(currentNews, env, input.question);
    const result = historical.length ? { ...generated, paragraphs: [...generated.paragraphs, ...extractive(historical)] } : generated;
    const audio = wantsAudio ? { clips: await buildClips(result, articles, categories, env, { narration, scope: input.scope, hours: Number(input.hours) || 12 }) } : undefined;
    const text = (audio ? audio.clips : result.paragraphs).map(p => p.text).join('\n\n');
    return json({ ...result, ...(translationNotice ? { translationNotice } : {}), ...(audio ? { audio } : {}), articles, updatedAt: news.updatedAt, estimatedSeconds: Math.max(1, Math.round(text.split(/\s+/).length / 2.5)), message: path === '/api/ask' && result.mode === 'extractive' ? (llmAvailable(env) ? 'Estas son las fuentes que coinciden con tu pregunta. No se pudo redactar la respuesta ahora.' : 'Estas son las fuentes que coinciden con tu pregunta. La respuesta redactada requiere activar la IA.') : result.paragraphs.length ? null : 'Las fuentes disponibles no permiten responder a esa pregunta.' });
  }
  return json({ error: 'Ruta no encontrada.' }, 404);
}
