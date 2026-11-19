// Startseite „Heute“: laufende/nächste Stunde, Hinweise, fällige Hausaufgaben, Heute dran, nächste Tests, Kacheln.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, settings } from '../store.js';
import { go } from '../router.js';
import { actionSheet } from '../ui/sheet.js';
import { subjBadge, ampBar, sectionHead, icoTile } from '../ui/components.js';
import { subjects, timetableCtx, examKind, EXCUSE } from '../model.js';
import { MORE } from '../nav.js';
import { today, nowMin, fmtLong, fmtDay, fmtRange, relDay, daysBetween, minToTime } from '../logic/dates.js';
import { nowAndNext, weekType, schoolDaysBetween, periodsOf, lessonsOn, blocks } from '../logic/timetable.js';
import { currentOrNextHoliday } from '../logic/holidays.js';
import { examProgress } from '../logic/plan.js';
import { buildPlan } from './plan-rows.js';
import { fmtAvg } from '../logic/grades.js';
import { currentTerm, overallStats } from '../grades-data.js';
import { taskRow, wireTasks } from './task-row.js';
import { openTopicSheet } from './topic-sheet.js';

export const live = true;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function greeting(name) {
  const h = new Date().getHours();
  const g = h < 11 ? 'Guten Morgen' : h < 17 ? 'Hallo' : 'Guten Abend';
  return name ? `${g}, ${name}!` : g;
}

function nowCard(ctx, subj, t) {
  if (!ctx.lessons.length) {
    return html`<button class="now-card" data-go="/timetable" style="width:100%;text-align:left">
      <div class="nc-row">${icoTile('grid', 'var(--accent-ink)', { lg: true })}<div class="grow"><div class="nc-title">Stundenplan eintragen</div><div class="nc-meta">Dann siehst du hier deine nächste Stunde.</div></div><span class="chev faint">${icon('chevron')}</span></div>
    </button>`;
  }
  const free = ctx.freeInfo(t);
  if (free) {
    const left = daysBetween(t, free.end) + 1;
    return html`<div class="now-card"><div class="nc-row">${icoTile('palm', 'var(--accent2-ink)', { lg: true })}<div class="grow"><div class="kicker">Heute frei</div><div class="nc-title">${free.name}</div><div class="nc-meta">${left > 1 ? `noch ${left} Tage frei · bis ${fmtDay(free.end)}` : 'nur heute'}</div></div></div></div>`;
  }
  const m = nowMin();
  const nn = nowAndNext(t, m, ctx);
  const s = (b) => subj.get(b.subjectId);
  const room = (b) => b.room || s(b)?.data.room || '';
  const line = (b) => [room(b) ? `Raum ${room(b)}` : '', s(b)?.data.teacher || ''].filter(Boolean).join(' · ');
  if (nn.current) {
    const b = nn.current;
    const pct = Math.max(0, Math.min(100, ((m - b.start) / (b.end - b.start)) * 100));
    const next = nn.next && nn.nextDate === t ? nn.next : null;
    return html`<button class="now-card" data-go="/calendar" style="width:100%;text-align:left">
      <div class="nc-row">${subjBadge(s(b), { size: 'lg' })}<div class="grow"><div class="kicker">Jetzt · bis ${minToTime(b.end)}</div><div class="nc-title">${s(b)?.data.name || 'Stunde'}</div>${line(b) ? html`<div class="nc-meta">${line(b)}</div>` : ''}</div></div>
      <div class="progress" aria-hidden="true"><div style="width:${pct}%"></div></div>
      ${next ? html`<div class="nc-next">${subjBadge(s(next), { size: 'sm' })}<span class="grow">Danach <b>${s(next)?.data.name}</b> um ${minToTime(next.start)}</span><span class="faint">${room(next) ? `Raum ${room(next)}` : ''}</span></div>` : html`<div class="nc-next faint">Danach ist Schluss für heute</div>`}
    </button>`;
  }
  if (nn.next) {
    const b = nn.next;
    const sameDay = nn.nextDate === t;
    const dayBlocks = blocks(lessonsOn(ctx.lessons, nn.nextDate, ctx.settings), periodsOf(ctx.settings));
    const end = dayBlocks[dayBlocks.length - 1]?.end;
    const when = sameDay ? `Als Nächstes · um ${minToTime(b.start)}` : `${cap(relDay(nn.nextDate, t))}${daysBetween(t, nn.nextDate) > 2 ? ` · ${fmtDay(nn.nextDate)}` : ''} · ab ${minToTime(b.start)}`;
    return html`<button class="now-card" data-go="/calendar" style="width:100%;text-align:left">
      <div class="nc-row">${subjBadge(s(b), { size: 'lg' })}<div class="grow"><div class="kicker">${when}</div><div class="nc-title">${s(b)?.data.name || 'Stunde'}</div><div class="nc-meta">${[line(b), !sameDay && end ? `${dayBlocks.length} ${dayBlocks.length === 1 ? 'Block' : 'Blöcke'} bis ${minToTime(end)}` : ''].filter(Boolean).join(' · ')}</div></div></div>
    </button>`;
  }
  return '';
}

