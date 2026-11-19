// Kalender: Woche (Stundenplan mit Tests, Fälligkeiten, Ferien), Monat (Punkte + Tagesliste), Liste (nächste 8 Wochen).
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all } from '../store.js';
import { go } from '../router.js';
import { topbar, subjBadge, emptyState } from '../ui/components.js';
import { openSheet, actionSheet } from '../ui/sheet.js';
import { subjects, timetableCtx, examKind, eventKind } from '../model.js';
import { ttGrid } from '../ui/tt-grid.js';
import { lessonsOn, blocks, periodsOf, weekType, schoolDays, nextLessonDate } from '../logic/timetable.js';
import { holidaysInRange } from '../logic/holidays.js';
import {
  today, addDays, mondayOf, isoDow, isoWeek, fmtShort, fmtLong, fmtDay, fmtRange, firstOfMonth, addMonths, fmtMonthYear,
  WEEKDAYS_SHORT, minToTime, nowMin, daysBetween, parseDate,
} from '../logic/dates.js';

export const live = true;
const state = { mode: 'week', week: null, month: null, sel: null, lastQ: null };

const inRange = (from, to, iso) => from <= iso && iso <= (to || from);

/** Alles, was an einem Tag ansteht (ohne Stunden). */
function dayItems(iso, data) {
  return {
    exams: data.exams.filter((e) => e.data.date === iso),
    tasks: data.tasks.filter((x) => x.data.due === iso),
    events: data.events.filter((e) => inRange(e.data.date, e.data.endDate, iso)),
    absences: data.absences.filter((a) => inRange(a.data.from, a.data.to, iso)),
  };
}

function loadData() {
  return {
    exams: all('exam').filter((e) => e.data.date && e.data.kind !== 'goal'),
    tasks: all('task').filter((x) => !x.data.done && x.data.due),
    events: all('event'),
    absences: all('absence'),
  };
}

function examRow(e, subj, ctx) {
  const s = subj.get(e.data.subjectId);
  const per = e.data.period ? periodsOf(ctx.settings)[e.data.period - 1] : null;
  return html`<button class="ev-row" data-exam="${e.id}" style="--c:${s?.data.color || 'var(--accent2)'}"><span class="bar"></span><span class="when">${per ? html`${per.start}<small>${e.data.period}. Std.</small>` : 'ganztägig'}</span><span class="grow"><span class="t" style="display:block">${examKind(e.data.kind).label}${s ? ` · ${s.data.name}` : ''}</span><span class="m" style="display:block">${e.data.title || 'Test'}</span></span>${subjBadge(s, { size: 'sm' })}</button>`;
}

function eventRow(e) {
  const k = eventKind(e.data.kind);
  return html`<button class="ev-row ${e.data.kind === 'free' ? 'soft' : ''}" data-event="${e.id}" style="--c:var(--accent-ink)"><span class="bar"></span><span class="when">${e.data.allDay === false && e.data.time ? html`${e.data.time}<small>${e.data.endTime || ''}</small>` : 'ganztägig'}</span><span class="grow"><span class="t" style="display:block">${e.data.title}</span><span class="m" style="display:block">${k.label}${e.data.endDate && e.data.endDate !== e.data.date ? ` · bis ${fmtDay(e.data.endDate)}` : ''}</span></span>${icon(k.icon)}</button>`;
}

function holidayRow(h, label) {
  return html`<div class="ev-row soft" style="--c:var(--accent2)"><span class="bar"></span><span class="when">${label}</span><span class="grow"><span class="t" style="display:block">${h.name}</span><span class="m" style="display:block">${h.kind === 'public' ? 'Feiertag' : `Ferien · ${fmtRange(h.start, h.end)}`}</span></span>${icon('palm')}</div>`;
}

function itemRows(iso, data, subj, ctx, { withHoliday = true } = {}) {
  const it = dayItems(iso, data);
  const rows = [];
  const free = withHoliday ? ctx.freeInfo(iso) : null;
  if (free && free.kind !== 'free') rows.push(holidayRow(free, 'ganztägig'));
  for (const e of it.exams) rows.push(examRow(e, subj, ctx));
  for (const e of it.events) rows.push(eventRow(e));
  for (const x of it.tasks) {
    const s = subj.get(x.data.subjectId);
    rows.push(html`<button class="ev-row soft" data-task="${x.id}" style="--c:${s?.data.color || 'var(--text3)'}"><span class="bar"></span><span class="when">fällig</span><span class="grow"><span class="t" style="display:block">${x.data.text}</span><span class="m" style="display:block">Hausaufgabe${s ? ` · ${s.data.name}` : ''}</span></span></button>`);
  }
  for (const a of it.absences) rows.push(html`<button class="ev-row soft" data-go="/absences" style="--c:var(--danger)"><span class="bar"></span><span class="when">gefehlt</span><span class="grow"><span class="t" style="display:block">Fehltag</span><span class="m" style="display:block">${a.data.excuse === 'open' ? 'Entschuldigung offen' : 'eingetragen'}</span></span>${icon('thermo')}</button>`);
  return rows;
}

