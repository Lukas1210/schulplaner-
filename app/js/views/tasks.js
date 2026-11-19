// Aufgaben-Tab: Hausaufgaben schnell eintragen, nach Fälligkeit gruppiert, nach Fach filtern.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, save, removeMany } from '../store.js';
import { topbar, emptyState } from '../ui/components.js';
import { confirmDialog, toast } from '../ui/sheet.js';
import { subjects, subjectById, timetableCtx } from '../model.js';
import { today, daysBetween, isoDow, fmtDay } from '../logic/dates.js';
import { taskRow, wireTasks } from './task-row.js';
import { dueOptions, lessonSubjectNow, pickDue } from '../forms/task-form.js';
import { pickSubject } from '../forms/kit.js';

export const live = true;
const state = { filter: null, showDone: false, subjectId: undefined, due: undefined };

export async function onFab() {
  const { openTaskForm } = await import('../forms/task-form.js');
  openTaskForm({ subjectId: state.filter || undefined });
}

function groups(open, t) {
  const daysToSunday = 7 - isoDow(t);
  const g = [
    { key: 'late', label: 'Überfällig', items: [] },
    { key: 'today', label: 'Heute', items: [] },
    { key: 'tomorrow', label: 'Morgen', items: [] },
    { key: 'week', label: 'Diese Woche', items: [] },
    { key: 'later', label: 'Später', items: [] },
    { key: 'none', label: 'Ohne Datum', items: [] },
  ];
  for (const x of open) {
    const due = x.data.due;
    if (!due) { g[5].items.push(x); continue; }
    const n = daysBetween(t, due);
    if (n < 0) g[0].items.push(x);
    else if (n === 0) g[1].items.push(x);
    else if (n === 1) g[2].items.push(x);
    else if (n <= daysToSunday) g[3].items.push(x);
    else g[4].items.push(x);
  }
  return g.filter((x) => x.items.length);
}

function quickAddHtml(ctx) {
  const t = today();
  if (state.subjectId === undefined) state.subjectId = state.filter || lessonSubjectNow(ctx) || '';
  if (state.due === undefined) state.due = dueOptions(state.subjectId, t, ctx)[0]?.date ?? null;
  const s = subjectById(state.subjectId);
  const dueOpt = dueOptions(state.subjectId, t, ctx).find((o) => o.date && o.date === state.due);
  return html`<form class="todo-add" id="qa">
    <div class="ta-row"><input id="qa-text" placeholder="Neue Hausaufgabe …" autocomplete="off" enterkeyhint="done" aria-label="Neue Hausaufgabe"><button class="add-btn" type="submit" aria-label="Hinzufügen">${icon('plus')}</button></div>
    <div class="ta-opts">
      <button type="button" class="chip" data-qa="subject">${s ? html`<span class="subj-dot" style="--c:${s.data.color}"></span>${s.data.name}` : html`${icon('book')} Fach`}</button>
      <button type="button" class="chip" data-qa="due">${icon('calendar')} ${state.due ? `${dueOpt ? `${dueOpt.label} · ` : ''}${fmtDay(state.due)}` : 'Ohne Datum'}</button>
    </div>
  </form>`;
}

