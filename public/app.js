import { personalize, normalizeProfile, normalizeText } from './personalization.js';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const defaults = { espana: 2, politica: 2, economia: 2, tecnologia: 3, internacional: 1, deportes: 0, ciencia: 1, cultura: 0, musica: 0, salud: 0, medioambiente: 0, sociedad: 0, educacion: 0 };
function stored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function saveLocal(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast('No se pudo guardar en este navegador. Comprueba el espacio disponible.'); } }
let preferences = stored('brujula-interests', { ...defaults });
let profile = normalizeProfile(stored('brujula-profile', {}));
let draftPreferences = { ...preferences }, draftProfile = normalizeProfile(profile);
let saved = stored('brujula-saved', []);
if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) preferences = { ...defaults };
if (!Array.isArray(saved)) saved = [];
let config = { categories: [], sources: [], aiAvailable: false };
let news = { articles: [], sources: [] };
let filter = 'all', view = 'home', displayLimit = 9, edition = null, editionBusy = false, chatBusy = false, loadError = null;
let speechIndex = 0, speechPlaying = false, speechGeneration = 0, speechUtterance = null;
let installPrompt = null, toastTimer;

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function safeURL(value) { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : '#'; } catch { return '#'; } }
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4000); }
const category = id => config.categories.find(c => c.id === id) || { name: 'Actualidad', icon: '◈' };
function age(date) {
  const n = Math.max(0, Math.round((Date.now() - +new Date(date)) / 60_000));
  return n < 60 ? 'Hace ' + n + ' min' : n < 1440 ? 'Hace ' + Math.floor(n / 60) + ' h' : new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(date));
}
async function request(path, body) {
  const response = await fetch(path, { ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(55_000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No hemos podido actualizar las noticias. Revisa tu conexión e inténtalo de nuevo.');
  return data;
}

function navigate(next, updateHash = true) {
  if (!['home', 'edition', 'ask', 'saved', 'preferences', 'sources'].includes(next)) next = 'home';
  view = next;
  $$('.view').forEach(el => { el.hidden = el.id !== 'view-' + next; });
  $$('[data-view]').forEach(el => { el.classList.toggle('active', el.dataset.view === next); if (el.closest('nav')) el.setAttribute('aria-current', el.dataset.view === next ? 'page' : 'false'); });
  if (updateHash) history.replaceState(null, '', '#' + next);
  if (next === 'saved') renderSaved();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
document.addEventListener('click', e => { const button = e.target.closest('[data-view]'); if (button) navigate(button.dataset.view); });
document.addEventListener('click', e => { const b = e.target.closest('[data-profile-jump]'); if (b) document.getElementById(b.dataset.profileJump)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
window.addEventListener('hashchange', () => navigate(location.hash.slice(1), false));
$('#today').textContent = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' }).format(new Date());

function card(a) {
  const c = category(a.category), isSaved = saved.some(s => s.id === a.id);
  return `<article class="news-card"><div class="card-graphic cat-${esc(a.category)}"><span>${esc(c.name)}</span><span class="category-icon" aria-hidden="true">${esc(c.icon)}</span></div><div class="card-body"><div class="card-source"><span class="source-logo">${esc(a.sourceName)}</span><span class="source-dot"></span><time datetime="${esc(a.publishedAt)}">${esc(age(a.publishedAt))}</time></div><h3><a href="${esc(safeURL(a.url))}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a></h3>${a.excerpt ? `<p>${esc(a.excerpt)}</p>` : ''}${a.matchReasons?.length ? `<div class="match-reasons"><span>PARA TI</span> ${a.matchReasons.slice(0, 2).map(esc).join(' · ')}</div>` : ''}</div><div class="card-footer"><a href="${esc(safeURL(a.url))}" target="_blank" rel="noopener noreferrer">Leer en ${esc(a.sourceName)} ↗</a><button class="save-button ${isSaved ? 'saved' : ''}" data-save="${esc(a.id)}" aria-label="${isSaved ? 'Quitar de guardadas' : 'Guardar noticia'}" aria-pressed="${isSaved}">${isSaved ? '▣' : '▱'}</button></div></article>`;
}
function empty(title, text, action = '') { return `<div class="empty-state"><span aria-hidden="true">✳</span><h2>${esc(title)}</h2><p>${esc(text)}</p>${action}</div>`; }
function selectedArticles() {
  const items = news.articles.filter(a => filter === 'all' || a.category === filter || a.categories?.includes(filter));
  const query = normalizeText($('#search').value);
  const matching = query ? items.filter(a => normalizeText(a.title + ' ' + a.excerpt + ' ' + a.sourceName).includes(query)) : items;
  return personalize(matching, preferences, matching.length, profile, { sort: $('#sort').value });
}
function renderFeed() {
  const items = selectedArticles();
  $('#feed').innerHTML = loadError ? `<div class="empty-state error-state"><span>↻</span><h2>No podemos conectar con las noticias</h2><p>${esc(loadError)}</p><button class="outline-button" id="retry-news">Intentar de nuevo</button></div>` : items.length ? items.slice(0, displayLimit).map(card).join('') : empty('Tu radar está en calma.', news.articles.length ? 'No hay noticias que coincidan. Prueba otro filtro o amplía tus intereses.' : 'No hay publicaciones recientes disponibles de los medios.', '<button class="outline-button" data-view="preferences">Elegir mis intereses ↗</button>');
  $('#retry-news')?.addEventListener('click', loadNews);
  $('#load-more').hidden = items.length <= displayLimit || !!loadError;
  const available = news.sources.filter(s => s.fresh).length;
  $('#news-meta').textContent = news.updatedAt ? items.length + ' noticias en ' + profile.hours + ' h · ' + available + ' medios con actualidad · Comprobado ' + new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date(news.updatedAt)) : 'Actualidad de medios españoles';
  const regionName = config.regions?.find(r => r.id === profile.region)?.name;
  $('#freshness-note').textContent = 'Últimas ' + profile.hours + ' horas' + (profile.topicMode === 'strict' ? ' · Solo tus subtemas' : ' · Tus subtemas tienen prioridad') + (profile.city || regionName ? ' · Cerca de ' + (profile.city || regionName) : '');
}
function renderInterests() {
  const selected = config.categories.filter(c => preferences[c.id] > 0);
  const labels = selected.flatMap(c => profile.topics[c.id].map(id => c.topics.find(t => t.id === id)?.name).filter(Boolean));
  const tags = labels.length ? labels : selected.map(c => c.name);
  $('#interest-tags').innerHTML = tags.slice(0, 5).map(name => `<span class="interest-tag">${esc(name)}</span>`).join('') + (tags.length > 5 ? `<span class="interest-tag">+${tags.length - 5}</span>` : '') || '<span class="interest-tag">Elige tu primer tema</span>';
  $('#filters').innerHTML = `<button data-filter="all" class="${filter === 'all' ? 'active' : ''}" aria-pressed="${filter === 'all'}">Para ti</button>` + selected.map(c => `<button data-filter="${c.id}" class="${filter === c.id ? 'active' : ''}" aria-pressed="${filter === c.id}">${esc(c.name)}</button>`).join('');
}
function renderDraftCards() {
  $('#preferences-grid').innerHTML = config.categories.map(c => {
    const topics = draftProfile.topics[c.id];
    return `<section class="preference-card ${draftPreferences[c.id] === 0 ? 'unfollowed' : ''}"><div class="preference-title"><span aria-hidden="true">${esc(c.icon)}</span>${esc(c.name)}<small>${topics.length ? topics.length + ' de 5' : 'Todos los subtemas'}</small></div><div class="levels" role="group" aria-label="Interés en ${esc(c.name)}">${['No seguir', 'Algo', 'Bastante', 'Mucho'].map((label, n) => `<button data-interest="${c.id}" data-level="${n}" class="${draftPreferences[c.id] === n ? 'active' : ''}" aria-pressed="${draftPreferences[c.id] === n}">${label}</button>`).join('')}</div><div class="topic-chips" role="group" aria-label="Subtemas de ${esc(c.name)}">${c.topics.map(t => `<button data-topic="${t.id}" data-category="${c.id}" class="topic-chip ${topics.includes(t.id) ? 'selected' : ''}" aria-pressed="${topics.includes(t.id)}">${topics.includes(t.id) ? '<span aria-hidden="true">✓</span> ' : ''}${esc(t.name)}</button>`).join('')}</div></section>`;
  }).join('');
  updateSaveStatus();
}
function renderProfileControls() {
  $('#profile-region').innerHTML = '<option value="">Toda España</option>' + config.regions.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
  $('#profile-region').value = draftProfile.region;
  $('#profile-city').value = draftProfile.city;
  $('#profile-hours').value = draftProfile.hours;
  $('#profile-strict').checked = draftProfile.topicMode === 'strict';
  renderKeywords(); renderProfileSources(); renderDraftCards();
}
function renderProfileSources() {
  $('#profile-sources').innerHTML = config.sources.map(s => `<button data-source-toggle="${s.id}" class="topic-chip ${draftProfile.excludedSources.includes(s.id) ? '' : 'selected'}" aria-pressed="${!draftProfile.excludedSources.includes(s.id)}">${draftProfile.excludedSources.includes(s.id) ? '' : '<span aria-hidden="true">✓</span> '}${esc(s.name)}</button>`).join('');
}
function renderKeywords() {
  $('#keyword-tags').innerHTML = draftProfile.keywords.map((k, i) => `<button class="topic-chip selected" data-remove-keyword="${i}" aria-label="Quitar interés ${esc(k)}">${esc(k)} <span aria-hidden="true">×</span></button>`).join('');
}
function updateSaveStatus() {
  const dirty = JSON.stringify(draftPreferences) !== JSON.stringify(preferences) || JSON.stringify(draftProfile) !== JSON.stringify(profile);
  const cats = config.categories.filter(c => draftPreferences[c.id] > 0);
  const count = cats.reduce((n, c) => n + draftProfile.topics[c.id].length, 0);
  $('#profile-summary').textContent = cats.length + ' categorías · ' + count + ' subtemas elegidos';
  $('#save-status').textContent = dirty ? 'Cambios sin guardar' : 'Tu selección está guardada en este dispositivo';
  $('#save-preferences').disabled = !dirty;
}
$('#filters').addEventListener('click', e => { const b = e.target.closest('[data-filter]'); if (!b) return; filter = b.dataset.filter; displayLimit = 9; renderInterests(); renderFeed(); });
$('#preferences-grid').addEventListener('click', e => {
  const level = e.target.closest('[data-interest]'), t = e.target.closest('[data-topic]');
  if (level) draftPreferences[level.dataset.interest] = Number(level.dataset.level);
  else if (t) {
    const id = t.dataset.category, selected = draftProfile.topics[id];
    if (selected.includes(t.dataset.topic)) draftProfile.topics[id] = selected.filter(x => x !== t.dataset.topic);
    else {
      if (selected.length >= 5) { toast('Elige hasta cinco subtemas por categoría. Quita uno para añadir otro.'); return; }
      selected.push(t.dataset.topic);
      if (!draftPreferences[id]) draftPreferences[id] = 2;
    }
  } else return;
  renderDraftCards();
  if (t) $(`[data-category="${t.dataset.category}"][data-topic="${t.dataset.topic}"]`)?.focus({ preventScroll: true });
  if (level) $(`[data-interest="${level.dataset.interest}"][data-level="${level.dataset.level}"]`)?.focus({ preventScroll: true });
});
$('#select-all').onclick = () => { draftPreferences = Object.fromEntries(config.categories.map(c => [c.id, 2])); renderDraftCards(); };
$('#reset-interests').onclick = () => { draftPreferences = { ...defaults }; draftProfile = normalizeProfile({}); renderProfileControls(); toast('Selección inicial preparada. Pulsa Guardar cambios para aplicarla.'); };
$('#profile-region').onchange = e => { draftProfile.region = e.target.value; updateSaveStatus(); };
$('#profile-city').oninput = e => { draftProfile.city = e.target.value.trim(); updateSaveStatus(); };
$('#profile-hours').onchange = e => { draftProfile.hours = Number(e.target.value); updateSaveStatus(); };
$('#profile-strict').onchange = e => { draftProfile.topicMode = e.target.checked ? 'strict' : 'priority'; updateSaveStatus(); };
$('#keyword-form').onsubmit = e => {
  e.preventDefault(); const entry = $('#keyword-entry'), text = entry.value.trim();
  if (normalizeText(text).length < 3) { toast('Escribe al menos tres letras para tu interés.'); return; }
  if (draftProfile.keywords.some(k => normalizeText(k) === normalizeText(text))) { toast('Ese interés ya está añadido.'); return; }
  if (draftProfile.keywords.length >= 10) { toast('Puedes añadir hasta diez intereses propios.'); return; }
  draftProfile.keywords.push(text.slice(0, 50)); entry.value = ''; renderKeywords(); updateSaveStatus();
};
$('#keyword-tags').onclick = e => { const b = e.target.closest('[data-remove-keyword]'); if (!b) return; draftProfile.keywords.splice(Number(b.dataset.removeKeyword), 1); renderKeywords(); updateSaveStatus(); };
$('#profile-sources').onclick = e => {
  const b = e.target.closest('[data-source-toggle]'); if (!b) return; const id = b.dataset.sourceToggle;
  draftProfile.excludedSources = draftProfile.excludedSources.includes(id) ? draftProfile.excludedSources.filter(x => x !== id) : [...draftProfile.excludedSources, id];
  renderProfileSources(); updateSaveStatus();
};
$('#save-preferences').onclick = () => {
  preferences = { ...draftPreferences }; profile = normalizeProfile(draftProfile);
  saveLocal('brujula-interests', preferences); saveLocal('brujula-profile', profile);
  draftProfile = normalizeProfile(profile);
  filter = 'all'; displayLimit = 9; edition = null; closeSpeech();
  $('#edition-content').innerHTML = empty('Tu selección ha cambiado.', 'Prepara una nueva edición con tus intereses actualizados.');
  renderInterests(); renderFeed(); updateSaveStatus(); toast('Tus temas ya marcan el rumbo del feed y del informativo.'); navigate('home');
};
$('#search').addEventListener('input', () => { displayLimit = 9; renderFeed(); });
$('#sort').onchange = renderFeed;
$('#load-more').onclick = () => { displayLimit += 9; renderFeed(); };

function renderSaved() { $('#saved-count').textContent = saved.length; $('#saved-feed').innerHTML = saved.length ? saved.map(card).join('') : empty('Guarda lo que merece otra lectura.', 'Pulsa el marcador de una noticia para encontrarla aquí más tarde.', '<button class="outline-button" data-view="home">Explorar mi actualidad ↗</button>'); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-save]'); if (!b) return;
  const found = saved.find(a => a.id === b.dataset.save);
  if (found) { saved = saved.filter(a => a.id !== found.id); toast('Noticia quitada de guardadas.'); }
  else { const a = news.articles.find(a => a.id === b.dataset.save); if (!a) return; if (saved.length >= 100) { toast('Puedes guardar hasta 100 noticias. Quita alguna para añadir otra.'); return; } saved.unshift(a); toast('Guardada para volver con calma.'); }
  saveLocal('brujula-saved', saved); renderSaved(); renderFeed();
});
function renderSources() {
  $('#sources-grid').innerHTML = config.sources.map(s => {
    const status = news.sources.find(x => x.id === s.id);
    const state = !status ? 'Pendiente de conexión' : !status.available ? 'Canal no disponible ahora' : status.fresh ? 'Noticias de las últimas 24 horas' : 'Sin publicaciones en las últimas 24 h';
    return `<article class="source-card"><h2>${esc(s.name)}</h2><div class="source-state ${status && !status.fresh ? 'unavailable' : ''}"><i></i>${state}</div><small>${status?.recentCount ?? '—'} noticias en 24 h · ${status?.activeFeeds ?? '—'} canales disponibles</small><small>Última publicación: ${status?.latestPublishedAt ? esc(age(status.latestPublishedAt)) : 'sin noticias recientes'}</small><small>Comprobado: ${status?.checkedAt ? esc(new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date(status.checkedAt))) : 'pendiente'}</small><a href="${esc(safeURL(s.site))}" target="_blank" rel="noopener noreferrer">Visitar el medio original ↗</a></article>`;
  }).join('');
}
async function loadNews(force = false) {
  if ($('#refresh').disabled) return;
  $('#refresh').disabled = true;
  if (!news.articles.length) $('#feed').innerHTML = '<div class="skeleton"></div>'.repeat(3);
  try { news = await request('/api/news' + (force === true ? '?refresh=1' : '')); loadError = null; }
  catch (error) { loadError = error.message; }
  renderFeed(); renderSources(); $('#refresh').disabled = false;
}
$('#refresh').onclick = () => loadNews(true);
setInterval(() => { if (document.visibilityState === 'visible') loadNews(); }, 120000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && (!news.updatedAt || Date.now() - +new Date(news.updatedAt) >= 120000)) loadNews(); });

function citations(paragraph, articles) {
  return `<div class="citations">${paragraph.sourceIds.map(id => articles.find(a => a.id === id)).filter(Boolean).map(a => `<a href="${esc(safeURL(a.url))}" target="_blank" rel="noopener noreferrer" title="${esc(a.title)}">${esc(a.sourceName)} · ${esc(a.title.slice(0, 65))}${a.title.length > 65 ? '…' : ''} ↗</a>`).join('')}</div>`;
}
function renderEdition() {
  if (!edition) return;
  const min = Math.ceil(edition.estimatedSeconds / 60);
  const mode = edition.mode === 'ai' ? 'Resumen con IA · Revisa las fuentes' : 'Selección de titulares y extractos RSS';
  const time = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date(edition.updatedAt));
  $('#edition-content').innerHTML = `<div class="edition-header"><div><div class="eyebrow">UNA EDICIÓN PARA TI</div><h2>Este es tu rumbo de hoy.</h2><p>${min} min aprox. · ${edition.articles.length} noticias · ${new Set(edition.articles.map(a => a.source)).size} medios<br>Actualizado a las ${time} · Hora de Madrid</p></div><button id="listen-edition" class="primary-button"><span>▶</span> Escuchar edición</button></div><p class="edition-notice">${esc(mode)}. ${esc(edition.notice || 'La duración depende del contenido disponible. La voz la proporciona tu dispositivo.')} ${edition.mode === 'extractive' ? 'La síntesis redactada con IA está pendiente de activación.' : ''}</p><div class="transcript">${edition.paragraphs.map((p, i) => `<section class="transcript-section" id="paragraph-${i}"><p>${esc(p.text)}</p>${citations(p, edition.articles)}</section>`).join('')}</div>`;
  $('#listen-edition').onclick = () => startSpeech(0);
}
async function createEdition() {
  if (editionBusy) return;
  navigate('edition'); editionBusy = true; $('#regenerate').disabled = true;
  $('#edition-content').innerHTML = empty('Preparando tu edición…', 'Seleccionamos las noticias de tus temas y conservamos sus fuentes.');
  closeSpeech();
  try { edition = await request('/api/edition', { preferences, profile, length: $('#edition-length').value }); renderEdition(); }
  catch (error) { $('#edition-content').innerHTML = `<div class="empty-state error-state"><span>✳</span><h2>No hemos podido preparar la edición.</h2><p>${esc(error.message)}</p><button class="outline-button" data-view="preferences">Revisar mis intereses ↗</button></div>`; }
  finally { editionBusy = false; $('#regenerate').disabled = false; }
}
$('#create-edition').onclick = createEdition;
$('#regenerate').onclick = createEdition;

