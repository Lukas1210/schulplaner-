// App-Start: Daten laden, Hülle (Tab-Leiste, Seitenleiste, „+“) aufbauen, Router, Service Worker, Sync, Ferien.
import { loadStore, getDevice, subscribe } from './store.js';
import { route, startRouter, go, currentRoute, onRouteChange, refresh } from './router.js';
import { applyTheme } from './theme.js';
import { actionSheet, toast } from './ui/sheet.js';
import { icon } from './ui/icons.js';
import { html, debounce } from './ui/dom.js';
import { initSync } from './sync.js';
import { loadHolidays, refreshHolidays } from './holidays.js';
import { openTasks } from './model.js';
import { today, daysBetween } from './logic/dates.js';
import { TABS, MORE } from './nav.js';

const views = {
  today: () => import('./views/today.js'),
  calendar: () => import('./views/calendar.js'),
  tasks: () => import('./views/tasks.js'),
  learn: () => import('./views/learn.js'),
  grades: () => import('./views/grades.js'),
  subjectGrades: () => import('./views/subject-grades.js'),
  subjects: () => import('./views/subjects.js'),
  subject: () => import('./views/subject.js'),
  exam: () => import('./views/exam.js'),
  timetable: () => import('./views/timetable.js'),
  deck: () => import('./views/deck.js'),
  quiz: () => import('./views/quiz.js'),
  absences: () => import('./views/absences.js'),
  settings: () => import('./views/settings.js'),
};

route('/', views.today, { tab: 'today', root: true });
route('/calendar', views.calendar, { tab: 'calendar', root: true });
route('/tasks', views.tasks, { tab: 'tasks', root: true });
route('/learn', views.learn, { tab: 'learn', root: true });
route('/grades', views.grades, { tab: 'grades', root: true });
route('/grades/:id', views.subjectGrades, { tab: 'grades' });
route('/subjects', views.subjects, { tab: 'today', side: 'subjects' });
route('/subject/:id', views.subject, {});
route('/exam/:id', views.exam, { fab: false });
route('/timetable', views.timetable, { tab: 'today', side: 'timetable', fab: false });
route('/deck/:id', views.deck, { tab: 'learn' });
route('/quiz/:id', views.quiz, { tab: 'learn', fab: false });
route('/absences', views.absences, { tab: 'today', side: 'absences' });
route('/settings', views.settings, { tab: 'today', side: 'settings', fab: false });



/** Fällige Hausaufgaben (überfällig, heute, morgen) für die Badges. */
function dueCount() {
  const t = today();
  return openTasks().filter((x) => x.data.due && daysBetween(t, x.data.due) <= 1).length;
}

function paintBadges() {
  const n = dueCount();
  document.querySelectorAll('[data-badge="tasks"]').forEach((b) => {
    b.textContent = n > 99 ? '99+' : String(n);
    b.hidden = !n;
  });
}

