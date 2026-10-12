import { calendarDay } from './anniversary-news.js';

export function mountMusicAnniversaries({ request, onUpdate = () => {}, isEnabled = () => true }) {
  let data = null, busy = false;
  async function refresh() {
    if (busy || !isEnabled()) return;
    busy = true;
    try { data = await request('/api/music-anniversaries'); }
    catch { data = { available: false, date: calendarDay(), items: [] }; }
    finally { busy = false; onUpdate(data); }
  }
  refresh();
  return { get data() { return data; }, refresh, refreshIfNewDay: () => {
    if (isEnabled() && (!data || data.date !== calendarDay())) refresh();
  } };
}
