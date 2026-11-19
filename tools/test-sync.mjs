// Testet die Sync-Logik mit zwei simulierten Geräten (iPhone + iPad, je eigene IndexedDB)
// gegen ein Fake-Backend im Speicher – ganz ohne Supabase.
// Aufruf: node tools/test-sync.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = join(root, path);
    if (!file.startsWith(root)) throw new Error('forbidden');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end();
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/`;

// ---------- Fake-Backend (verhält sich wie die Supabase-Tabelle "items") ----------
const rows = new Map();
let clock = Date.now() * 1000;
const micros = (ts) => {
  const m = /^(.*?)(?:\.(\d+))?(Z|[+-]\d\d:\d\d)$/.exec(ts);
  const frac = (m[2] || '').padEnd(6, '0').slice(0, 6);
  return Date.parse(`${m[1]}${m[3]}`) * 1000 + Number(frac);
};
const fmt = (us) => `${new Date(Math.floor(us / 1000)).toISOString().slice(0, 19)}.${String(us % 1000000).padStart(6, '0')}+00:00`;
const backend = {
  push([list, uid]) {
    clock += 1000;
    const ts = fmt(clock); // alle Zeilen eines Aufrufs mit gleicher Zeit → testet Gleichstand beim Blättern
    return list.map((r) => { rows.set(r.id, { ...r, updated_at: ts, updated_by: uid }); return { id: r.id, updated_at: ts }; });
  },
  pull([afterTs, afterId, limit]) {
    const a = afterTs ? micros(afterTs) : null;
    return [...rows.values()]
      .sort((x, y) => micros(x.updated_at) - micros(y.updated_at) || x.id.localeCompare(y.id))
      .filter((r) => {
        if (a == null) return true;
        const u = micros(r.updated_at);
        return afterId ? u > a || (u === a && r.id > afterId) : u > a;
      })
      .slice(0, limit);
  },
};

// ---------- Geräte ----------
const browser = await chromium.launch();
async function device(name, viewport) {
  const ctx = await browser.newContext({ viewport });
  await ctx.exposeBinding('fakeBE', (_src, op, args) => backend[op](args));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[${name}]`, e.message));
  await page.goto(base);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.__be = {
      userId: async () => 'nutzerin',
      push: (list) => window.fakeBE('push', [list, 'nutzerin']),
      pull: (a, b, c) => window.fakeBE('pull', [a, b, c]),
    };
  });
  return {
    page,
    sync: () => page.evaluate(async () => (await import('./js/sync.js')).syncWith(window.__be)),
    run: (fn, arg) => page.evaluate(fn, arg),
  };
}

let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra !== '' ? ` (${extra})` : ''}`); if (!ok) failed++; };

const phone = await device('iPhone', { width: 393, height: 852 });
const pad = await device('iPad', { width: 820, height: 1180 });

// 1) iPhone legt Einstellungen, ein Fach, eine Stunde, eine Hausaufgabe und eine Note an
const ids = await phone.run(async () => {
  const S = await import('./js/store.js');
  await S.saveSettings({ name: 'Mia', state: 'BY', tendency: 0.3 });
  const m = await S.save('subject', { name: 'Mathe', short: 'M', color: '#2F5DA8', written: 50 });
  await S.save('lesson', { subjectId: m.id, day: 1, period: 1, room: '204', week: 'all' });
  const t = await S.save('task', { subjectId: m.id, text: 'S. 84 Nr. 3', due: '2026-11-20', done: false });
  const g = await S.save('grade', { subjectId: m.id, value: 2.3, label: '2−', kind: 'ka', cat: 'written', weight: 1, date: '2026-10-07' });
  return { subject: m.id, task: t.id, grade: g.id };
});
let r = await phone.sync();
check('iPhone lädt 5 Einträge hoch', r.pushed === 5, r.pushed);

// 2) iPad holt alles
r = await pad.sync();
const padState = await pad.run(async (ids) => {
  const S = await import('./js/store.js');
  return { name: S.settings().name, tendency: S.settings().tendency, subject: S.get(ids.subject)?.data.name, lessons: S.all('lesson').length, task: S.get(ids.task)?.data.text, grade: S.get(ids.grade)?.data.label };
}, ids);
check('iPad erhält Einstellungen', padState.name === 'Mia' && padState.tendency === 0.3, JSON.stringify(padState));
check('iPad erhält Fach, Stunde, Hausaufgabe und Note', padState.subject === 'Mathe' && padState.lessons === 1 && padState.task === 'S. 84 Nr. 3' && padState.grade === '2−', JSON.stringify(padState));
check('iPad meldet 5 neue Einträge', r.received === 5, r.received);

// 3) iPad hakt die Hausaufgabe ab, iPhone sieht es
await pad.run(async (id) => { const S = await import('./js/store.js'); await S.update(id, { done: true }); }, ids.task);
await pad.sync();
await phone.sync();
check('Abhaken kommt auf dem iPhone an', await phone.run(async (id) => (await import('./js/store.js')).get(id)?.data.done === true, ids.task));

// 4) Löschen auf dem iPhone kommt auf dem iPad an
await phone.run(async (id) => { const S = await import('./js/store.js'); await S.remove(id); }, ids.grade);
await phone.sync();
await pad.sync();
check('Löschen kommt auf dem iPad an', await pad.run(async (id) => (await import('./js/store.js')).get(id) === null, ids.grade));

// 5) Konflikt: beide ändern das Fach offline – die spätere Änderung gewinnt auf beiden Geräten
await phone.run(async (id) => { const S = await import('./js/store.js'); await S.update(id, { room: '101' }); }, ids.subject);
await new Promise((res) => setTimeout(res, 30));
await pad.run(async (id) => { const S = await import('./js/store.js'); await S.update(id, { room: '305' }); }, ids.subject);
await phone.sync();
await pad.sync();
await phone.sync();
const rooms = [
  await phone.run(async (id) => (await import('./js/store.js')).get(id)?.data.room, ids.subject),
  await pad.run(async (id) => (await import('./js/store.js')).get(id)?.data.room, ids.subject),
];
check('Spätere Änderung gewinnt auf beiden Geräten', rooms[0] === '305' && rooms[1] === '305', rooms.join(' / '));

// 6) Viele Einträge (Karteikarten) werden seitenweise übertragen
await phone.run(async () => {
  const S = await import('./js/store.js');
  const deck = await S.save('deck', { name: 'Vokabeln', subjectId: null });
  await S.saveMany(Array.from({ length: 650 }, (_, i) => ({ type: 'card', data: { deckId: deck.id, front: `w${i}`, back: `b${i}`, box: 1, due: null } })));
});
r = await phone.sync();
check('650 Karten in Paketen hochgeladen', r.pushed === 651, r.pushed);
await pad.sync();
check('iPad erhält alle Karten (über mehrere Seiten)', (await pad.run(async () => (await import('./js/store.js')).all('card').length)) === 650);

// 7) Ohne Änderungen: nichts doppelt
r = await pad.sync();
check('Zweiter Durchlauf ohne Änderungen bleibt still', r.pushed === 0 && r.received === 0, JSON.stringify(r));

// 8) Nicht angemeldet → Fehler mit Code
const err = await pad.run(async () => {
  try { await (await import('./js/sync.js')).syncWith({ userId: async () => null }); return null; } catch (e) { return e.code; }
});
check('Ohne Anmeldung gibt es einen klaren Fehler', err === 'auth', err);

await browser.close();
server.close();
console.log(`\n${failed ? '✗' : '✓'} Sync-Tests ${failed ? `mit ${failed} Fehlern` : 'bestanden'}`);
process.exit(failed ? 1 : 0);