function notices(t, subj) {
  const out = [];
  for (const e of all('exam')) {
    const d = e.data;
    const s = subj.get(d.subjectId);
    if (d.date === t && d.kind !== 'goal') {
      out.push(html`<button class="notice accent" data-exam="${e.id}">${icoTile('sparkles', 'var(--accent-ink)')}<span class="grow">Heute: <b>${examKind(d.kind).label}</b>${s ? ` in ${s.data.name}` : ''} – viel Erfolg!</span></button>`);
    }
    const ago = d.date ? daysBetween(d.date, t) : -1;
    if (d.date && ago > 0 && ago <= 30 && !d.gradeId && !d.noGrade && ['ka', 'test', 'abfrage', 'referat'].includes(d.kind)) {
      out.push(html`<div class="notice">${icoTile('grades', 'var(--ok)')}<span class="grow">Note für ${examKind(d.kind).label}${s ? ` in ${s.data.name}` : ''} schon zurück?<span class="n-sub">${fmtDay(d.date)}</span></span><button class="btn small ghost" data-grade-for="${e.id}">Eintragen</button></div>`);
    }
  }
  for (const a of all('absence')) {
    const d = a.data;
    if (d.excuse !== 'open') continue;
    const late = d.dueBy && d.dueBy < t;
    out.push(html`<button class="notice ${late ? '' : 'warn'}" data-go="/absences">${icoTile('note', late ? 'var(--danger)' : 'var(--warn-ink)')}<span class="grow">Entschuldigung für ${fmtRange(d.from, d.to)} abgeben<span class="n-sub ${late ? 'danger-text' : ''}">${d.dueBy ? (late ? `Frist war ${fmtDay(d.dueBy)}` : `bis ${fmtDay(d.dueBy)}`) : EXCUSE.open.label}</span></span><span class="chev faint">${icon('chevron')}</span></button>`);
  }
  return out;
}

function planSection(t, subj) {
  const { plan, rows, anyUpcoming } = buildPlan(t, subj, { limit: 6 });
  let body;
  if (rows.length) body = html`<div class="todo-group">${rows}</div>${plan.done && !plan.open && !plan.rehearsals.length ? html`<p class="muted" style="margin:10px 4px 0">Für heute erledigt – stark!</p>` : ''}`;
  else if (anyUpcoming) body = html`<div class="card tight muted">Heute steht nichts an. Alle Themen sitzen oder deine Tests sind noch weit weg.</div>`;
  else body = html`<button class="card tight card-link" data-act="add-exam" style="width:100%;text-align:left"><div class="row">${icoTile('learn', 'var(--accent2-ink)')}<span class="grow">Trag deinen nächsten Test ein – dann plane ich, was du jeden Tag lernst.</span></div></button>`;
  return html`<div class="section">${sectionHead('Heute dran', html`<a class="section-link" href="#/learn">Lernen</a>`)}${body}</div>`;
}

