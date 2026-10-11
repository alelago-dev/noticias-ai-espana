import { personalize, normalizeProfile, normalizeText } from './personalization.js';
import { selectBulletin } from './bulletin.js';
import { NewsPlayer } from './audio-player.js';
import { ClipPlayer } from './clip-player.js';
import { mountMusicAnniversaries } from './anniversaries.js';
import { NewsMusic, musicPreferences, MUSIC_REVISION } from './news-music.js';
import { narratorFor, resolveNarrators, voiceKey, bulletinStory, storyNarration } from './narration.js';
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
let playerEdition = null;
let installPrompt = null, toastTimer;
const storedBulletin = stored('brujula-bulletin', {});
let bulletinScope = ['espana', 'mundo', 'personal'].includes(storedBulletin?.scope) ? storedBulletin.scope : 'espana';
let bulletinHours = [6, 12, 24].includes(storedBulletin?.hours) ? storedBulletin.hours : 12;
let morningEdition = null;
const scopeName = scope => ({ espana: 'España', mundo: 'Mundo', personal: 'Mis temas' })[scope] || 'Mis temas';

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
  if (next === 'edition' && !edition && morningEdition) { edition = morningEdition; renderEdition(); }
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
  filter = 'all'; displayLimit = 9; edition = null; closeSpeech(); prepareMorning();
  $('#edition-content').innerHTML = empty('Tu selección ha cambiado.', 'Prepara una nueva edición con tus intereses actualizados.');
  renderInterests(); renderFeed(); updateSaveStatus(); toast('Tus intereses se aplican al feed y a la edición Mis temas.'); navigate('home');
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
    return `<article class="source-card"><h2>${esc(s.name)}</h2><div class="source-state ${status && !status.fresh ? 'unavailable' : ''}"><i></i>${state}</div><small>${status?.recentCount ?? '—'} noticias en 24 h · ${status?.activeFeeds ?? '—'} canales disponibles</small>${status?.relayed ? '<small>RSS recibido a través de Feedly</small>' : ''}<small>Última publicación: ${status?.latestPublishedAt ? esc(age(status.latestPublishedAt)) : 'sin noticias recientes'}</small><small>Comprobado: ${status?.checkedAt ? esc(new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date(status.checkedAt))) : 'pendiente'}</small><a href="${esc(safeURL(s.site))}" target="_blank" rel="noopener noreferrer">Visitar el medio original ↗</a></article>`;
  }).join('');
}
async function loadNews(force = false) {
  if ($('#refresh').disabled) return;
  $('#refresh').disabled = true;
  if (!news.articles.length) $('#feed').innerHTML = '<div class="skeleton"></div>'.repeat(3);
  try { news = await request('/api/news' + (force === true ? '?refresh=1' : '')); loadError = null; }
  catch (error) { loadError = error.message; }
  renderFeed(); renderSources(); prepareMorning(); $('#refresh').disabled = false;
}
$('#refresh').onclick = () => loadNews(true);
setInterval(() => { if (document.visibilityState === 'visible') loadNews(); }, 120000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && (!news.updatedAt || Date.now() - +new Date(news.updatedAt) >= 120000)) loadNews(); });

