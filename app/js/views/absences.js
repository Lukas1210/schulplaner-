// Fehltage & Entschuldigungen: Summen je Halbjahr, Liste, Frist, verpasste Stunden, „Stoff nachholen“.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, get, update, saveMany } from '../store.js';
import { go, refresh } from '../router.js';
import { topbar, emptyState, icoTile, subjBadge } from '../ui/components.js';
import { toast } from '../ui/sheet.js';
import { subjects, timetableCtx, absenceReason, EXCUSE } from '../model.js';
import { lessonsInRange, nextLessonDate } from '../logic/timetable.js';
import { today, fmtRange, fmtDay, daysBetween } from '../logic/dates.js';
import { currentTerm, termRange } from '../grades-data.js';

export const live = true;
const state = { term: null };

export async function onFab() {
  (await import('../forms/absence-form.js')).openAbsenceForm();
}

/** Verpasste Stunden einer Abwesenheit. */
function missed(a, ctx) {
  if (a.data.allDay === false) return { count: a.data.hours || 0, lessons: [] };
  const lessons = lessonsInRange(a.data.from, a.data.to || a.data.from, ctx);
  return { count: lessons.length, lessons };
}

export function render(el) {
  const t = today();
  const ctx = timetableCtx();
  const subj = new Map(subjects({ archived: true }).map((x) => [x.id, x]));
  const range = state.term ? termRange(state.term) : currentTerm(t);
  state.term = range.kind;
  const list = all('absence').filter((a) => a.data.from <= range.to && (a.data.to || a.data.from) >= range.from).sort((a, b) => b.data.from.localeCompare(a.data.from));
  const days = list.reduce((n, a) => n + (a.data.allDay === false ? 0 : daysBetween(a.data.from, a.data.to || a.data.from) + 1), 0);
  const hours = list.reduce((n, a) => n + missed(a, ctx).count, 0);
  const open = all('absence').filter((a) => a.data.excuse === 'open');

  el.innerHTML = String(html`
    ${topbar({ title: 'Fehltage', back: true })}
    <div class="page">
      <h1 class="large-title">Fehltage</h1>
      <p class="page-sub">Krankmeldungen, Fehlstunden und Entschuldigungen</p>
      <div class="seg" style="margin-bottom:14px">${[['h1', '1. Halbjahr'], ['h2', '2. Halbjahr'], ['year', 'Ganzes Jahr']].map(([k, l]) => html`<button class="${range.kind === k ? 'active' : ''}" data-term="${k}">${l}</button>`)}</div>
      <div class="stat-grid">
        <div class="stat">${icoTile('thermo', 'var(--danger)')}<b>${days}</b><span class="s-label">${days === 1 ? 'Fehltag' : 'Fehltage'}</span></div>
        <div class="stat">${icoTile('clock', 'var(--accent-ink)')}<b>${hours}</b><span class="s-label">Fehlstunden${ctx.lessons.length ? '' : ' (ohne Stundenplan nur Teiltage)'}</span></div>
      </div>
      ${open.length ? html`<div class="section"><div class="group-label">Entschuldigung noch abgeben</div><div class="list">${open.map((a) => {
        const late = a.data.dueBy && a.data.dueBy < t;
        return html`<div class="notice ${late ? '' : 'warn'}">${icoTile('note', late ? 'var(--danger)' : 'var(--warn-ink)')}<span class="grow">${fmtRange(a.data.from, a.data.to)} · ${absenceReason(a.data.reason).label}<span class="n-sub ${late ? 'danger-text' : ''}">${a.data.dueBy ? (late ? `Frist war ${fmtDay(a.data.dueBy)}` : `bis ${fmtDay(a.data.dueBy)}`) : 'ohne Frist'}</span></span><button class="btn small ghost" data-submit="${a.id}">${icon('check')} Abgegeben</button></div>`;
      })}</div></div>` : ''}
      <div class="section">
        ${list.length ? html`<div class="group-label">${range.label}</div><div class="list">${list.map((a) => {
          const m = missed(a, ctx);
          const subs = [...new Set(m.lessons.map((x) => x.lesson.subjectId))].map((id) => subj.get(id)).filter(Boolean);
          const ex = EXCUSE[a.data.excuse] || EXCUSE.open;
          return html`<div class="card tight">
            <button class="row" data-edit="${a.id}" style="width:100%;text-align:left">
              <div class="grow"><div style="font-weight:650">${fmtRange(a.data.from, a.data.to)} · ${absenceReason(a.data.reason).label}</div>
                <div class="muted" style="font-size:13px;margin-top:2px">${a.data.allDay === false ? `${m.count} ${m.count === 1 ? 'Stunde' : 'Stunden'}` : `${daysBetween(a.data.from, a.data.to || a.data.from) + 1} ${daysBetween(a.data.from, a.data.to || a.data.from) ? 'Tage' : 'Tag'}${m.count ? ` · ${m.count} Stunden` : ''}`}${a.data.note ? ` · ${a.data.note}` : ''}</div></div>
              <span class="pill ${a.data.excuse === 'open' ? 'warn' : a.data.excuse === 'submitted' ? 'ok' : ''}">${ex.short}</span>
            </button>
            ${subs.length ? html`<div class="row wrap" style="margin-top:10px;gap:6px">${subs.map((s) => subjBadge(s, { size: 'sm' }))}<span class="grow"></span>${a.data.catchUp ? html`<span class="muted" style="font-size:13px">${icon('check')} Nachholen eingetragen</span>` : html`<button class="text-btn small" data-catchup="${a.id}">${icon('tasks')} Stoff nachholen</button>`}</div>` : ''}
          </div>`;
        })}</div>`
          : emptyState({ icon: 'thermo', title: 'Keine Fehltage', text: `Im ${range.label} hast du nicht gefehlt.`, small: true })}
      </div>
    </div>`);

  const onClick = async (e) => {
    const tm = e.target.closest('[data-term]');
    if (tm) { state.term = tm.dataset.term; refresh(); return; }
    const sb = e.target.closest('[data-submit]');
    if (sb) { await update(sb.dataset.submit, { excuse: 'submitted', dueBy: null }); toast('Als abgegeben markiert', { icon: 'check' }); return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) { (await import('../forms/absence-form.js')).openAbsenceForm({ id: ed.dataset.edit }); return; }
    const cu = e.target.closest('[data-catchup]');
    if (cu) {
      const a = get(cu.dataset.catchup);
      const m = missed(a, ctx);
      const ids = [...new Set(m.lessons.map((x) => x.lesson.subjectId))];
      const tasks = ids.map((sid) => ({ type: 'task', data: { subjectId: sid, text: `Stoff vom ${fmtRange(a.data.from, a.data.to)} nachholen`, due: nextLessonDate(sid, t, ctx), done: false, doneAt: null, note: '' } }));
      await saveMany(tasks);
      await update(a.id, { catchUp: true });
      toast(`${tasks.length} Aufgaben zum Nachholen angelegt`, { icon: 'tasks', actionLabel: 'Ansehen', onAction: () => go('/tasks') });
    }
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}
