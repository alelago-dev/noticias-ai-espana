import { categories, regions, sources, getNews, personalize, findEvidence } from './news.js';
import { synthesize } from './ai.js';
import { writeBroadcast, buildClips, llmAvailable } from './broadcast.js';
import { ttsAvailable, synthesizeSpeech, verifyClip, VOICE_NAMES, MAX_CLIP_CHARS } from './tts.js';
import { selectBulletin } from '../public/bulletin.js';

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
  if (path === '/api/config' && request.method === 'GET') return json({ categories: categories.map(c => ({ ...c, topics: c.topics.map(({ id, name }) => ({ id, name })) })), regions: regions.map(({ id, name }) => ({ id, name })), sources: sources.map(({ id, name, color, site }) => ({ id, name, color, site })), aiAvailable: llmAvailable(env), audioAvailable: ttsAvailable(env), audioVoices: ttsAvailable(env) ? Object.values(VOICE_NAMES) : [] });
  if (path === '/api/news' && request.method === 'GET') {
    const news = await getNews(fetch, { force: new URL(request.url).searchParams.get('refresh') === '1' });
    return json(news, news.articles.length ? 200 : 503);
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
      if (!articles.length) return json({ mode: 'insufficient', paragraphs: [], articles: [], message: 'No encuentro fuentes suficientes en las noticias recientes para responder. Prueba con otro tema o consulta los medios originales.' });
    } else {
      const count = input.length === 'long' ? 20 : input.length === 'short' ? 6 : 12;
      if (input.scope && !['espana', 'mundo', 'personal'].includes(input.scope)) return json({ error: 'El ámbito no es válido.' }, 400);
      articles = input.scope ? selectBulletin(news.articles, { scope: input.scope, hours: input.hours, limit: count, preferences: input.preferences, profile: input.profile }) : personalize(news.articles, input.preferences, count, input.profile, { maxPerSource: 4 });
      if (!articles.length) return json({ error: 'No hay noticias en este intervalo. Prueba las últimas 24 horas u otro ámbito.' }, 422);
    }
    const wantsAudio = path === '/api/edition' && input.audio === true && ttsAvailable(env);
    const narration = ['alternating', 'female', 'male'].includes(input.narration) ? input.narration : 'alternating';
    const result = wantsAudio ? await writeBroadcast(articles, env, { length: input.length, scope: input.scope, hours: input.hours }) : await synthesize(articles, env, input.question);
    const audio = wantsAudio ? { clips: await buildClips(result, articles, categories, env, { narration, scope: input.scope, hours: Number(input.hours) || 12 }) } : undefined;
    const text = (audio ? audio.clips : result.paragraphs).map(p => p.text).join('\n\n');
    return json({ ...result, ...(audio ? { audio } : {}), articles, updatedAt: news.updatedAt, estimatedSeconds: Math.max(1, Math.round(text.split(/\s+/).length / 2.5)), message: path === '/api/ask' && result.mode === 'extractive' ? 'Estas son las fuentes que coinciden con tu pregunta. La respuesta redactada requiere activar la IA.' : result.paragraphs.length ? null : 'Las fuentes disponibles no permiten responder a esa pregunta.' });
  }
  return json({ error: 'Ruta no encontrada.' }, 404);
}