// ---------- Woche ----------
function weekView(ctx, subj, data) {
  const s = ctx.settings;
  const t = today();
  const mon = state.week;
  const nDays = schoolDays(s);
  const periods = periodsOf(s);
  const used = ctx.lessons.reduce((m, l) => Math.max(m, l.period || 0), 0);
  const rows = Math.min(periods.length, Math.max(6, used));
  const wt = weekType(mon, s);
  const m = nowMin();
  const days = Array.from({ length: nDays }, (_, i) => {
    const iso = addDays(mon, i);
    const free = ctx.freeInfo(iso);
    return { key: iso, title: WEEKDAYS_SHORT[i], sub: fmtShort(iso), today: iso === t, free };
  });
  const grid = ctx.lessons.length ? ttGrid({
    days,
    periods,
    rows,
    cells: (d) => blocks(lessonsOn(ctx.lessons, d.key, s), periods).map((b) => {
      const sb = subj.get(b.subjectId);
      const it = dayItems(d.key, data);
      const ex = it.exams.filter((e) => e.data.subjectId === b.subjectId);
      const hw = it.tasks.filter((x) => x.data.subjectId === b.subjectId);
      const now = d.key === t && b.start <= m && m < b.end;
      return {
        from: b.from, to: b.to,
        cls: `filled ${now ? 'now' : ''}`,
        style: `--c:${sb?.data.color || '#5A6B7B'}`,
        attrs: html`data-block="${d.key}:${b.from}:${b.to}:${b.subjectId}" aria-label="${sb?.data.name || 'Stunde'}, ${d.title} ${b.from}. Stunde${ex.length ? ', Test' : ''}${hw.length ? ', Hausaufgabe fällig' : ''}"`,
        content: html`<span class="tc-name"><span class="tc-short">${sb?.data.short || '?'}</span><span class="tc-long">${sb?.data.name || '?'}</span></span><span class="tc-room">${b.room || sb?.data.room || ''}</span>${ex.length || hw.length ? html`<span class="tc-marks">${ex.map((e) => html`<span class="tc-mark">${examKind(e.data.kind).short}</span>`)}${hw.length ? html`<span class="tc-mark hw">HA</span>` : ''}</span>` : ''}`,
      };
    }),
    label: `Woche ${isoWeek(mon)}`,
  }) : emptyState({ icon: 'grid', title: 'Noch kein Stundenplan', text: 'Trag deinen Stundenplan ein, dann siehst du hier jede Woche deine Stunden – mit Tests und Hausaufgaben.', action: html`<button class="btn primary" data-go="/timetable">${icon('grid')} Stundenplan eintragen</button>`, small: true });

  // Überblick der Woche (auch Wochenende)
  const list = [];
  for (let i = 0; i < 7; i++) {
    const iso = addDays(mon, i);
    const rowsHtml = itemRows(iso, data, subj, ctx, { withHoliday: i < nDays || !!dayItems(iso, data).events.length });
    if (!rowsHtml.length) continue;
    list.push(html`<div class="agenda-date ${iso === t ? 'today' : ''}">${fmtLong(iso)}</div><div class="list">${rowsHtml}</div>`);
  }
  return html`
    <div class="cal-head">
      <h2>KW ${isoWeek(mon)}<small>${fmtShort(mon)} – ${fmtShort(addDays(mon, nDays - 1))}${wt ? ` · ${wt}-Woche` : ''}</small></h2>
      <div class="cal-nav">
        <button class="today-btn" data-act="today">Heute</button>
        <button class="icon-btn" data-act="prev" aria-label="Vorherige Woche">${icon('back')}</button>
        <button class="icon-btn" data-act="next" aria-label="Nächste Woche">${icon('chevron')}</button>
      </div>
    </div>
    <div id="swipe">${grid}</div>
    <div class="section" style="margin-top:18px">${list.length ? list : html`<p class="muted" style="margin:0 4px">Keine Tests, Termine oder Abgaben in dieser Woche.</p>`}</div>`;
}

