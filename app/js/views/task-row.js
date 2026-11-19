// Zeile für eine Hausaufgabe (Heute, Aufgaben, Fach-Seite) und Abhaken.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get, update } from '../store.js';
import { subjBadge } from '../ui/components.js';
import { daysBetween, dueLabel, fmtDay } from '../logic/dates.js';
import { burstAt } from '../ui/fx.js';

export function dueInfo(due, t) {
  if (!due) return null;
  const n = daysBetween(t, due);
  if (n < 0) return { text: n === -1 ? 'seit gestern fällig' : `überfällig seit ${fmtDay(due)}`, cls: 'late' };
  if (n === 0) return { text: 'heute fällig', cls: 'soon' };
  if (n === 1) return { text: 'bis morgen', cls: 'soon' };
  return { text: `bis ${dueLabel(due, t)}`, cls: '' };
}

export function taskRow(task, subjects, t, { showSubject = true } = {}) {
  const d = task.data;
  const s = subjects.get(d.subjectId);
  const due = d.done ? null : dueInfo(d.due, t);
  return html`
    <div class="todo ${d.done ? 'done' : ''}">
      <button class="check" data-check="${task.id}" aria-label="${d.done ? 'Wieder öffnen' : 'Erledigt'}: ${d.text}">${icon('check')}</button>
      <button class="grow todo-main" data-task="${task.id}">
        <span class="todo-text">${d.text}</span>
        <span class="todo-sub">${showSubject && s ? html`${subjBadge(s, { size: 'sm' })}<span>${s.data.name}</span>` : ''}${due ? html`${showSubject && s ? ' · ' : ''}<span class="due ${due.cls}">${due.text}</span>` : ''}${d.note ? html`<span>· ${d.note}</span>` : ''}</span>
      </button>
    </div>`;
}

/** Abhaken / wieder öffnen. */
export async function toggleTask(id, btn) {
  const it = get(id);
  if (!it) return;
  const done = !it.data.done;
  if (done && btn) burstAt(btn, 10);
  await update(id, { done, doneAt: done ? new Date().toISOString() : null });
}

/** Klick-Behandlung für Listen mit Aufgabenzeilen. */
export function wireTasks(root) {
  const onClick = async (e) => {
    const c = e.target.closest('[data-check]');
    if (c) { e.stopPropagation(); toggleTask(c.dataset.check, c); return; }
    const t = e.target.closest('[data-task]');
    if (t) {
      const { openTaskForm } = await import('../forms/task-form.js');
      openTaskForm({ id: t.dataset.task });
    }
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