function closeSpeech() {
  speechGeneration++; if ('speechSynthesis' in window) window.speechSynthesis.cancel(); speechPlaying = false; speechUtterance = null; $('#player').hidden = true; document.body.classList.remove('audio-open');
}
function startSpeech(index) {
  if (!('speechSynthesis' in window)) { toast('Tu navegador no admite lectura en voz alta. Puedes leer la edición en pantalla.'); return; }
  if (!edition?.paragraphs.length) return;
  speechGeneration++; window.speechSynthesis.cancel(); speechIndex = Math.max(0, Math.min(index, edition.paragraphs.length - 1));
  const token = speechGeneration;
  $('#player').hidden = false; document.body.classList.add('audio-open');
  const read = () => {
    if (token !== speechGeneration) return;
    const p = edition.paragraphs[speechIndex];
    if (!p) { speechPlaying = false; $('#player-toggle').textContent = '▶'; $('#player-toggle').setAttribute('aria-label', 'Volver a escuchar'); $('#player-label').textContent = 'Edición terminada'; $('#player-progress-fill').style.width = '100%'; return; }
    const names = [...new Set(p.sourceIds.map(id => edition.articles.find(a => a.id === id)?.sourceName).filter(Boolean))];
    const utterance = new SpeechSynthesisUtterance('Según ' + names.join(' y ') + '. ' + p.text);
    speechUtterance = utterance; utterance.lang = 'es-ES'; utterance.rate = Number($('#player-speed').value);
    const voices = window.speechSynthesis.getVoices(); utterance.voice = voices.find(v => v.lang === 'es-ES') || voices.find(v => v.lang.startsWith('es')) || null;
    utterance.onstart = () => { if (token !== speechGeneration) return; speechPlaying = true; $('#player-toggle').textContent = 'Ⅱ'; $('#player-toggle').setAttribute('aria-label', 'Pausar audio'); $('#player-label').textContent = 'Noticia ' + (speechIndex + 1) + ' de ' + edition.paragraphs.length; $('#player-progress-fill').style.width = speechIndex / edition.paragraphs.length * 100 + '%'; };
    utterance.onend = () => { if (token !== speechGeneration) return; speechIndex++; read(); };
    utterance.onerror = event => { if (token !== speechGeneration || event.error === 'canceled' || event.error === 'interrupted') return; closeSpeech(); toast('La voz de tu dispositivo no está disponible. Puedes leer la edición.'); };
    window.speechSynthesis.speak(utterance);
  };
  read();
}
$('#player-toggle').onclick = () => {
  if (!('speechSynthesis' in window)) return;
  if (speechPlaying) { speechSynthesis.pause(); speechPlaying = false; $('#player-toggle').textContent = '▶'; $('#player-toggle').setAttribute('aria-label', 'Continuar audio'); }
  else if (speechSynthesis.paused) { speechSynthesis.resume(); speechPlaying = true; $('#player-toggle').textContent = 'Ⅱ'; $('#player-toggle').setAttribute('aria-label', 'Pausar audio'); }
  else startSpeech(speechIndex >= edition.paragraphs.length ? 0 : speechIndex);
};
$('#player-back').onclick = () => startSpeech(speechIndex - 1);
$('#player-next').onclick = () => { if (speechIndex + 1 >= edition.paragraphs.length) closeSpeech(); else startSpeech(speechIndex + 1); };
$('#player-speed').onchange = () => { if (speechUtterance) startSpeech(speechIndex); };
$('#player-close').onclick = closeSpeech;
window.addEventListener('pagehide', closeSpeech);

