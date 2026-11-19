// Synchronisation über ein eigenes Supabase-Projekt (optional). Die App arbeitet immer lokal ("offline first");
// Änderungen werden im Hintergrund hochgeladen und die der anderen Geräte (iPhone ↔ iPad) heruntergeladen.
import { dirtyItems, markClean, applyRemote, getDevice, setDevice, subscribe } from './store.js';
import { metaDB } from './db.js';
import { debounce } from './ui/dom.js';

const TABLE = 'items';
const PAGE = 500;
const PUSH_BATCH = 200;
const statusListeners = new Set();
let status = { state: 'off', message: '', lastSync: null };
let backend = null;
let running = null;
let again = false;
let started = false;
let realtimeChannel = null;
let client = null;

// ---------- Status ----------
export const getStatus = () => status;
export function onStatus(fn) { statusListeners.add(fn); fn(status); return () => statusListeners.delete(fn); }
function setStatus(patch) {
  status = { ...status, ...patch };
  statusListeners.forEach((fn) => { try { fn(status); } catch {} });
}

// ---------- Konfiguration ----------
export function config() {
  const c = window.SP_CONFIG || {};
  const d = getDevice();
  return { url: (d.supabaseUrl || c.supabaseUrl || '').trim().replace(/\/+$/, ''), key: (d.supabaseAnonKey || c.supabaseAnonKey || '').trim() };
}
export const isConfigured = () => { const c = config(); return !!(c.url && c.key); };

let libPromise;
function loadLib() {
  if (window.supabase?.createClient) return Promise.resolve(window.supabase);
  if (!libPromise) {
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/supabase.min.js';
      s.onload = () => resolve(window.supabase);
      s.onerror = () => { libPromise = null; reject(new Error('Sync-Bibliothek konnte nicht geladen werden')); };
      document.head.appendChild(s);
    });
  }
  return libPromise;
}

async function getClient() {
  if (client) return client;
  const { url, key } = config();
  const lib = await loadLib();
  client = lib.createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sp-auth', detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return client;
}