function examsSection(t, subj) {
  const list = all('exam').filter((e) => e.data.date && e.data.kind !== 'goal' && e.data.date >= t && daysBetween(t, e.data.date) <= 45).sort((a, b) => a.data.date.localeCompare(b.data.date)).slice(0, 6);
  if (!list.length) return '';
  return html`<div class="section">${sectionHead('Nächste Tests', html`<a class="section-link" href="#/calendar">Kalender</a>`)}
    <div class="h-scroll">${list.map((e) => {
      const d = e.data;
      const s = subj.get(d.subjectId);
      const p = examProgress(d);
      const n = daysBetween(t, d.date);
      return html`<button class="exam-card ${n === 0 ? 'today' : ''}" data-exam="${e.id}">
        <div class="ex-top">${subjBadge(s)}<div class="grow" style="min-width:0"><div class="ex-title ellipsis">${examKind(d.kind).label}${d.title ? `: ${d.title}` : ''}</div><div class="ex-meta">${s?.data.name || ''} · ${fmtDay(d.date)}</div></div>
          <div class="ex-count">${n === 0 ? html`<b>Heute</b>` : html`<b>${n}</b><small>${n === 1 ? 'Tag' : 'Tage'}</small>`}</div></div>
        ${p.total ? ampBar(p) : html`<div class="ex-meta" style="margin-top:12px">Noch kein Lernstoff</div>`}
      </button>`;
    })}</div></div>`;
}

function statsSection(t, ctx) {
  const term = currentTerm(t);
  const o = overallStats(term);
  const openTasks = all('task').filter((x) => !x.data.done).length;
  const hol = currentOrNextHoliday(ctx.holidays, t);
  const abs = all('absence').filter((a) => a.data.from >= term.from && a.data.from <= term.to);
  const absDays = abs.reduce((n, a) => n + (a.data.allDay === false ? 0 : Math.max(1, daysBetween(a.data.from, a.data.to || a.data.from) + 1)), 0);
  const tiles = [
    html`<button class="stat" data-go="/grades">${icoTile('grades', 'var(--ok)')}<b>${o.avg != null ? fmtAvg(o.avg) : '–'}</b><span class="s-label">Schnitt ${term.label}</span></button>`,
    html`<button class="stat" data-go="/tasks">${icoTile('tasks', 'var(--accent-ink)')}<b>${openTasks}</b><span class="s-label">Offene Hausaufgaben</span></button>`,
  ];
  if (hol.next && !hol.current) {
    const n = schoolDaysBetween(t, hol.next.start, ctx);
    tiles.push(html`<button class="stat" data-go="/calendar">${icoTile('palm', 'var(--accent2-ink)')}<b>${n}</b><span class="s-label">Schultage bis ${hol.next.name}</span></button>`);
  }
  if (abs.length) tiles.push(html`<button class="stat" data-go="/absences">${icoTile('thermo', 'var(--danger)')}<b>${absDays}</b><span class="s-label">Fehltage im Halbjahr</span></button>`);
  return html`<div class="section">${sectionHead('Überblick')}<div class="stat-grid">${tiles}</div></div>`;
}

