// Gemeinsame Helfer für die End-to-End-Tests: Mini-Server, Browser im iPhone-/iPad-Format,
// feste Uhrzeit, gemockte Ferien-API, Onboarding und Beispieldaten.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..', 'app');
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8', '.ics': 'text/calendar',
};

/** Statischer Server für app/ auf einem freien Port. */
function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    srv.listen(0, () => resolve({ url: `http://localhost:${srv.address().port}/`, close: () => new Promise((r) => srv.close(r)) }));
  });
}

function makeChecker(name) {
  const st = { name, passed: 0, failed: 0, failures: [] };
  st.check = (label, ok, extra = '') => {
    console.log(`  ${ok ? '✓' : '✗'} ${label}${!ok && extra !== '' ? ` (${extra})` : ''}`);
    if (ok) st.passed++; else { st.failed++; st.failures.push(label); }
  };
  return st;
}

// Beispiel-Antworten der OpenHolidays API (Bayern, nur für Tests)
const name = (t) => [{ language: 'DE', text: t }];
const BY = [{ code: 'DE-BY', shortName: 'BY' }];
const HOLIDAYS = {
  school: [
    { id: 's1', startDate: '2026-11-18', endDate: '2026-11-18', type: 'School', name: name('Buß- und Bettag'), nationwide: false, subdivisions: BY },
    { id: 's2', startDate: '2026-12-23', endDate: '2027-01-08', type: 'School', name: name('Weihnachtsferien'), nationwide: false, subdivisions: BY },
    { id: 's3', startDate: '2027-02-15', endDate: '2027-02-19', type: 'School', name: name('Winterferien'), nationwide: false, subdivisions: BY },
    { id: 's4', startDate: '2027-03-22', endDate: '2027-04-02', type: 'School', name: name('Osterferien'), nationwide: false, subdivisions: BY },
  ],
  public: [
    { id: 'p1', startDate: '2026-12-25', endDate: '2026-12-25', type: 'Public', name: name('1. Weihnachtstag'), nationwide: true },
    { id: 'p2', startDate: '2027-01-01', endDate: '2027-01-01', type: 'Public', name: name('Neujahr'), nationwide: true },
  ],
};

const DEVICES = {
  phone: { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true },
  ipad: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true },
  'ipad-land': { viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true },
  'ipad-pro': { viewport: { width: 1024, height: 1366 }, isMobile: true, hasTouch: true },
};

/**
 * Browser + Seite öffnen. time: feste Uhrzeit (Standard Do, 19.11.2026, 9:00 Uhr in Berlin).
 */
async function openApp(server, { scheme = 'light', device = 'phone', dpr = 1, time = '2026-11-19T09:00:00+01:00', holidays = true, hash = '' } = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    colorScheme: scheme, deviceScaleFactor: dpr, locale: 'de-DE', timezoneId: 'Europe/Berlin', acceptDownloads: true,
    ...DEVICES[device],
  });
  ctx.holidayRequests = 0;
  await ctx.route('**/openholidaysapi.org/**', (route) => {
    ctx.holidayRequests++;
    if (!holidays) return route.abort();
    const url = route.request().url();
    return route.fulfill({ json: url.includes('SchoolHolidays') ? HOLIDAYS.school : HOLIDAYS.public });
  });
  const p = await ctx.newPage();
  if (time) await p.clock.setFixedTime(new Date(time));
  const errors = [];
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
  await p.goto(server.url + (hash ? `#${hash}` : ''));
  await p.waitForSelector('.onb .step, #view > *', { timeout: 15000 });
  fs.mkdirSync(SHOTS, { recursive: true });
  const app = {
    browser, ctx, p, errors,
    S: (fn, arg) => p.evaluate(fn, arg),
    go: async (hash, wait = 600) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(wait); },
    shot: (n) => p.screenshot({ path: path.join(SHOTS, `${n}.png`) }),
    calm: () => p.evaluate(() => document.querySelectorAll('#toasts .toast, .fx-confetti, .fx-spark, .fx-ring').forEach((n) => n.remove())),
    text: (sel) => p.locator(sel).first().innerText(),
    count: (sel) => p.locator(sel).count(),
    /** Prüft, dass nichts waagerecht über den Rand ragt. */
    overflowX: () => p.evaluate(() => {
      const sc = document.getElementById('scroller');
      return sc.scrollWidth - sc.clientWidth;
    }),
    sheetClosed: () => p.waitForFunction(() => !document.querySelector('.sheet.show'), null, { timeout: 5000 }),
    close: () => browser.close(),
  };
  return app;
}

