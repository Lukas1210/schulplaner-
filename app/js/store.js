// Datenhaltung: alle Einträge liegen im Speicher (Map) und in IndexedDB („offline first“).
// Jede lokale Änderung wird als "dirty" markiert und vom Sync später hochgeladen.
import { itemsDB, metaDB } from './db.js';

const items = new Map();
const listeners = new Set();
let device = { onboarded: false };

export const uuid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  }));

/** Kurze ID für Unterpunkte innerhalb eines Eintrags (z. B. Themen eines Tests). */
export const shortId = () => Math.random().toString(36).slice(2, 10);

export async function loadStore() {
  const list = await itemsDB.all();
  items.clear();
  list.forEach((it) => items.set(it.id, it));
  device = { ...device, ...(await metaDB.get('device', {})) };
}

// ---------- Geräte-Einstellungen (nicht synchronisiert) ----------
export const getDevice = () => device;
export async function setDevice(patch) {
  device = { ...device, ...patch };
  await metaDB.set('device', device);
  emit({ ids: [], types: ['device'], source: 'local' });
}

// ---------- Ereignisse ----------
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function emit(evt) {
  listeners.forEach((fn) => {
    try { fn(evt); } catch (e) { console.error(e); }
  });
}

// ---------- Lesen ----------
export const get = (id) => {
  const it = items.get(id);
  return it && !it.deleted ? it : null;
};

export function all(type) {
  const out = [];
  for (const it of items.values()) {
    if (!it.deleted && (!type || it.type === type)) out.push(it);
  }
  return out;
}

export const allRaw = () => Array.from(items.values());

// ---------- Schreiben ----------
export async function save(type, data, { id } = {}) {
  const now = new Date().toISOString();
  const existing = id ? items.get(id) : null;
  const item = existing
    ? { ...existing, data: { ...data }, updatedAt: now, dirty: 1, deleted: false }
    : { id: id || uuid(), type, data: { ...data }, createdAt: now, updatedAt: now, deleted: false, dirty: 1 };
  items.set(item.id, item);
  await itemsDB.put(item);
  emit({ ids: [item.id], types: [type], source: 'local' });
  return item;
}

export async function update(id, patch) {
  const it = items.get(id);
  if (!it) throw new Error('Eintrag nicht gefunden');
  return save(it.type, { ...it.data, ...patch }, { id });
}

/** Mehrere Einträge auf einmal speichern: [{ type, data, id? }]. */
export async function saveMany(list) {
  if (!list.length) return [];
  const now = new Date().toISOString();
  const out = list.map(({ type, data, id }) => {
    const existing = id ? items.get(id) : null;
    return existing
      ? { ...existing, data: { ...data }, updatedAt: now, dirty: 1, deleted: false }
      : { id: id || uuid(), type, data: { ...data }, createdAt: now, updatedAt: now, deleted: false, dirty: 1 };
  });
  out.forEach((it) => items.set(it.id, it));
  await itemsDB.putMany(out);
  emit({ ids: out.map((i) => i.id), types: [...new Set(out.map((i) => i.type))], source: 'local' });
  return out;
}

export async function remove(id) {
  return removeMany([id]);
}

/** Löschen = als gelöscht markieren, damit der Sync es weitergibt. */
export async function removeMany(ids) {
  const now = new Date().toISOString();
  const out = [];
  for (const id of ids) {
    const it = items.get(id);
    if (!it || it.deleted) continue;
    const next = { ...it, deleted: true, updatedAt: now, dirty: 1 };
    items.set(id, next);
    out.push(next);
  }
  if (!out.length) return;
  await itemsDB.putMany(out);
  emit({ ids: out.map((i) => i.id), types: [...new Set(out.map((i) => i.type))], source: 'local' });
}

// ---------- Für den Sync ----------
export const dirtyItems = () => allRaw().filter((it) => it.dirty);

export async function markClean(ids, serverTimes = {}) {
  const changed = [];
  for (const id of ids) {
    const it = items.get(id);
    if (!it) continue;
    const next = { ...it, dirty: 0 };
    if (serverTimes[id]) next.serverUpdatedAt = serverTimes[id];
    items.set(id, next);
    changed.push(next);
  }
  if (changed.length) await itemsDB.putMany(changed);
}

/** Änderungen vom Server übernehmen. Lokale, neuere und noch nicht hochgeladene Änderungen bleiben erhalten. */
export async function applyRemote(remoteItems) {
  const changed = [];
  for (const r of remoteItems) {
    const local = items.get(r.id);
    if (local && local.dirty && new Date(local.updatedAt) > new Date(r.updatedAt)) continue;
    if (local && !local.dirty && r.serverUpdatedAt && local.serverUpdatedAt === r.serverUpdatedAt) continue;
    const next = { ...r, dirty: 0 };
    items.set(r.id, next);
    changed.push(next);
  }
  if (changed.length) {
    await itemsDB.putMany(changed);
    emit({ ids: changed.map((i) => i.id), types: [...new Set(changed.map((i) => i.type))], source: 'remote', items: changed });
  }
  return changed;
}

/** Backup-Import: Einträge übernehmen (gleiche IDs werden überschrieben, andere bleiben). */
export async function importItems(list) {
  const now = new Date().toISOString();
  const out = list.filter((it) => it && it.id && it.type).map((it) => ({ ...it, updatedAt: now, dirty: 1 }));
  out.forEach((it) => items.set(it.id, it));
  await itemsDB.putMany(out);
  emit({ ids: out.map((i) => i.id), types: ['*'], source: 'local' });
  return out.length;
}

/** Alles als „dirty“ markieren (z. B. nach dem ersten Login mit vorhandenen lokalen Daten). */
export async function markAllDirty() {
  const list = allRaw().map((it) => ({ ...it, dirty: 1 }));
  list.forEach((it) => items.set(it.id, it));
  await itemsDB.putMany(list);
}

// ---------- Einstellungen (synchronisiert, feste ID) ----------
export const SETTINGS_ID = '00000000-0000-4000-8000-0000005c4001';

export const DEFAULT_SETTINGS = {
  name: '',
  klasse: '',
  state: '', // Bundesland-Kürzel, z. B. 'BY'
  tendency: 0.25, // Wert von + und −
  mainDouble: false, // Hauptfächer zählen im Gesamtschnitt doppelt
  yearStart: null, // Beginn des Schuljahres (YYYY-MM-DD)
  halfStart: null, // Beginn des 2. Halbjahres
  periods: null, // Stundenzeiten [{ start, end }] – null = Standard
  days: 5, // 5 = Mo–Fr, 6 = Mo–Sa
  abWeeks: false,
  abRef: null, // Montag einer A-Woche
  pensum: 'normal', // locker | normal | viel
  reminder: 'eve', // eve (Vortag 18 Uhr) | 2d | 1w | none
  excuseDays: 3, // Frist für Entschuldigungen in Schultagen
};

export function settings() {
  const it = items.get(SETTINGS_ID);
  const d = it && !it.deleted ? it.data : {};
  return { ...DEFAULT_SETTINGS, ...d };
}

export async function saveSettings(patch) {
  return save('settings', { ...settings(), ...patch }, { id: SETTINGS_ID });
}
