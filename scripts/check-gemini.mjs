// Live check of the Gemini script generation. Usage (key comes from the environment, never printed):
//   GEMINI_API_KEY=... node scripts/check-gemini.mjs
// Optional: GEMINI_MODEL=<id> to test a specific model first.
import { writeBroadcast, geminiModels } from '../server/broadcast.js';

const key = process.env.GEMINI_API_KEY;
if (!key) { console.error('Define GEMINI_API_KEY en el entorno.'); process.exit(2); }
const env = { GEMINI_API_KEY: key, GEMINI_MODEL: process.env.GEMINI_MODEL };
const base = 'https://generativelanguage.googleapis.com/v1beta';

const list = await fetch(base + '/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
console.log('models.list:', list.status);
if (list.ok) {
  const names = (await list.json()).models?.filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => m.name.replace('models/', '')) || [];
  console.log('models with generateContent:', names.join(', '));
  for (const model of geminiModels(env)) console.log(model.padEnd(24), names.includes(model) ? 'listed with generateContent' : 'NOT listed');
}
for (const model of geminiModels(env)) {
  const r = await fetch(`${base}/models/${model}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: 'Responde solo: ok' }] }] }) });
  console.log(model.padEnd(24), 'generateContent ->', r.status, r.ok ? '' : (await r.text()).replaceAll(key, '[clave]').replace(/AIza[\w-]+/g, '[clave]').slice(0, 160));
}

const articles = [
  { id: 'a', title: 'El Gobierno aprueba 300 millones para vivienda', excerpt: 'El Consejo de Ministros ha aprobado el plan este martes.', sourceName: 'EL PAÍS', category: 'economia' },
  { id: 'b', title: 'Alonso saldrá desde el pitlane en Singapur', excerpt: 'Cambia su sexto turbocompresor del año.', sourceName: 'Europa Press', category: 'deportes' },
].map(a => ({ ...a, title: a.title + ' ' + Date.now() }));
const result = await writeBroadcast(articles, env, { length: 'short' });
console.log('\nwriteBroadcast mode:', result.mode, result.notice || '');
for (const p of result.paragraphs) console.log('-', p.text);
process.exit(result.mode === 'ai' ? 0 : 1);