/** Backend-Adapter für Supabase. Die Tests benutzen eine Fake-Variante mit derselben Form. */
export function supabaseBackend(c) {
  const q = (v) => `"${v}"`;
  return {
    async userId() {
      const { data } = await c.auth.getSession();
      return data.session?.user?.id || null;
    },
    async push(rows) {
      const { data, error } = await c.from(TABLE).upsert(rows, { onConflict: 'id' }).select('id, updated_at');
      if (error) throw error;
      return data;
    },
    async pull(afterTs, afterId, limit) {
      let query = c.from(TABLE).select('*').order('updated_at', { ascending: true }).order('id', { ascending: true }).limit(limit);
      if (afterTs && afterId) query = query.or(`updated_at.gt.${q(afterTs)},and(updated_at.eq.${q(afterTs)},id.gt.${afterId})`);
      else if (afterTs) query = query.gt('updated_at', afterTs);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  };
}

// ---------- Umwandlung lokal <-> Server ----------
const toRow = (it) => ({
  id: it.id,
  type: it.type,
  data: it.data,
  deleted: !!it.deleted,
  created_at: it.createdAt,
  client_updated_at: it.updatedAt,
});
const fromRow = (r) => ({
  id: r.id,
  type: r.type,
  data: r.data || {},
  deleted: !!r.deleted,
  createdAt: r.created_at,
  updatedAt: r.client_updated_at || r.updated_at,
  serverUpdatedAt: r.updated_at,
});
const msTs = (ts) => Date.parse(String(ts).replace(/(\.\d{3})\d+/, '$1'));

// ---------- Ablauf ----------
async function pushItems(be) {
  const dirty = dirtyItems();
  for (let i = 0; i < dirty.length; i += PUSH_BATCH) {
    const batch = dirty.slice(i, i + PUSH_BATCH);
    const res = await be.push(batch.map(toRow));
    const times = Object.fromEntries((res || []).map((r) => [r.id, r.updated_at]));
    // Nur als sauber markieren, wenn sich der Eintrag während des Hochladens nicht erneut geändert hat
    const now = new Map(dirtyItems().map((d) => [d.id, d]));
    const unchanged = batch.filter((b) => now.get(b.id)?.updatedAt === b.updatedAt).map((b) => b.id);
    await markClean(unchanged, times);
  }
  return dirty.length;
}

async function pullItems(be) {
  const cursor = await metaDB.get('syncCursor', null);
  // 10 Sekunden Überlappung, damit gleichzeitig geschriebene Zeilen nicht verloren gehen
  let afterTs = cursor ? new Date(msTs(cursor) - 10000).toISOString() : null;
  let afterId = null;
  let maxTs = cursor;
  let received = 0;
  for (;;) {
    const rows = await be.pull(afterTs, afterId, PAGE);
    if (!rows || !rows.length) break;
    const changed = await applyRemote(rows.map(fromRow));
    received += changed.length;
    for (const r of rows) if (!maxTs || msTs(r.updated_at) >= msTs(maxTs)) maxTs = r.updated_at;
    const last = rows[rows.length - 1];
    afterTs = last.updated_at;
    afterId = last.id;
    if (rows.length < PAGE) break;
  }
  if (maxTs) await metaDB.set('syncCursor', maxTs);
  return received;
}

/** Ein kompletter Sync-Durchlauf mit beliebigem Backend (für Tests exportiert). */
export async function syncWith(be) {
  const myId = await be.userId();
  if (!myId) throw Object.assign(new Error('Nicht angemeldet'), { code: 'auth' });
  const pushed = await pushItems(be);
  const received = await pullItems(be);
  return { pushed, received };
}

function friendlyError(e) {
  const msg = String(e?.message || e || '');
  if (e?.code === 'auth') return 'Nicht angemeldet';
  if (/row-level security|permission denied|42501/i.test(msg)) return 'Kein Zugriff – ist das Konto in der Tabelle „members“ eingetragen?';
  if (/JWT|token/i.test(msg)) return 'Anmeldung abgelaufen – bitte neu anmelden';
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return 'Keine Verbindung';
  if (/relation .* does not exist|42P01/i.test(msg)) return 'Datenbank nicht eingerichtet – setup.sql ausführen';
  return msg || 'Unbekannter Fehler';
}

export async function syncNow() {
  if (!backend) return;
  if (running) { again = true; return running; }
  if (!navigator.onLine) { setStatus({ state: 'offline', message: 'Offline – Änderungen werden später übertragen' }); return; }
  setStatus({ state: 'busy', message: 'Synchronisiere …' });
  running = (async () => {
    try {
      await syncWith(backend);
      setStatus({ state: 'idle', message: 'Alles synchronisiert', lastSync: new Date().toISOString() });
      await metaDB.set('lastSync', status.lastSync);
    } catch (e) {
      console.warn('Sync-Fehler', e);
      setStatus({ state: 'error', message: friendlyError(e) });
      if (e?.code === 'auth') stopRealtime();
    } finally {
      running = null;
      if (again) { again = false; setTimeout(() => syncNow(), 300); }
    }
  })();
  return running;
}

function startRealtime(c) {
  if (realtimeChannel) return;
  realtimeChannel = c.channel('items-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => scheduleSync())
    .subscribe();
}
function stopRealtime() {
  if (realtimeChannel && client) client.removeChannel(realtimeChannel);
  realtimeChannel = null;
}

const scheduleSync = debounce(() => syncNow(), 1200);

async function startEngine() {
  const c = await getClient();
  backend = supabaseBackend(c);
  const uid = await backend.userId();
  if (!uid) { backend = null; setStatus({ state: 'loggedout', message: 'Nicht angemeldet' }); return false; }
  const lastSync = await metaDB.get('lastSync', null);
  setStatus({ state: 'idle', message: '', lastSync });
  startRealtime(c);
  if (!started) {
    started = true;
    subscribe((evt) => { if (evt.source === 'local' && backend && evt.ids.length) scheduleSync(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && backend) syncNow(); });
    window.addEventListener('online', () => backend && syncNow());
    setInterval(() => { if (!document.hidden && backend) syncNow(); }, 3 * 60 * 1000);
  }
  syncNow();
  return true;
}

/** Beim App-Start aufrufen. */
export async function initSync() {
  if (!isConfigured()) { setStatus({ state: 'off', message: 'Sync nicht eingerichtet' }); return; }
  try {
    await startEngine();
  } catch (e) {
    setStatus({ state: 'error', message: friendlyError(e) });
  }
}

export async function currentUser() {
  if (!isConfigured()) return null;
  try {
    const c = await getClient();
    const { data } = await c.auth.getSession();
    return data.session?.user || null;
  } catch { return null; }
}

export async function login(email, password) {
  const c = await getClient();
  const { error } = await c.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(/Invalid login/i.test(error.message) ? 'E-Mail oder Passwort falsch' : error.message);
  await startEngine();
  await (running || Promise.resolve());
  return true;
}

export async function logout() {
  stopRealtime();
  if (client) await client.auth.signOut().catch(() => {});
  backend = null;
  await metaDB.delete('syncCursor');
  setStatus({ state: 'loggedout', message: 'Abgemeldet' });
}

/** Zugangsdaten auf diesem Gerät ändern (Alternative zu config.js). */
export async function setCredentials(url, key) {
  stopRealtime();
  client = null;
  backend = null;
  await setDevice({ supabaseUrl: url.trim(), supabaseAnonKey: key.trim() });
  await metaDB.delete('syncCursor');
  await initSync();
}

/**
 * Kalenderdatei im privaten Speicher ablegen und einen kurzlebigen Link liefern.
 * Safari öffnet solche Links mit „Zum Kalender hinzufügen“. Ohne Login: null.
 */
export async function publishIcs(name, text) {
  if (!backend || !client) return null;
  try {
    const uid = await backend.userId();
    const path = `${uid}/${name}.ics`;
    const bucket = client.storage.from('ics');
    const { error } = await bucket.upload(path, new Blob([text], { type: 'text/calendar' }), { upsert: true, contentType: 'text/calendar; charset=utf-8', cacheControl: '0' });
    if (error) return null;
    const { data } = await bucket.createSignedUrl(path, 600);
    return data?.signedUrl || null;
  } catch {
    return null;
  }
}
