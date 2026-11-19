// Ferien & Feiertage laden (OpenHolidays API) und lokal zwischenspeichern.
// Gesendet wird nur das Bundesland-Kürzel. Der Cache gilt 30 Tage, offline wird er weiter benutzt.
import { metaDB } from './db.js';
import { settings, emit } from './store.js';
import { normalizeHolidays, holidayUrls, fetchRange } from './logic/holidays.js';
import { schoolYear, today, daysBetween } from './logic/dates.js';

let cache = { state: '', list: [], fetchedAt: null, from: null, to: null, error: null };
let inflight = null;

export async function loadHolidays() {
  cache = { ...cache, ...(await metaDB.get('holidays', {})) };
}

/** Ferien des eingestellten Bundeslands (leer, wenn keins gewählt ist). */
export const holidayList = () => (settings().state && cache.state === settings().state ? cache.list : []);
export const holidayStatus = () => ({ ...cache, list: undefined, count: cache.list.length });

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function refreshHolidays({ force = false } = {}) {
  const state = settings().state;
  if (!state) return { ok: false, reason: 'nostate' };
  const { from, to } = fetchRange(schoolYear(settings(), today()).start);
  const fresh = cache.state === state && cache.fetchedAt && daysBetween(cache.fetchedAt.slice(0, 10), today()) < 30 && cache.from <= from && cache.to >= to;
  if (fresh && !force) return { ok: true, cached: true, count: cache.list.length };
  if (!navigator.onLine) return { ok: false, reason: 'offline' };
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const urls = holidayUrls(state, from, to);
      const [school, pub] = await Promise.all([fetchJson(urls.school), fetchJson(urls.public)]);
      const list = [...normalizeHolidays(school, 'school', state), ...normalizeHolidays(pub, 'public', state)];
      cache = { state, list, fetchedAt: new Date().toISOString(), from, to, error: null };
      await metaDB.set('holidays', cache);
      emit({ ids: [], types: ['holidays'], source: 'local' });
      return { ok: true, count: list.length };
    } catch (e) {
      cache = { ...cache, error: String(e?.message || e) };
      return { ok: false, reason: 'network', error: e };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