function paint(el) {
  const t = today();
  const s = settings();
  const ctx = timetableCtx();
  const subj = new Map(subjects({ archived: true }).map((x) => [x.id, x]));
  const wt = weekType(t, s);
  const hol = currentOrNextHoliday(ctx.holidays, t);
  const chips = [];
  if (wt) chips.push(html`<span class="pill accent">${wt}-Woche</span>`);
  if (hol.current) chips.push(html`<span class="pill accent2">${icon('palm')} ${hol.current.name} bis ${fmtDay(hol.current.end)}</span>`);
  else if (hol.next && daysBetween(t, hol.next.start) <= 60) {
    const n = schoolDaysBetween(t, hol.next.start, ctx);
    chips.push(html`<span class="pill accent2">${icon('palm')} Noch ${n} ${n === 1 ? 'Schultag' : 'Schultage'} bis ${hol.next.name}</span>`);
  }

  const tasks = all('task').filter((x) => !x.data.done && x.data.due && daysBetween(t, x.data.due) <= 1)
    .sort((a, b) => a.data.due.localeCompare(b.data.due) || String(a.createdAt).localeCompare(String(b.createdAt)));
  const openCount = all('task').filter((x) => !x.data.done).length;
  const notes = notices(t, subj);

  const stats = statsSection(t, ctx);
  const left = html`
    ${nowCard(ctx, subj, t)}
    ${notes.length ? html`<div class="section" style="margin-top:14px">${notes}</div>` : ''}
    <div class="section">
      ${sectionHead('Fällig', html`<a class="section-link" href="#/tasks">${openCount ? `Alle (${openCount})` : 'Aufgaben'}</a>`)}
      ${tasks.length ? html`<div class="todo-group">${tasks.slice(0, 8).map((x) => taskRow(x, subj, t))}</div>` : html`<div class="card tight row"><span class="ok-text">${icon('check')}</span><span class="grow muted">${openCount ? 'Bis morgen ist nichts fällig.' : 'Keine offenen Hausaufgaben.'}</span><button class="text-btn small" data-act="add-task">${icon('plus')} Neu</button></div>`}
    </div>
    <div class="only-wide">${stats}</div>`;
  const right = html`${planSection(t, subj)}${examsSection(t, subj)}<div class="only-narrow">${stats}</div>`;

  el.innerHTML = String(html`
    <div class="page">
      <div class="hero">
        <div class="date">${fmtLong(t)}</div>
        <h1>${greeting(s.name)}</h1>
        ${chips.length ? html`<div class="hero-chips">${chips}</div>` : ''}
        <div class="hero-actions"><button class="icon-btn" data-act="more" aria-label="Mehr">${icon('more')}</button></div>
      </div>
      <div class="cols" style="margin-top:16px"><div>${left}</div><div>${right}</div></div>
    </div>`);
}

export function render(el) {
  paint(el);
  const offTasks = wireTasks(el);
  const onClick = async (e) => {
    const g = e.target.closest('[data-go]');
    if (g) { go(g.dataset.go); return; }
    const tp = e.target.closest('[data-topic]');
    if (tp) { const [ex, topic] = tp.dataset.topic.split(':'); openTopicSheet(ex, topic); return; }
    const ex = e.target.closest('[data-exam]');
    if (ex) { go(`/exam/${ex.dataset.exam}`); return; }
    const gf = e.target.closest('[data-grade-for]');
    if (gf) { const { openGradeForm } = await import('../forms/grade-form.js'); openGradeForm({ examId: gf.dataset.gradeFor }); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'more') {
      const v = await actionSheet({ title: 'Mehr', items: MORE.map((m) => ({ label: m.label, icon: m.icon, value: m.path })) });
      if (v) go(v);
    } else if (a.dataset.act === 'add-task') {
      const { openTaskForm } = await import('../forms/task-form.js');
      openTaskForm();
    } else if (a.dataset.act === 'add-exam') {
      const { openExamForm } = await import('../forms/exam-form.js');
      openExamForm();
    }
  };
  el.addEventListener('click', onClick);
  // Stunden-Karte jede Minute aktualisieren
  const timer = setInterval(() => { if (!document.hidden && !document.querySelector('.sheet')) paint(el); }, 60000);
  return () => {
    offTasks();
    el.removeEventListener('click', onClick);
    clearInterval(timer);
  };
}