function buildShell() {
  const tabbar = document.getElementById('tabbar');
  tabbar.innerHTML = String(html`${TABS.map((t) => html`<button class="tab" data-tab="${t.tab}" data-path="${t.path}" aria-label="${t.label}">${icon(t.icon)}<span>${t.label}</span>${t.tab === 'tasks' ? html`<i class="badge" data-badge="tasks" hidden></i>` : ''}</button>`)}`);

  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = String(html`
    <div class="side-head"><img src="assets/icons/icon-192.png" alt=""><b>Schulplaner</b></div>
    ${TABS.map((t) => html`<button class="side-item" data-side="${t.tab}" data-path="${t.path}">${icon(t.icon)}<span>${t.label}</span>${t.tab === 'tasks' ? html`<i class="badge" data-badge="tasks" hidden></i>` : ''}</button>`)}
    <div class="side-group">Mehr</div>
    ${MORE.map((m) => html`<button class="side-item" data-side="${m.side}" data-path="${m.path}">${icon(m.icon)}<span>${m.label}</span></button>`)}`);

  const onNav = (e) => {
    const b = e.target.closest('[data-path]');
    if (!b) return;
    const cur = currentRoute();
    const target = b.dataset.path;
    if (cur && cur.path === target) {
      document.getElementById('scroller').scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    go(target);
  };
  tabbar.addEventListener('click', onNav);
  sidebar.addEventListener('click', onNav);

  onRouteChange((r) => {
    if (r.route.tab) document.querySelectorAll('#tabbar .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === r.route.tab));
    if (r.route.side) document.querySelectorAll('#sidebar .side-item').forEach((t) => t.classList.toggle('active', t.dataset.side === r.route.side));
    document.getElementById('fab').classList.toggle('hide', !r.route.fab);
  });

  const fab = document.getElementById('fab');
  fab.innerHTML = String(icon('plus'));
  fab.addEventListener('click', () => {
    const cur = currentRoute();
    if (cur?.mod?.onFab) cur.mod.onFab();
    else openAddMenu();
  });

  paintBadges();
  subscribe(debounce(paintBadges, 200));
}

/** „+“-Menü mit allem, was man anlegen kann. */
export async function openAddMenu() {
  const items = [
    { label: 'Hausaufgabe', icon: 'tasks', color: 'var(--accent-ink)', value: 'task' },
    { label: 'Test', icon: 'learn', color: 'var(--accent2-ink)', value: 'exam' },
    { label: 'Note', icon: 'grades', color: 'var(--ok)', value: 'grade' },
    { label: 'Termin', icon: 'calendar', color: 'var(--accent-ink)', value: 'event' },
    { label: 'Lernziel', icon: 'target', color: 'var(--accent2-ink)', value: 'goal' },
    { label: 'Karteikarten', icon: 'cards', color: 'var(--warn-ink)', value: 'deck' },
    { label: 'Fehltag', icon: 'thermo', color: 'var(--danger)', value: 'absence' },
    { label: 'Fach', icon: 'book', color: 'var(--text2)', value: 'subject' },
  ];
  const v = await actionSheet({ title: 'Neu', items, layout: 'grid' });
  if (!v) return;
  const forms = {
    task: async () => (await import('./forms/task-form.js')).openTaskForm(),
    exam: async () => (await import('./forms/exam-form.js')).openExamForm(),
    goal: async () => (await import('./forms/exam-form.js')).openExamForm({ kind: 'goal' }),
    grade: async () => (await import('./forms/grade-form.js')).openGradeForm(),
    event: async () => (await import('./forms/event-form.js')).openEventForm(),
    deck: async () => (await import('./forms/deck-form.js')).openDeckForm(),
    absence: async () => (await import('./forms/absence-form.js')).openAbsenceForm(),
    subject: async () => (await import('./forms/subject-form.js')).openSubjectForm(),
  };
  await forms[v]?.();
}

function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const promptUpdate = (worker) => {
      toast('Neue Version verfügbar', { icon: 'sparkles', actionLabel: 'Aktualisieren', duration: 0, onAction: () => worker.postMessage('skipWaiting') });
    };
    if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(w);
      });
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch((e) => console.warn('SW', e));
  let reloading = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    location.reload();
  });
}

async function boot() {
  try {
    await loadStore();
    await loadHolidays();
  } catch (e) {
    document.getElementById('view').innerHTML = `<div class="empty"><span class="em-ico">${icon('info')}</span><h3>Speicher nicht verfügbar</h3><p>Bitte öffne die App nicht im privaten Modus.</p></div>`;
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('splash')?.remove();
    return;
  }
  applyTheme();
  // Datumsfelder: Tippen auf die ganze Zeile öffnet die Auswahl
  document.addEventListener('click', (e) => {
    if (e.target.closest('input, select, textarea, button, a')) return;
    const cell = e.target.closest('.cell');
    const inp = cell?.querySelector('input[type=date]:not(:disabled), input[type=time]:not(:disabled)');
    if (!inp || cell.querySelectorAll('input').length > 1) return;
    inp.focus();
    try { inp.showPicker?.(); } catch {}
  });
  buildShell();
  registerSW();
  const splash = document.getElementById('splash');
  if (splash) { splash.style.opacity = '0'; setTimeout(() => splash.remove(), 400); }
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

  if (!getDevice().onboarded) {
    const { runOnboarding } = await import('./views/onboarding.js');
    await runOnboarding();
  }
  document.getElementById('app').classList.remove('hidden');
  startRouter();
  initSync();
  refreshHolidays().catch(() => {});

  // Neuer Tag (App bleibt über Nacht offen): Ansicht auffrischen
  let day = today();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (today() !== day) { day = today(); refresh(); paintBadges(); }
    refreshHolidays().catch(() => {});
  });
}

boot();