// ---------- Monat ----------
function monthView(ctx, subj, data) {
  const t = today();
  const m = state.month;
  const first = parseDate(m);
  const gridStart = addDays(m, -((first.getDay() + 6) % 7));
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((((first.getDay() + 6) % 7) + lastDay) / 7) * 7;
  const days = [];
  for (let i = 0; i < cells; i++) {
    const iso = addDays(gridStart, i);
    const it = dayItems(iso, data);
    const free = ctx.freeInfo(iso);
    const prevFree = ctx.freeInfo(addDays(iso, -1));
    const nextFree = ctx.freeInfo(addDays(iso, 1));
    const dots = [];
    if (it.exams.length) dots.push('var(--accent2)');
    if (it.events.some((e) => e.data.kind !== 'free')) dots.push('var(--accent-ink)');
    if (it.tasks.length) dots.push('var(--text3)');
    const cls = [
      iso.slice(0, 7) !== m.slice(0, 7) ? 'other' : '',
      iso === t ? 'today' : '',
      iso === state.sel ? 'sel' : '',
      isoDow(iso) >= 6 ? 'weekend' : '',
      free ? 'free' : '',
      free && (!prevFree || i % 7 === 0) ? 'free-start' : '',
      free && (!nextFree || i % 7 === 6) ? 'free-end' : '',
    ].join(' ');
    days.push(html`<button class="cal-day ${cls}" data-day="${iso}" aria-label="${fmtLong(iso)}${free ? `, ${free.name}` : ''}${it.exams.length ? ', Test' : ''}"><span class="n">${parseDate(iso).getDate()}</span><span class="dots">${dots.map((c) => html`<i style="background:${c}"></i>`)}</span></button>`);
  }
  const sel = state.sel;
  const dayLessons = ctx.isFree(sel) ? [] : blocks(lessonsOn(ctx.lessons, sel, ctx.settings), periodsOf(ctx.settings));
  const rows = itemRows(sel, data, subj, ctx);
  const n = daysBetween(t, sel);
  const rel = n === 0 ? 'Heute' : n === 1 ? 'Morgen' : n === -1 ? 'Gestern' : '';
  return html`
    <div class="cal-head">
      <h2>${fmtMonthYear(m)}</h2>
      <div class="cal-nav">
        <button class="today-btn" data-act="today">Heute</button>
        <button class="icon-btn" data-act="prev" aria-label="Vorheriger Monat">${icon('back')}</button>
        <button class="icon-btn" data-act="next" aria-label="Nächster Monat">${icon('chevron')}</button>
      </div>
    </div>
    <div class="card cal-card" id="swipe">
      <div class="cal-week">${WEEKDAYS_SHORT.map((w) => html`<span>${w}</span>`)}</div>
      <div class="cal-grid">${days}</div>
    </div>
    <div class="cal-legend"><span><i style="background:var(--accent2)"></i>Test</span><span><i style="background:var(--accent-ink)"></i>Termin</span><span><i style="background:var(--text3)"></i>Hausaufgabe fällig</span><span><i style="background:var(--accent-soft);border-radius:2px"></i>frei</span></div>
    <div class="day-title"><span>${rel ? `${rel}, ` : ''}${fmtLong(sel)}</span>${dayLessons.length ? html`<small>${dayLessons.length} ${dayLessons.length === 1 ? 'Block' : 'Blöcke'}</small>` : ''}</div>
    ${dayLessons.length ? html`<div class="chips wrap" style="margin-bottom:10px">${dayLessons.map((b) => { const sb = subj.get(b.subjectId); return html`<button class="chip" data-block="${sel}:${b.from}:${b.to}:${b.subjectId}"><span class="subj-dot" style="--c:${sb?.data.color || '#5A6B7B'}"></span>${minToTime(b.start)} ${sb?.data.short || ''}</button>`; })}</div>` : ''}
    <div class="list">${rows.length ? rows : html`<button class="ev-row soft" data-act="add-day" style="justify-content:center;color:var(--accent-ink);font-weight:600">${icon('calendarPlus')}&nbsp;Für ${fmtDay(sel)} etwas eintragen</button>`}</div>`;
}