async function ask(question) {
  if (chatBusy || question.trim().length < 3) return;
  chatBusy = true;
  $('#ask-form button').disabled = true; $('#question').value = '';
  $('#chat-messages').insertAdjacentHTML('beforeend', `<div class="chat-message user"><strong>TÚ</strong><p>${esc(question)}</p></div><div class="chat-message" id="pending-answer"><strong>BRÚJULA</strong><p>Buscando en las fuentes recientes…</p></div>`);
  const pending = $('#pending-answer'); pending.scrollIntoView({ block: 'center' });
  try {
    const result = await request('/api/ask', { question });
    pending.innerHTML = `<strong>BRÚJULA · ${result.mode === 'ai' ? 'RESPUESTA CON IA' : 'FUENTES'}</strong>${result.message ? '<p>' + esc(result.message) + '</p>' : ''}${result.paragraphs.map(p => `<p>${esc(p.text)}</p>${citations(p, result.articles)}`).join('')}${result.notice ? '<p>' + esc(result.notice) + '</p>' : ''}`;
  } catch (error) { pending.innerHTML = '<strong>BRÚJULA</strong><p>' + esc(error.message) + '</p>'; }
  finally { pending.removeAttribute('id'); chatBusy = false; $('#ask-form button').disabled = false; }
}
$('#ask-form').onsubmit = e => { e.preventDefault(); ask($('#question').value); };
$$('[data-question]').forEach(b => { b.onclick = () => ask(b.dataset.question); });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('#install-confirm').hidden = false; });
$$('[data-install], #install-side').forEach(b => { b.onclick = () => $('#install-dialog').showModal(); });
$('#close-install').onclick = () => $('#install-dialog').close();
$('#install-confirm').onclick = async () => { if (!installPrompt) return; await installPrompt.prompt(); installPrompt = null; $('#install-confirm').hidden = true; $('#install-dialog').close(); };
window.addEventListener('appinstalled', () => toast('Brújula está en tu pantalla de inicio.'));

async function init() {
  navigate(location.hash.slice(1) || 'home', false);
  renderSaved();
  try {
    config = await request('/api/config');
    preferences = Object.fromEntries(config.categories.map(c => [c.id, Number.isInteger(preferences[c.id]) && preferences[c.id] >= 0 && preferences[c.id] <= 3 ? preferences[c.id] : defaults[c.id]]));
    draftPreferences = { ...preferences }; draftProfile = normalizeProfile(profile);
    renderInterests(); renderProfileControls(); renderSources();
    $('#ai-status').textContent = config.aiAvailable ? 'Respuestas con IA basadas en extractos RSS. Comprueba siempre las fuentes.' : 'Modo fuentes activo. La respuesta redactada con IA está pendiente de activación.';
    await loadNews();
  } catch { loadError = 'No se puede conectar con Brújula. Comprueba tu conexión y vuelve a cargar la página.'; renderFeed(); $('#ai-status').textContent = 'Sin conexión. Vuelve a intentarlo cuando recuperes el acceso a internet.'; }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}
init();