function citations(paragraph, articles) {
  return `<div class="citations">${paragraph.sourceIds.map(id => articles.find(a => a.id === id)).filter(Boolean).map(a => `<a href="${esc(safeURL(a.url))}" target="_blank" rel="noopener noreferrer" title="${esc(a.title)}">${esc(a.sourceName)} · ${esc(a.title.slice(0, 65))}${a.title.length > 65 ? '…' : ''} ↗</a>`).join('')}</div>`;
}
function prepareMorning() {
  const length = $('#bulletin-length').value;
  const limit = length === 'short' ? 6 : length === 'long' ? 20 : 12;
  const articles = loadError ? [] : selectBulletin(news.articles, { scope: bulletinScope, hours: bulletinHours, limit, preferences, profile });
  const paragraphs = articles.map(a => ({ text: a.title + (a.excerpt && !a.excerpt.startsWith(a.title) ? '. ' + a.excerpt : ''), sourceIds: [a.id] }));
  morningEdition = paragraphs.length ? { mode: 'extractive', scope: bulletinScope, hours: bulletinHours, articles, paragraphs, updatedAt: news.updatedAt, estimatedSeconds: Math.max(1, Math.round(paragraphs.map(p => p.text).join(' ').split(/\s+/).length / 2.5)) } : null;
  $('#create-edition').disabled = !morningEdition;
  $$('[data-scope]').forEach(b => { const active = b.dataset.scope === bulletinScope; b.classList.toggle('active', active); b.setAttribute('aria-pressed', active); });
  const clock = news.updatedAt ? new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date(news.updatedAt)) : '';
  $('#bulletin-meta').textContent = morningEdition ? articles.length + (articles.length === 1 ? ' noticia · ' : ' noticias · ') + Math.ceil(morningEdition.estimatedSeconds / 60) + ' min aprox. · ' + new Set(articles.map(a => a.source)).size + (new Set(articles.map(a => a.source)).size === 1 ? ' medio · Comprobado ' : ' medios · Comprobado ') + clock : loadError ? 'No se pueden actualizar las noticias. Pulsa Actualizar para reintentar.' : 'No hay noticias en este intervalo. Prueba 24 horas u otro ámbito.';
}
$('#bulletin-hours').value = bulletinHours;
function updateBulletin() {
  bulletinHours = Number($('#bulletin-hours').value);
  $('#edition-length').value = $('#bulletin-length').value;
  saveLocal('brujula-bulletin', { scope: bulletinScope, hours: bulletinHours });
  prepareMorning();
}
$('#bulletin-scopes').onclick = e => { const b = e.target.closest('[data-scope]'); if (b) { bulletinScope = b.dataset.scope; updateBulletin(); } };
$('#bulletin-hours').onchange = updateBulletin;
$('#bulletin-length').onchange = updateBulletin;
function renderEdition() {
  if (!edition) return;
  const min = Math.ceil(edition.estimatedSeconds / 60);
  const mode = edition.mode === 'ai' ? 'Resumen con IA · Revisa las fuentes' : 'Selección de titulares y extractos RSS';
  const time = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date(edition.updatedAt));
  $('#edition-content').innerHTML = `<div class="edition-header"><div><div class="eyebrow">${esc(scopeName(edition.scope))} · ÚLTIMAS ${edition.hours || profile.hours} HORAS</div><h2>Lo que ha pasado, a tu alcance.</h2><p>${min} min aprox. · ${edition.articles.length} noticias · ${new Set(edition.articles.map(a => a.source)).size} medios<br>Fuentes comprobadas a las ${time} · Hora de Madrid</p></div><button id="listen-edition" class="primary-button"><span>▶</span> Escuchar edición</button></div><p class="edition-notice">${esc(mode)}. ${esc(edition.notice || (edition.audio ? 'La duración depende del contenido disponible. Locución con voz neuronal.' : 'La duración depende del contenido disponible. La voz la proporciona tu dispositivo.'))} ${edition.mode === 'extractive' ? 'La síntesis redactada con IA está pendiente de activación.' : ''}</p><p class="edition-notice">${edition.scope === 'personal' ? 'Selección según tus intereses.' : 'Selección automática por actualidad, coincidencia de titulares entre medios y variedad de temas. La clasificación geográfica puede contener errores.'} La escucha con la pantalla bloqueada depende del navegador.</p><div class="transcript">${edition.paragraphs.map((p, i) => { const story = bulletinStory(p, edition.articles, config.categories); return `<section class="transcript-section" id="paragraph-${i}"><button class="story-listen text-button" data-listen-story="${i}" aria-label="Escuchar noticia ${i + 1}">▶ Escuchar noticia ${i + 1}</button><h3 class="story-heading">${esc(story.heading)}</h3>${story.body ? `<p>${esc(story.body)}</p>` : ''}${citations(p, edition.articles)}</section>`; }).join('')}</div>`;
  $('#listen-edition').onclick = () => startSpeech(0);
}
async function createEdition() {
  if (editionBusy) return;
  const scope = bulletinScope, hours = bulletinHours;
  navigate('edition'); editionBusy = true; $('#regenerate').disabled = true;
  $('#edition-content').innerHTML = empty('Preparando tu edición…', 'Seleccionamos noticias recientes de ' + scopeName(bulletinScope) + ' y conservamos sus fuentes.');
  closeSpeech(); edition = null;
  try { const result = await request('/api/edition', { preferences, profile, scope, hours, length: $('#edition-length').value, audio: config.audioAvailable, narration: narration.mode }); edition = { ...result, scope, hours }; renderEdition(); }
  catch (error) { $('#edition-content').innerHTML = `<div class="empty-state error-state"><span>✳</span><h2>No hemos podido preparar la edición.</h2><p>${esc(error.message)}</p><button class="outline-button" data-view="preferences">Revisar mis intereses ↗</button></div>`; }
  finally { editionBusy = false; $('#regenerate').disabled = false; }
}
const audioEditions = new Map();
async function listenWithVoice() {
  if (editionBusy) return;
  // Unlock audio inside the tap; the edition arrives later, outside the gesture.
  clipPlayer.unlock(); if (music.enabled) music.unlock();
  const scope = bulletinScope, hours = bulletinHours, length = $('#bulletin-length').value;
  const key = JSON.stringify([scope, hours, length, narration.mode, preferences, profile]);
  const cached = audioEditions.get(key);
  if (cached && Date.now() - cached.at < 20 * 60_000) { edition = cached.edition; navigate('edition'); renderEdition(); startSpeech(0); return; }
  editionBusy = true; closeSpeech(); edition = null; navigate('edition');
  $('#edition-content').innerHTML = empty('Preparando tu informativo…', 'Redactamos el guion con las noticias de ' + scopeName(scope) + ' y preparamos la voz. Suele tardar unos segundos.');
  try {
    const result = await request('/api/edition', { preferences, profile, scope, hours, length, audio: true, narration: narration.mode });
    edition = { ...result, scope, hours }; audioEditions.set(key, { at: Date.now(), edition });
  } catch {
    edition = morningEdition; toast('No se pudo preparar la voz neuronal. Leemos los titulares con la voz de tu dispositivo.');
  } finally { editionBusy = false; }
  renderEdition(); startSpeech(0);
}
$('#create-edition').onclick = () => {
  prepareMorning();
  if (!morningEdition) return;
  if (config.audioAvailable) { $('#edition-length').value = $('#bulletin-length').value; return listenWithVoice(); }
  // Already prepared: speech begins within the tap gesture, including on mobile.
  edition = morningEdition; $('#edition-length').value = $('#bulletin-length').value;
  navigate('edition'); renderEdition(); startSpeech(0);
};
$('#regenerate').onclick = createEdition;