// ---------- Liste ----------
function listView(ctx, subj, data) {
  const t = today();
  const end = addDays(t, 56);
  const out = [];
  const holidays = holidaysInRange(ctx.holidays, t, end);
  for (let d = t; d <= end; d = addDays(d, 1)) {
    const rows = [];
    for (const h of holidays.filter((x) => x.start === d || (d === t && x.start < t))) rows.push(holidayRow(h, h.kind === 'school' ? `${daysBetween(h.start, h.end) + 1} Tage` : 'ganztägig'));
    for (const e of data.exams.filter((x) => x.data.date === d)) rows.push(examRow(e, subj, ctx));
    for (const e of data.events.filter((x) => x.data.date === d || (d === t && x.data.date < t && (x.data.endDate || '') >= t))) rows.push(eventRow(e));
    if (rows.length) out.push(html`<div class="agenda-date ${d === t ? 'today' : ''}">${d === t ? 'Heute' : fmtLong(d)}</div><div class="list">${rows}</div>`);
  }
  const hasExams = data.exams.some((e) => e.data.date >= t);
  const head = hasExams ? html`<button class="btn block ghost small" data-act="ics-all" style="margin-bottom:6px">${icon('calendarPlus')} Alle anstehenden Tests in den iPhone-Kalender</button>` : '';
  return out.length ? html`${head}${out}` : emptyState({ icon: 'calendar', title: 'Nichts geplant', text: 'In den nächsten 8 Wochen stehen keine Tests, Termine oder Ferien an.' });
}

function paint(el) {
  const ctx = timetableCtx();
  const subj = new Map(subjects({ archived: true }).map((x) => [x.id, x]));
  const data = loadData();
  el.innerHTML = String(html`
    ${topbar({ title: 'Kalender' })}
    <div class="page">
      <h1 class="large-title">Kalender</h1>
      <div class="seg" style="margin:10px 0 14px">${[['week', 'Woche'], ['month', 'Monat'], ['list', 'Liste']].map(([k, l]) => html`<button class="${state.mode === k ? 'active' : ''}" data-mode="${k}">${l}</button>`)}</div>
      ${state.mode === 'week' ? weekView(ctx, subj, data) : state.mode === 'month' ? monthView(ctx, subj, data) : listView(ctx, subj, data)}
    </div>`);
}

function defaultWeek() {
  const t = today();
  return isoDow(t) >= 6 ? addDays(mondayOf(t), 7) : mondayOf(t);
}

/** Was soll an diesem Tag eingetragen werden? */
async function addForDay(date) {
  const v = await actionSheet({ title: fmtLong(date), items: [
    { label: 'Test', icon: 'learn', value: 'exam' },
    { label: 'Termin', icon: 'calendar', value: 'event' },
    { label: 'Hausaufgabe fällig', icon: 'tasks', value: 'task' },
    { label: 'Unterrichtsfrei', icon: 'palm', value: 'free' },
  ] });
  if (v === 'exam') (await import('../forms/exam-form.js')).openExamForm({ date });
  if (v === 'event') (await import('../forms/event-form.js')).openEventForm({ date });
  if (v === 'free') (await import('../forms/event-form.js')).openEventForm({ date, kind: 'free' });
  if (v === 'task') (await import('../forms/task-form.js')).openTaskForm({ due: date });
}

export function onFab() {
  addForDay(state.mode === 'month' && state.sel ? state.sel : today());
}

