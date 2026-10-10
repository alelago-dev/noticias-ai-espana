const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const defaults = { espana: 2, politica: 2, economia: 2, tecnologia: 3, internacional: 1, deportes: 0, ciencia: 1, cultura: 0, salud: 0, medioambiente: 0, sociedad: 0, educacion: 0 };
function stored(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function saveLocal(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { toast('No se pudo guardar en este navegador. Comprueba el espacio disponible.'); } }
let preferences = stored('brujula-interests', { ...defaults });
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
window.addEventListener('hashchange', () => navigate(location.hash.slice(1), false));
$('#today').textContent = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' }).format(new Date());

function card(a) {
  const c = category(a.category), isSaved = saved.some(s => s.id === a.id);
  return `<article class="news-card"><div class="card-graphic cat-${esc(a.category)}"><span>${esc(c.name)}</span><span class="category-icon" aria-hidden="true">${esc(c.icon)}</span></div><div class="card-body"><div class="card-source"><span class="source-logo">${esc(a.sourceName)}</span><span class="source-dot"></span><time datetime="${esc(a.publishedAt)}">${esc(age(a.publishedAt))}</time></div><h3><a href="${esc(safeURL(a.url))}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a></h3>${a.excerpt ? `<p>${esc(a.excerpt)}</p>` : ''}</div><div class="card-footer"><a href="${esc(safeURL(a.url))}" target="_blank" rel="noopener noreferrer">Leer en ${esc(a.sourceName)} ↗</a><button class="save-button ${isSaved ? 'saved' : ''}" data-save="${esc(a.id)}" aria-label="${isSaved ? 'Quitar de guardadas' : 'Guardar noticia'}" aria-pressed="${isSaved}">${isSaved ? '▣' : '▱'}</button></div></article>`;
}
function empty(title, text, action = '') { return `<div class="empty-state"><span aria-hidden="true">✳</span><h2>${esc(title)}</h2><p>${esc(text)}</p>${action}</div>`; }
function selectedArticles() {
  let items = news.articles.filter(a => Number(preferences[a.category]) > 0 && (filter === 'all' || a.category === filter));
  const query = $('#search').value.trim().toLowerCase();
  if (query) items = items.filter(a => (a.title + ' ' + a.excerpt + ' ' + a.sourceName).toLowerCase().includes(query));
  items.sort((a, b) => ($('#sort').value === 'recent' ? 0 : preferences[b.category] - preferences[a.category]) || +new Date(b.publishedAt) - +new Date(a.publishedAt));
  return items;
}
function renderFeed() {
  const items = selectedArticles();
  $('#feed').innerHTML = loadError ? `<div class="empty-state error-state"><span>↻</span><h2>No podemos conectar con las noticias</h2><p>${esc(loadError)}</p><button class="outline-button" id="retry-news">Intentar de nuevo</button></div>` : items.length ? items.slice(0, displayLimit).map(card).join('') : empty('Tu radar está en calma.', news.articles.length ? 'No hay noticias que coincidan. Prueba otro filtro o amplía tus intereses.' : 'No hay publicaciones recientes disponibles de los medios.', '<button class="outline-button" data-view="preferences">Elegir mis intereses ↗</button>');
  $('#retry-news')?.addEventListener('click', loadNews);
  $('#load-more').hidden = items.length <= displayLimit || !!loadError;
  const available = news.sources.filter(s => s.available).length;
  $('#news-meta').textContent = news.updatedAt ? items.length + ' noticias · ' + available + ' medios conectados · Actualizado ' + new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date(news.updatedAt)) : 'Actualidad de medios españoles';
}
function renderInterests() {
  const selected = config.categories.filter(c => preferences[c.id] > 0);
  $('#interest-tags').innerHTML = selected.slice(0, 5).map(c => `<span class="interest-tag">${esc(c.name)}</span>`).join('') + (selected.length > 5 ? `<span class="interest-tag">+${selected.length - 5}</span>` : '') || '<span class="interest-tag">Elige tu primer tema</span>';
  $('#filters').innerHTML = `<button data-filter="all" class="${filter === 'all' ? 'active' : ''}" aria-pressed="${filter === 'all'}">Para ti</button>` + selected.map(c => `<button data-filter="${c.id}" class="${filter === c.id ? 'active' : ''}" aria-pressed="${filter === c.id}">${esc(c.name)}</button>`).join('');
  $('#preferences-grid').innerHTML = config.categories.map(c => `<div class="preference-card"><div class="preference-title"><span aria-hidden="true">${esc(c.icon)}</span>${esc(c.name)}</div><div class="levels" role="group" aria-label="Interés en ${esc(c.name)}">${['No seguir', 'Algo', 'Bastante', 'Mucho'].map((label, n) => `<button data-interest="${c.id}" data-level="${n}" class="${preferences[c.id] === n ? 'active' : ''}" aria-pressed="${preferences[c.id] === n}">${label}</button>`).join('')}</div></div>`).join('');
}
function updateInterests() { saveLocal('brujula-interests', preferences); if (!preferences[filter]) filter = 'all'; displayLimit = 9; renderInterests(); renderFeed(); }
$('#filters').addEventListener('click', e => { const b = e.target.closest('[data-filter]'); if (!b) return; filter = b.dataset.filter; displayLimit = 9; renderInterests(); renderFeed(); });
$('#preferences-grid').addEventListener('click', e => { const b = e.target.closest('[data-interest]'); if (!b) return; preferences[b.dataset.interest] = Number(b.dataset.level); updateInterests(); });
$('#select-all').onclick = () => { preferences = Object.fromEntries(config.categories.map(c => [c.id, 2])); updateInterests(); toast('Ahora sigues los doce temas.'); };
$('#reset-interests').onclick = () => { preferences = { ...defaults }; updateInterests(); toast('Selección inicial restablecida.'); };
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
  const domains = { elpais: 'elpais.com', abc: 'abc.es', eldiario: 'eldiario.es', europapress: 'europapress.es', xataka: 'xataka.com', elmundo: 'elmundo.es' };
  $('#sources-grid').innerHTML = config.sources.map(s => { const status = news.sources.find(x => x.id === s.id); return `<article class="source-card"><h2>${esc(s.name)}</h2><div class="source-state ${status && !status.available ? 'unavailable' : ''}"><i></i>${status ? status.available ? 'Canal RSS disponible' : 'Canal no disponible ahora' : 'Pendiente de conexión'}</div><small>${status?.count ?? '—'} publicaciones recientes</small><a href="https://${domains[s.id]}" target="_blank" rel="noopener noreferrer">Visitar el medio original ↗</a></article>`; }).join('');
}
async function loadNews() {
  $('#refresh').disabled = true;
  if (!news.articles.length) $('#feed').innerHTML = '<div class="skeleton"></div>'.repeat(3);
  try { news = await request('/api/news'); loadError = null; }
  catch (error) { loadError = error.message; }
  renderFeed(); renderSources(); $('#refresh').disabled = false;
}
$('#refresh').onclick = loadNews;

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
  try { edition = await request('/api/edition', { preferences, length: $('#edition-length').value }); renderEdition(); }
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
    renderInterests(); renderSources();
    $('#ai-status').textContent = config.aiAvailable ? 'Respuestas con IA basadas en extractos RSS. Comprueba siempre las fuentes.' : 'Modo fuentes activo. La respuesta redactada con IA está pendiente de activación.';
    await loadNews();
  } catch { loadError = 'No se puede conectar con Brújula. Comprueba tu conexión y vuelve a cargar la página.'; renderFeed(); $('#ai-status').textContent = 'Sin conexión. Vuelve a intentarlo cuando recuperes el acceso a internet.'; }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}
init();