const musicSettings = musicPreferences(stored('brujula-music', null));
const music = new NewsMusic(musicSettings);
saveLocal('brujula-music', musicSettings);
const savedNarration = stored('brujula-narration', {});
let narration = { mode: ['alternating', 'female', 'male'].includes(savedNarration?.mode) ? savedNarration.mode : 'alternating', female: typeof savedNarration?.female === 'string' ? savedNarration.female : '', male: typeof savedNarration?.male === 'string' ? savedNarration.male : '' };
const newsPlayer = 'speechSynthesis' in window ? new NewsPlayer({
  engine: window.speechSynthesis,
  chooseVoice: (index, voices) => narratorFor(index, voices, narration),
  makeUtterance: text => new SpeechSynthesisUtterance(text),
  onChange: updatePlayer,
  onError: () => { closeSpeech(); toast('La voz de tu dispositivo no está disponible. Puedes leer la edición.'); },
}) : null;
async function fetchClipURL(clip) {
  const response = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: clip.text, voice: clip.voice, sig: clip.sig }), signal: AbortSignal.timeout(55_000) });
  if (!response.ok) throw new Error('tts-' + response.status);
  return URL.createObjectURL(await response.blob());
}
const clipAudio = new Audio(); clipAudio.preload = 'auto';
const clipPlayer = new ClipPlayer({
  audio: clipAudio, fetchClip: fetchClipURL, releaseClip: url => URL.revokeObjectURL(url), onChange: updatePlayer,
  onError: (_error, index) => handleClipError(index),
  mediaSession: 'mediaSession' in navigator ? navigator.mediaSession : null, makeMetadata: init => new MediaMetadata(init),
});
let activePlayer = newsPlayer;
function updateMusicControls() {
  $('#player-music').setAttribute('aria-pressed', String(music.enabled));
  $('#player-music').setAttribute('aria-label', music.enabled ? 'Silenciar música de fondo' : 'Activar música de fondo');
  $('#player-music').title = music.enabled ? 'Silenciar música de fondo' : 'Activar música de fondo';
  $('#music-volume').value = music.volume;
  $('#music-volume').disabled = !music.enabled;
  $('#music-volume-value').textContent = music.volume + '%';
}
function updatePlayer(state) {
  const playing = state.status === 'playing', finished = state.status === 'finished';
  const current = playerEdition?.paragraphs[state.index];
  const story = current && bulletinStory(current, playerEdition.articles, config.categories);
  $('#player-title').textContent = story?.heading || 'Tu informativo Brújula';
  $('#player-label').textContent = state.previewing ? 'Probando voz · Informativo en pausa' : finished ? 'Edición terminada' : 'Noticia ' + (state.index + 1) + ' de ' + state.count + (state.voiceName ? ' · ' + state.voiceName : '') + (state.status === 'paused' ? ' · En pausa' : '') + (state.status === 'loading' ? ' · Preparando audio…' : '');
  $('#voice-preview-status').textContent = state.previewing ? 'Escuchando la prueba. El informativo queda en pausa.' : '';
  $('#player-toggle').textContent = playing ? 'Ⅱ' : state.status === 'loading' ? '…' : '▶';
  $('#player-toggle').setAttribute('aria-label', playing ? 'Pausar audio' : finished ? 'Volver a escuchar' : 'Continuar audio');
  $('#player-next').disabled = finished || !state.count;
  $('#player-back').disabled = state.index === 0 || !state.count;
  $('#player-progress-fill').style.width = state.progress * 100 + '%';
  $('#player-speed-note').textContent = state.pendingRate ? 'La nueva velocidad se aplica desde la próxima frase.' : '';
  $$('.transcript-section').forEach((el, i) => el.classList.toggle('currently-listening', i === state.index && state.status !== 'idle' && !finished));
  document.body.classList.toggle('is-playing', playing);
  if (playing && music.enabled) music.start(); else music.pause();
}
function setPlayerExpanded(on) {
  $('#player').classList.toggle('expanded', on); document.body.classList.toggle('player-expanded', on);
  $('#player-expand').setAttribute('aria-expanded', String(on));
  $('#player-expand').setAttribute('aria-label', on ? 'Reproductor completo' : 'Abrir reproductor completo');
  if (on) $('#player-collapse').focus({ preventScroll: true });
}
$('#player-expand').onclick = () => { if (!$('#player').classList.contains('expanded')) setPlayerExpanded(true); };
$('#player-collapse').onclick = () => { setPlayerExpanded(false); $('#player-expand').focus({ preventScroll: true }); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#player').classList.contains('expanded')) setPlayerExpanded(false); });
function closeSpeech() {
  setPlayerExpanded(false); document.body.classList.remove('is-playing');
  newsPlayer?.stop(); clipPlayer.stop(); music.pause(); playerEdition = null;
  $('#player').hidden = true; document.body.classList.remove('audio-open');
}
function startSpeech(index) {
  if (edition?.audio?.clips?.length && !edition.audioFailed) return startClips(index);
  startDevice(index);
}
function startClips(index) {
  newsPlayer?.stop(); activePlayer = clipPlayer;
  if (playerEdition !== edition) {
    clipPlayer.load(edition.audio.clips, { titles: edition.paragraphs.map(p => bulletinStory(p, edition.articles, config.categories).heading), album: 'Informativo de ' + scopeName(edition.scope) });
    playerEdition = edition;
  }
  if (music.enabled) music.unlock();
  clipPlayer.setRate(Number($('#player-speed').value));
  $('#player').hidden = false; document.body.classList.add('audio-open');
  clipPlayer.play(index);
}
function handleClipError(index) {
  const resume = edition?.paragraphs.length && newsPlayer;
  if (edition) edition.audioFailed = true;
  playerEdition = null; music.pause();
  if (!resume) { closeSpeech(); toast('No se pudo reproducir el audio. Puedes leer la edición.'); return; }
  toast('No se pudo cargar la voz neuronal. Seguimos con la voz de tu dispositivo.');
  startDevice(Math.min(index, edition.paragraphs.length - 1));
}
function startDevice(index) {
  clipPlayer.stop(); activePlayer = newsPlayer;
  if (!newsPlayer) { toast('Tu navegador no admite lectura en voz alta. Puedes leer la edición en pantalla.'); return; }
  if (!edition?.paragraphs.length) return;
  if (playerEdition !== edition) {
    newsPlayer.load(edition.paragraphs.map((p, i) => {
      const opening = i === 0 ? 'Brújula, informativo de ' + scopeName(edition.scope) + '. Noticias de las últimas ' + (edition.hours || profile.hours) + ' horas. ' : '';
      return opening + storyNarration(bulletinStory(p, edition.articles, config.categories));
    }));
    playerEdition = edition;
  }
  if (music.enabled) music.unlock();
  newsPlayer.setRate(Number($('#player-speed').value));
  $('#player').hidden = false; document.body.classList.add('audio-open');
  newsPlayer.play(index);
}
$('#player-toggle').onclick = () => { if (!activePlayer) return; if (activePlayer.status === 'playing') activePlayer.pause(); else { if (music.enabled) music.unlock(); activePlayer.play(); } };
$('#player-back').onclick = () => activePlayer?.previous();
$('#player-next').onclick = () => activePlayer?.next();
$('#player-speed').onchange = () => { activePlayer?.setRate(Number($('#player-speed').value)); };
$('#player-music').onclick = () => {
  music.setEnabled(!music.enabled);
  if (music.enabled && activePlayer?.status === 'playing') music.start();
  saveLocal('brujula-music', { enabled: music.enabled, volume: music.volume, revision: MUSIC_REVISION }); updateMusicControls();
};
$('#music-volume').oninput = e => { music.setVolume(e.target.value); saveLocal('brujula-music', { enabled: music.enabled, volume: music.volume, revision: MUSIC_REVISION }); updateMusicControls(); };
$('#player-close').onclick = closeSpeech;
$('#player-voices').onclick = () => { navigate('edition'); $('#voice-settings').open = true; $('#voice-settings').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
document.addEventListener('click', e => { const b = e.target.closest('[data-listen-story]'); if (b) startSpeech(Number(b.dataset.listenStory)); });
// Neural audio is a real <audio> element and should survive the page being backgrounded.
window.addEventListener('pagehide', () => { if (activePlayer !== clipPlayer) closeSpeech(); });
updateMusicControls();
function renderNarration() {
  const pair = resolveNarrators(window.speechSynthesis?.getVoices() || [], narration);
  $('#voice-settings summary span').textContent = narration.mode === 'female' ? 'Solo presentadora' : narration.mode === 'male' ? 'Solo presentador' : pair.distinct ? 'Presentadora + presentador' : pair.available.length === 1 ? 'Una voz disponible' : 'Elegir las dos voces';
  $('#narration-mode').value = narration.mode;
  for (const role of ['female', 'male']) {
    const resolved = pair[role];
    $('#voice-' + role).innerHTML = '<option value="">Automática' + (resolved ? ' · ' + esc(resolved.name) : '') + '</option>' + pair.available.map(v => '<option value="' + esc(voiceKey(v)) + '">' + esc(v.name) + ' · ' + esc(v.lang) + '</option>').join('');
    $('#voice-' + role).value = pair.available.some(v => voiceKey(v) === narration[role]) ? narration[role] : '';
    $('#voice-' + role).disabled = !pair.available.length;
    $('#preview-' + role).disabled = !newsPlayer || !(pair[role] || pair.fallback);
  }
  $('#voice-status').textContent = config.audioAvailable ? 'Locución con voces neuronales de Brújula (' + config.audioVoices.join(' y ') + '). ' + (narration.mode === 'alternating' ? 'Se alternan entre noticias.' : 'Se usa una sola voz.') + ' Las voces del dispositivo solo se usan si falla el audio.' : !newsPlayer ? 'Este navegador no admite lectura en voz alta.' : !pair.available.length ? 'El navegador todavía no ofrece voces en español. Usaremos su voz por defecto hasta que estén disponibles.' : pair.distinct ? (narration.mode === 'alternating' ? 'Dos voces elegidas: se alternan entre noticias completas, empezando por la presentadora.' : 'Se usará la voz elegida para todas las noticias.') : pair.available.length === 1 ? 'Tu navegador ofrece una sola voz en español: se usará para ambas. Para alternar, necesitas que el dispositivo ofrezca dos voces.' : 'El navegador no identifica una pareja automáticamente. Escucha las pruebas y elige una voz para cada presentador.';
}
function updateNarration() {
  narration = { mode: $('#narration-mode').value, female: $('#voice-female').value, male: $('#voice-male').value };
  saveLocal('brujula-narration', narration); renderNarration();
  if (activePlayer?.status === 'playing' || activePlayer?.status === 'paused') toast(activePlayer === clipPlayer ? 'El cambio de voces se aplica al preparar el siguiente informativo.' : 'Las nuevas voces se aplicarán desde la próxima noticia.');
}
$('#narration-mode').onchange = updateNarration;
$('#voice-female').onchange = updateNarration;
$('#voice-male').onchange = updateNarration;
for (const role of ['female', 'male']) $('#preview-' + role).onclick = () => {
  const pair = resolveNarrators(window.speechSynthesis?.getVoices() || [], narration);
  const voice = pair[role] || pair.fallback;
  if (!voice || !newsPlayer) return;
  music.pause(); newsPlayer.preview('Buenos días. Este es tu informativo Brújula. Te contamos las noticias de las últimas horas, con sus fuentes.', voice);
};
window.speechSynthesis?.addEventListener('voiceschanged', renderNarration);
renderNarration();

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
    renderInterests(); renderProfileControls(); renderSources(); renderNarration();
    $('#audio-limitation').textContent = config.audioAvailable ? 'Locución con voz neuronal. La escucha con la pantalla bloqueada puede depender de tu navegador.' : 'Voz del dispositivo. La reproducción con la pantalla bloqueada depende del navegador.';
    $('#ai-status').textContent = config.aiAvailable ? 'Respuestas con IA basadas en extractos RSS. Comprueba siempre las fuentes.' : 'Modo fuentes activo. La respuesta redactada con IA está pendiente de activación.';
    await loadNews();
  } catch { loadError = 'No se puede conectar con Brújula. Comprueba tu conexión y vuelve a cargar la página.'; renderFeed(); prepareMorning(); $('#ai-status').textContent = 'Sin conexión. Vuelve a intentarlo cuando recuperes el acceso a internet.'; }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}
init();
const musicAnniversaries = mountMusicAnniversaries({ request, escapeHTML: esc, safeURL });
$('#refresh').addEventListener('click', () => musicAnniversaries.refresh());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') musicAnniversaries.refreshIfNewDay(); });
setInterval(() => { if (document.visibilityState === 'visible') musicAnniversaries.refreshIfNewDay(); }, 60000);