/** Sheet zu einer Stunde: Infos und schnelles Eintragen. */
function openBlockSheet(iso, from, to, subjectId) {
  const ctx = timetableCtx();
  const s = subjects({ archived: true }).find((x) => x.id === subjectId);
  const periods = periodsOf(ctx.settings);
  const time = `${periods[from - 1]?.start || ''} – ${periods[to - 1]?.end || ''}`;
  const data = loadData();
  const it = dayItems(iso, data);
  const ex = it.exams.filter((e) => e.data.subjectId === subjectId);
  const hw = it.tasks.filter((x) => x.data.subjectId === subjectId);
  const lesson = ctx.lessons.find((l) => l.subjectId === subjectId && l.period === from && l.day === isoDow(iso));
  const sheet = openSheet({
    title: s?.data.name || 'Stunde',
    body: html`
      <div class="detail-head">${subjBadge(s, { size: 'lg' })}<div class="grow"><h1 style="font-size:22px">${s?.data.name || 'Stunde'}</h1><div class="dh-sub">${fmtDay(iso)} · ${from === to ? `${from}.` : `${from}.–${to}.`} Stunde · ${time}</div></div></div>
      <div class="group" style="margin:14px 0">
        ${lesson?.room || s?.data.room ? html`<div class="cell">${icon('pin')}<span class="grow">Raum ${lesson?.room || s?.data.room}</span></div>` : ''}
        ${s?.data.teacher ? html`<div class="cell">${icon('user')}<span class="grow">${s.data.teacher}</span></div>` : ''}
        ${ex.map((e) => html`<button class="cell link" data-exam="${e.id}">${icon('learn')}<span class="grow">${examKind(e.data.kind).label}${e.data.title ? `: ${e.data.title}` : ''}</span><span class="chev">${icon('chevron')}</span></button>`)}
        ${hw.map((x) => html`<button class="cell link" data-task="${x.id}">${icon('tasks')}<span class="grow">Fällig: ${x.data.text}</span><span class="chev">${icon('chevron')}</span></button>`)}
      </div>
      <div class="list">
        <button class="btn block ghost" data-x="task">${icon('tasks')} Hausaufgabe aus dieser Stunde</button>
        <button class="btn block ghost" data-x="exam">${icon('learn')} Test in dieser Stunde</button>
        <button class="btn block" data-x="subject">Zur Fach-Seite</button>
      </div>`,
  });
  sheet.body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-x], [data-exam], [data-task]');
    if (!b) return;
    sheet.close();
    if (b.dataset.exam) { go(`/exam/${b.dataset.exam}`); return; }
    if (b.dataset.task) { (await import('../forms/task-form.js')).openTaskForm({ id: b.dataset.task }); return; }
    if (b.dataset.x === 'task') (await import('../forms/task-form.js')).openTaskForm({ subjectId, due: nextLessonDate(subjectId, iso, ctx) });
    if (b.dataset.x === 'exam') (await import('../forms/exam-form.js')).openExamForm({ subjectId, date: iso, period: from });
    if (b.dataset.x === 'subject') go(`/subject/${subjectId}`);
  });
}

export function render(el, _p, query) {
  if (!state.week) state.week = defaultWeek();
  if (!state.sel) state.sel = today();
  if (!state.month) state.month = firstOfMonth(state.sel);
  if (query?.d && query.d !== state.lastQ) {
    state.lastQ = query.d;
    state.sel = query.d;
    state.week = mondayOf(query.d);
    state.month = firstOfMonth(query.d);
  }
  paint(el);

  const shift = (dir) => {
    if (state.mode === 'week') state.week = addDays(state.week, 7 * dir);
    else if (state.mode === 'month') {
      state.month = addMonths(state.month, dir);
      state.sel = state.month.slice(0, 7) === today().slice(0, 7) ? today() : state.month;
    }
    paint(el);
  };
  const onClick = async (e) => {
    const md = e.target.closest('[data-mode]');
    if (md) { state.mode = md.dataset.mode; paint(el); return; }
    const day = e.target.closest('[data-day]');
    if (day) {
      state.sel = day.dataset.day;
      if (state.sel.slice(0, 7) !== state.month.slice(0, 7)) state.month = firstOfMonth(state.sel);
      paint(el);
      return;
    }
    const bl = e.target.closest('[data-block]');
    if (bl) { const [iso, from, to, sid] = bl.dataset.block.split(':'); openBlockSheet(iso, +from, +to, sid); return; }
    const ex = e.target.closest('[data-exam]');
    if (ex) { go(`/exam/${ex.dataset.exam}`); return; }
    const ev = e.target.closest('[data-event]');
    if (ev) { (await import('../forms/event-form.js')).openEventForm({ id: ev.dataset.event }); return; }
    const tk = e.target.closest('[data-task]');
    if (tk) { (await import('../forms/task-form.js')).openTaskForm({ id: tk.dataset.task }); return; }
    const g = e.target.closest('[data-go]');
    if (g) { go(g.dataset.go); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'prev') shift(-1);
    if (a.dataset.act === 'next') shift(1);
    if (a.dataset.act === 'today') { state.week = defaultWeek(); state.sel = today(); state.month = firstOfMonth(today()); paint(el); }
    if (a.dataset.act === 'add-day') addForDay(state.sel);
    if (a.dataset.act === 'ics-all') (await import('../ics.js')).exportUpcomingExams();
  };
  // Wischen wechselt Woche/Monat
  let sx = null, sy = null;
  const onDown = (e) => { if (e.target.closest('#swipe')) { sx = e.clientX; sy = e.clientY; } };
  const onUp = (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shift(dx < 0 ? 1 : -1);
  };
  el.addEventListener('click', onClick);
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointerup', onUp);
  return () => {
    el.removeEventListener('click', onClick);
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointerup', onUp);
  };
}