function paint(el) {
  const t = today();
  const ctx = timetableCtx();
  const subjList = subjects();
  const subj = new Map(subjects({ archived: true }).map((x) => [x.id, x]));
  const allTasks = all('task');
  const visible = allTasks.filter((x) => !state.filter || x.data.subjectId === state.filter);
  const open = visible.filter((x) => !x.data.done).sort((a, b) => String(a.data.due || '9999').localeCompare(String(b.data.due || '9999')) || String(a.createdAt).localeCompare(String(b.createdAt)));
  const done = visible.filter((x) => x.data.done).sort((a, b) => String(b.data.doneAt).localeCompare(String(a.data.doneAt)));
  const openAll = allTasks.filter((x) => !x.data.done);
  const soon = openAll.filter((x) => x.data.due && daysBetween(t, x.data.due) <= 1).length;
  const withOpen = new Set(openAll.map((x) => x.data.subjectId));

  el.innerHTML = String(html`
    ${topbar({ title: 'Aufgaben' })}
    <div class="page">
      <h1 class="large-title">Aufgaben</h1>
      <p class="page-sub">${openAll.length ? `${openAll.length} offen${soon ? ` · ${soon} bis morgen` : ''}` : 'Alles erledigt.'}</p>
      ${quickAddHtml(ctx)}
      ${subjList.length > 1 && openAll.length ? html`<div class="chips" style="margin-top:12px">
        <button class="chip ${!state.filter ? 'active' : ''}" data-filter="">Alle</button>
        ${subjList.filter((s) => withOpen.has(s.id) || state.filter === s.id).map((s) => html`<button class="chip ${state.filter === s.id ? 'active' : ''}" data-filter="${s.id}"><span class="subj-dot" style="--c:${s.data.color}"></span>${s.data.name}</button>`)}
      </div>` : ''}
      ${open.length ? groups(open, t).map((g) => html`<div class="todo-section"><div class="group-label ${g.key === 'late' ? 'late' : ''}">${g.label} · ${g.items.length}</div><div class="todo-group">${g.items.map((x) => taskRow(x, subj, t, { showSubject: !state.filter }))}</div></div>`)
        : emptyState({ icon: 'tasks', title: state.filter ? 'Nichts offen in diesem Fach' : 'Keine Hausaufgaben', text: 'Neue Hausaufgaben oben eintragen. Mit Stundenplan wird „nächste Stunde“ automatisch zum richtigen Datum.' })}
      ${done.length ? html`
        <div class="row between" style="margin-top:18px">
          <button class="text-btn" data-act="toggle-done">${icon(state.showDone ? 'chevronDown' : 'chevron')} Erledigt · ${done.length}</button>
          ${state.showDone ? html`<button class="text-btn small" data-act="clear-done" style="color:var(--danger)">Erledigte löschen</button>` : ''}
        </div>
        ${state.showDone ? html`<div class="todo-group">${done.slice(0, 60).map((x) => taskRow(x, subj, t, { showSubject: !state.filter }))}</div>` : ''}` : ''}
    </div>`);
}

export function render(el) {
  paint(el);
  const offTasks = wireTasks(el);
  const onSubmit = async (e) => {
    if (e.target.id !== 'qa') return;
    e.preventDefault();
    const input = el.querySelector('#qa-text');
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    await save('task', { text, subjectId: state.subjectId || null, due: state.due || null, done: false, doneAt: null, note: '' });
    input.value = '';
    toast('Eingetragen', { icon: 'check', duration: 1500 });
    input.blur();
    paint(el);
  };
  const onClick = async (e) => {
    const f = e.target.closest('[data-filter]');
    if (f) {
      state.filter = f.dataset.filter || null;
      if (state.filter) { state.subjectId = state.filter; state.due = dueOptions(state.filter)[0]?.date ?? null; }
      paint(el);
      return;
    }
    const q = e.target.closest('[data-qa]');
    if (q?.dataset.qa === 'subject') {
      const v = await pickSubject(state.subjectId, { allowNone: true });
      if (v === undefined) return;
      state.subjectId = v;
      state.due = dueOptions(v)[0]?.date ?? state.due;
      paint(el);
      return;
    }
    if (q?.dataset.qa === 'due') {
      const r = await pickDue(state.subjectId, state.due);
      if (!r) return;
      if (r.pickDate) {
        const inp = document.createElement('input');
        inp.type = 'date';
        inp.value = state.due || today();
        inp.style.cssText = 'position:fixed;opacity:0;pointer-events:none;bottom:0';
        document.body.appendChild(inp);
        inp.addEventListener('change', () => { state.due = inp.value || null; inp.remove(); paint(el); });
        inp.addEventListener('blur', () => setTimeout(() => inp.remove(), 300));
        inp.focus();
        try { inp.showPicker?.(); } catch {}
        return;
      }
      state.due = r.date;
      paint(el);
      return;
    }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'toggle-done') { state.showDone = !state.showDone; paint(el); }
    if (a.dataset.act === 'clear-done') {
      const ids = all('task').filter((x) => x.data.done && (!state.filter || x.data.subjectId === state.filter)).map((x) => x.id);
      if (await confirmDialog({ title: `${ids.length} erledigte löschen?`, ok: 'Löschen', danger: true })) await removeMany(ids);
    }
  };
  el.addEventListener('submit', onSubmit);
  el.addEventListener('click', onClick);
  return () => { offTasks(); el.removeEventListener('submit', onSubmit); el.removeEventListener('click', onClick); };
}
