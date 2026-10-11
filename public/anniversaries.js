const dayKey = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type).value).join('-');
};

export function mountMusicAnniversaries({ request, escapeHTML: esc, safeURL }) {
  const grid = document.querySelector('#anniversary-grid');
  const status = document.querySelector('#anniversary-status');
  const era = document.querySelector('#anniversary-era'), kind = document.querySelector('#anniversary-kind');
  const more = document.querySelector('#anniversary-more');
  if (!grid || !status || !era || !kind || !more) return { refresh: () => {}, refreshIfNewDay: () => {} };
  let data = null, limit = 4, busy = false;
  function render() {
    if (!data) return;
    const items = data.items.filter(item => (era.value !== '80s' || item.year >= 1980 && item.year <= 1989) && (kind.value === 'all' || item.kind === kind.value));
    const date = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' }).format(new Date(data.date + 'T12:00:00Z'));
    status.textContent = date + ' · ' + items.length + ' efemérides · Fecha de Madrid';
    grid.innerHTML = items.length ? items.slice(0, limit).map(item => `<article class="news-card anniversary-card"><div class="card-graphic cat-musica"><span>${esc(item.label)}</span><span class="category-icon" aria-hidden="true">◖</span></div><div class="card-body"><div class="card-source"><span class="source-logo">${esc(item.sourceName)}</span></div><h3>${esc(item.year)} · ${esc(item.title)}</h3><p>${esc(item.text)}</p><div class="match-reasons">Hace ${esc(item.yearsAgo)} años</div></div><div class="card-footer"><a href="${esc(safeURL(item.sourceURL || item.url))}" target="_blank" rel="noopener noreferrer">Consultar la fuente ↗</a></div></article>`).join('') : '<div class="empty-state"><span>◖</span><h2>No hay coincidencias para este día.</h2><p>Prueba otra época o tipo de efeméride.</p></div>';
    more.hidden = items.length <= limit;
  }
  async function refresh() {
    if (busy) return;
    busy = true;
    status.textContent = 'Consultando las efemérides musicales del día…';
    try { data = await request('/api/music-anniversaries'); limit = 4; render(); }
    catch { status.textContent = 'Las efemérides no están disponibles ahora.'; grid.innerHTML = '<div class="empty-state"><span>◖</span><h2>No podemos consultar el calendario.</h2><p>Pulsa Actualizar para reintentar. Los calendarios enlazados siguen disponibles.</p></div>'; more.hidden = true; }
    finally { busy = false; }
  }
  era.onchange = kind.onchange = () => { limit = 4; render(); };
  more.onclick = () => { limit += 8; render(); };
  refresh();
  return { refresh, refreshIfNewDay: () => { if (!data || data.date !== dayKey()) refresh(); } };
}