/** Onboarding durchklicken. */
async function onboard(app, { name = 'Mia', klasse = '9b', state = 'BY', subjects = ['Deutsch', 'Mathe', 'Englisch', 'Biologie', 'Geschichte'], later = true } = {}) {
  const { p } = app;
  await p.click('[data-go="profile"]');
  await p.fill('#o-name', name);
  await p.fill('#o-klasse', klasse);
  await p.selectOption('#o-state', state);
  await p.click('[data-go="subjects"]');
  // Standard sind Deutsch, Mathe, Englisch – Rest antippen
  for (const s of subjects) {
    const on = await p.locator(`[data-subj="${s}"]`).getAttribute('aria-pressed');
    if (on !== 'true') await p.click(`[data-subj="${s}"]`);
  }
  for (const d of ['Deutsch', 'Mathe', 'Englisch']) if (!subjects.includes(d)) await p.click(`[data-subj="${d}"]`);
  await p.click('[data-go="tendency"]');
  await p.click('[data-go="timetable"]');
  await p.click(later ? '[data-go="done"]' : '[data-go="done-tt"]');
  await p.waitForSelector('#view > *');
  await p.waitForTimeout(700);
}

/** Realistische Beispieldaten über den Store anlegen (nach dem Onboarding). */
async function seed(app) {
  await app.p.evaluate(async () => {
    const S = await import('./js/store.js');
    const sub = Object.fromEntries(S.all('subject').map((s) => [s.data.name, s.id]));
    const add = (type, data) => S.save(type, data);
    const extra = [
      { name: 'Französisch', short: 'F', color: '#7048A8', main: true },
      { name: 'Chemie', short: 'Ch', color: '#00796B' },
      { name: 'Sport', short: 'Spo', color: '#B4532A' },
      { name: 'Kunst', short: 'Ku', color: '#8E3F7A' },
    ];
    let order = Object.keys(sub).length;
    for (const x of extra) if (!sub[x.name]) sub[x.name] = (await add('subject', { ...x, written: 50, teacher: '', room: '', target: null, order: order++ })).id;
    await S.update(sub.Mathe, { teacher: 'Hr. Berger', room: '204', target: 2 });
    await S.update(sub.Deutsch, { teacher: 'Fr. Kaya', room: '112' });
    await S.update(sub.Englisch, { teacher: 'Ms. Clarke', room: '118', written: 200 / 3 });
    // Stundenplan Mo–Fr
    const plan = {
      1: ['Mathe', 'Mathe', 'Deutsch', 'Englisch', 'Biologie', 'Biologie'],
      2: ['Englisch', 'Deutsch', 'Französisch', 'Französisch', 'Geschichte', 'Sport'],
      3: ['Deutsch', 'Mathe', 'Chemie', 'Chemie', 'Kunst', 'Kunst'],
      4: ['Französisch', 'Mathe', 'Englisch', 'Deutsch', 'Sport', 'Sport'],
      5: ['Mathe', 'Geschichte', 'Englisch', 'Biologie', 'Französisch'],
    };
    const lessons = [];
    for (const [day, list] of Object.entries(plan)) list.forEach((n, i) => lessons.push({ type: 'lesson', data: { subjectId: sub[n], day: +day, period: i + 1, room: '', week: 'all' } }));
    await S.saveMany(lessons);
    const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); const z = (v) => String(v).padStart(2, '0'); return `${x.getFullYear()}-${z(x.getMonth() + 1)}-${z(x.getDate())}`; };
    // Hausaufgaben
    await add('task', { subjectId: sub.Mathe, text: 'S. 84 Nr. 3 a–d', due: d(1), done: false, note: '' });
    await add('task', { subjectId: sub.Englisch, text: 'Vokabeln Unit 4 lernen', due: d(0), done: false, note: '' });
    await add('task', { subjectId: sub.Deutsch, text: 'Erörterung: Gliederung', due: d(5), done: false, note: '' });
    await add('task', { subjectId: sub.Biologie, text: 'Arbeitsblatt Zellteilung', due: d(-1), done: false, note: '' });
    await add('task', { subjectId: sub.Geschichte, text: 'Referat vorbereiten', due: d(8), done: false, note: '' });
    await add('task', { subjectId: sub.Mathe, text: 'Formelsammlung kaufen', due: d(-3), done: true, doneAt: new Date().toISOString(), note: '' });
    // Tests mit Lernstoff
    const T = (text, level, studied = []) => ({ id: Math.random().toString(36).slice(2, 10), text, level, studied });
    await add('exam', { subjectId: sub.Mathe, kind: 'ka', title: 'Quadratische Funktionen', date: d(4), period: 1, notes: 'Taschenrechner und Geodreieck mitbringen', topics: [T('Scheitelpunktform', 0), T('Nullstellen mit der p-q-Formel', 0), T('Parabeln verschieben', 1), T('Textaufgaben', 0), T('Normalparabel zeichnen', 2)], gradeId: null });
    await add('exam', { subjectId: sub.Englisch, kind: 'test', title: 'Unit 4', date: d(6), period: 3, notes: '', topics: [T('Vokabeln Unit 4', 1), T('Present perfect vs. simple past', 0), T('Reading comprehension', 2)], gradeId: null });
    await add('exam', { subjectId: sub.Biologie, kind: 'abfrage', title: 'Zellteilung', date: d(11), period: 4, notes: '', topics: [], gradeId: null });
    await add('exam', { subjectId: sub.Französisch, kind: 'goal', title: 'Unregelmäßige Verben', date: null, notes: '', topics: [T('être, avoir, aller', 1), T('faire, prendre', 0)], gradeId: null });
    // Noten
    const G = (s, value, label, kind, cat, date, title = '') => add('grade', { subjectId: sub[s], value, label, kind, cat, weight: 1, date, title, examId: null });
    await G('Mathe', 2.25, '2−', 'ka', 'written', '2026-10-07', 'Lineare Funktionen');
    await G('Mathe', 3, '3', 'test', 'oral', '2026-09-24');
    await G('Mathe', 2, '2', 'oral', 'oral', '2026-10-20');
    await G('Deutsch', 2, '2', 'ka', 'written', '2026-10-14', 'Inhaltsangabe');
    await G('Deutsch', 1.75, '2+', 'oral', 'oral', '2026-11-04');
    await G('Englisch', 1.75, '2+', 'ka', 'written', '2026-10-01');
    await G('Englisch', 2.25, '2−', 'oral', 'oral', '2026-11-10');
    await G('Biologie', 3.25, '3−', 'abfrage', 'oral', '2026-10-28');
    await G('Biologie', 2.75, '3+', 'oral', 'oral', '2026-11-12');
    await G('Geschichte', 1, '1', 'referat', 'oral', '2026-10-16');
    await G('Französisch', 2.5, '2–3', 'ka', 'written', '2026-10-21');
    await G('Französisch', 2, '2', 'oral', 'oral', '2026-11-06');
    // Termine
    await add('event', { title: 'Wandertag', kind: 'trip', date: d(13), endDate: null, allDay: true, time: null, endTime: null, notes: 'Wanderschuhe!' });
    await add('event', { title: 'Elternsprechtag', kind: 'parents', date: d(9), endDate: null, allDay: false, time: '16:00', endTime: '19:00', notes: '' });
    // Karteikarten
    const deck = await add('deck', { subjectId: sub.Englisch, name: 'Unit 4 Vocabulary' });
    const words = [['to achieve', 'erreichen'], ['reliable', 'zuverlässig'], ['to suggest', 'vorschlagen'], ['environment', 'Umwelt'], ['to improve', 'verbessern'], ['although', 'obwohl']];
    await S.saveMany(words.map(([front, back], i) => ({ type: 'card', data: { deckId: deck.id, front, back, box: i < 4 ? 1 : 3, due: i < 4 ? d(0) : d(3), last: null } })));
  });
  await app.p.waitForTimeout(600);
}

module.exports = { startServer, makeChecker, openApp, onboard, seed, ROOT, SHOTS, HOLIDAYS };
