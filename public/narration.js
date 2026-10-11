const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const voiceKey = voice => voice.voiceURI || `${voice.lang}:${voice.name}`;

// Web Speech has no gender field. Match known named voices only; let listeners
// choose unknown voices themselves rather than guessing their gender or shifting pitch.
export function voiceRole(voice) {
  const name = normalize(voice.name);
  if (/\b(monica|paulina|luciana|marisol|elvira|helena|laura|elena|dalia|conchita|maria|sabina|hilda|paloma|catalina)\b/.test(name)) return 'female';
  if (/\b(jorge|diego|pablo|carlos|enrique|alvaro|raul|juan|andres|antonio|alexandro)\b/.test(name)) return 'male';
  return null;
}
export function spanishVoices(voices) {
  const score = v => (/^es[-_]ES$/i.test(v.lang) ? 100 : 0) + (/natural|neural|enhanced|premium/i.test(v.name) ? 30 : 0) + (v.default ? 2 : 0);
  return [...new Map(voices.filter(v => /^es(?:[-_]|$)/i.test(v.lang)).map(v => [voiceKey(v), v])).values()].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}
export function resolveNarrators(voices, settings = {}) {
  const available = spanishVoices(voices);
  const chosen = role => available.find(v => voiceKey(v) === settings[role]) || available.find(v => voiceRole(v) === role) || null;
  const female = chosen('female'), male = chosen('male');
  return { available, female, male, distinct: !!female && !!male && voiceKey(female) !== voiceKey(male), fallback: available[0] || null };
}
export function narratorFor(index, voices, settings = {}) {
  const pair = resolveNarrators(voices, settings);
  const role = settings.mode === 'male' ? 'male' : settings.mode === 'female' ? 'female' : index % 2 === 0 ? 'female' : 'male';
  return pair[role] || pair.fallback;
}
export function spokenText(text) {
  return String(text).replace(/\bEE\.\s?UU\./g, 'Estados Unidos')
    .replace(/\bUE\b/g, 'Unión Europea').replace(/\bIA\b/g, 'inteligencia artificial')
    .replace(/\bkm\/h\b/g, 'kilómetros por hora').replace(/%/g, ' por ciento')
    .replace(/€/g, ' euros').replace(/([!?])\./g, '$1').replace(/\s+/g, ' ').trim();
}

// Keep the original publisher's headline; never invent one from the summary.
export function bulletinStory(paragraph, articles, categories) {
  const cited = paragraph.sourceIds.map(id => articles.find(article => article.id === id)).filter(Boolean);
  const article = cited[0];
  const topic = categories.find(c => c.id === article?.category)?.name || 'Actualidad';
  const title = article?.title.trim() || '';
  let body = paragraph.text.trim();
  // Extractive editions already start with the headline. Read it only once.
  if (title && body.startsWith(title) && (!body[title.length] || /[\s.!?…:;]/.test(body[title.length]))) {
    body = body.slice(title.length).replace(/^[\s.!?…:;]+/, '').trim();
  }
  return { topic, title, heading: title ? topic + ': ' + title : topic, body, sources: [...new Set(cited.map(a => a.sourceName).filter(Boolean))] };
}
export function storyNarration(story) {
  const sentence = text => /[.!?…]["»”’)]?$/.test(text) ? text : text + '.';
  const source = story.sources.join(' y ');
  const detail = story.body ? (source ? 'Según ' + source + ', ' : '') + story.body : source ? 'Fuente: ' + source + '.' : '';
  return spokenText(sentence(story.heading) + (detail ? ' ' + detail : ''));
}
