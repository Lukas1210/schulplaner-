// Service Worker: macht die App offline-fähig und schnell.
// __BUILD__ wird beim Veröffentlichen durch die Commit-ID ersetzt, damit Updates erkannt werden.
const BUILD = '__BUILD__';
const CACHE = `sp-${BUILD}`;

// App-Hülle: wird bei der Installation vollständig geladen (Liste: node tools/update-sw.mjs)
const CORE = [
  './',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon.svg',
  'config.js',
  'css/app.css',
  'css/palettes.css',
  'index.html',
  'js/db.js',
  'js/forms/absence-form.js',
  'js/forms/deck-form.js',
  'js/forms/event-form.js',
  'js/forms/exam-form.js',
  'js/forms/grade-form.js',
  'js/forms/kit.js',
  'js/forms/subject-form.js',
  'js/forms/task-form.js',
  'js/grades-data.js',
  'js/holidays.js',
  'js/ics.js',
  'js/logic/cards.js',
  'js/logic/colors.js',
  'js/logic/dates.js',
  'js/logic/grades.js',
  'js/logic/holidays.js',
  'js/logic/ics.js',
  'js/logic/plan.js',
  'js/logic/timetable.js',
  'js/main.js',
  'js/model.js',
  'js/nav.js',
  'js/router.js',
  'js/store.js',
  'js/sync.js',
  'js/theme.js',
  'js/ui/chart.js',
  'js/ui/components.js',
  'js/ui/dom.js',
  'js/ui/fx.js',
  'js/ui/icons.js',
  'js/ui/sheet.js',
  'js/ui/tt-grid.js',
  'js/views/absences.js',
  'js/views/calendar.js',
  'js/views/deck.js',
  'js/views/exam.js',
  'js/views/grades.js',
  'js/views/learn.js',
  'js/views/onboarding.js',
  'js/views/plan-rows.js',
  'js/views/quiz.js',
  'js/views/settings.js',
  'js/views/subject-grades.js',
  'js/views/subject.js',
  'js/views/subjects.js',
  'js/views/task-row.js',
  'js/views/tasks.js',
  'js/views/timetable.js',
  'js/views/today.js',
  'js/views/topic-sheet.js',
  'manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Nur eigene, alte Caches löschen (Präfix "sp-")
    await Promise.all(keys.filter((k) => k.startsWith('sp-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, Ferien-API: immer direkt ins Netz
  const scope = new URL(self.registration.scope);
  if (!url.pathname.startsWith(scope.pathname)) return; // fremde Seiten auf derselben Domain

  // Seitenaufrufe: App-Hülle aus dem Cache
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match('./')) || (await cache.match('index.html')) || fetch(req);
    })());
    return;
  }

  // config.js: Netz zuerst (damit neue Zugangsdaten greifen), offline aus dem Cache
  if (url.pathname.endsWith('/config.js')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req, { cache: 'no-store' });
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req)) || Response.error();
      }
    })());
    return;
  }

  // Alles andere: Cache zuerst, sonst laden und für später merken
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  })());
});
