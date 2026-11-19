// Hausaufgabe anlegen/bearbeiten – mit Fälligkeit „nächste Stunde“ aus dem Stundenplan.
import { html } from '../ui/dom.js';
import { save, update, remove, get } from '../store.js';
import { toast, actionSheet } from '../ui/sheet.js';
import { timetableCtx } from '../model.js';
import { nextLessonDate, nowAndNext, isSchoolDay, lessonsOn, periodsOf, blocks } from '../logic/timetable.js';
import { today, addDays, fmtDay, nowMin } from '../logic/dates.js';
import { formSheet, subjectCell, wireSubjectPicker, val, checked, toggleCell } from './kit.js';

/** Auswahl für die Fälligkeit, passend zum Fach. */
export function dueOptions(subjectId, t = today(), ctx = timetableCtx()) {
  const opts = [];
  const n1 = subjectId ? nextLessonDate(subjectId, t, ctx) : null;
  const n2 = subjectId ? nextLessonDate(subjectId, t, ctx, { skip: 1 }) : null;
  if (n1) opts.push({ key: 'next', label: 'Nächste Stunde', date: n1 });
  if (n2) opts.push({ key: 'next2', label: 'Übernächste Stunde', date: n2 });
  let school = addDays(t, 1);
  for (let i = 0; i < 14 && !isSchoolDay(school, ctx); i++) school = addDays(school, 1);
  opts.push({ key: 'tomorrow', label: 'Morgen', date: addDays(t, 1) });
  if (school !== addDays(t, 1)) opts.push({ key: 'school', label: 'Nächster Schultag', date: school });
  opts.push({ key: 'date', label: 'Datum wählen …', date: null });
  opts.push({ key: 'none', label: 'Ohne Datum', date: null });
  return opts;
}

export const dueText = (o) => (o.date ? `${o.label} · ${fmtDay(o.date)}` : o.label);

/** Fach der laufenden oder gerade beendeten Stunde (dort gibt es meist die Hausaufgabe). */
export function lessonSubjectNow(ctx = timetableCtx()) {
  const t = today();
  const m = nowMin();
  const nn = nowAndNext(t, m, ctx);
  if (nn.current) return nn.current.subjectId;
  if (!isSchoolDay(t, ctx)) return null;
  const day = blocks(lessonsOn(ctx.lessons, t, ctx.settings), periodsOf(ctx.settings));
  const ended = day.filter((b) => b.end != null && b.end <= m && m - b.end <= 30);
  return ended.length ? ended[ended.length - 1].subjectId : null;
}

/** Fälligkeit wählen; liefert { date } oder undefined bei Abbruch. */
export async function pickDue(subjectId, current) {
  const opts = dueOptions(subjectId);
  const v = await actionSheet({ title: 'Fällig', items: opts.map((o) => ({ label: o.label, sub: o.date ? fmtDay(o.date) : '', value: o.key, selected: o.date && o.date === current })) });
  if (!v) return undefined;
  const o = opts.find((x) => x.key === v);
  if (v === 'date') return { pickDate: true };
  return { date: o.date };
}

export function openTaskForm({ id = null, subjectId = null, due = undefined, text = '' } = {}) {
  const it = id ? get(id) : null;
  const ctx = timetableCtx();
  const sid = it?.data.subjectId ?? subjectId ?? lessonSubjectNow(ctx) ?? '';
  const initialDue = it ? it.data.due : due !== undefined ? due : dueOptions(sid, today(), ctx)[0]?.date || addDays(today(), 1);
  const d = it?.data || { text, note: '', done: false };
  let dueDate = initialDue || null;

  const dueChips = (subj) => {
    const opts = dueOptions(subj, today(), ctx).filter((o) => o.key !== 'date');
    return html`${opts.map((o) => html`<button type="button" class="opt ${o.date === dueDate || (!o.date && !dueDate && o.key === 'none') ? 'active' : ''}" data-due="${o.date || ''}">${o.label}${o.date ? html` <span style="opacity:.7">${fmtDay(o.date)}</span>` : ''}</button>`)}`;
  };

  const sheet = formSheet({
    title: it ? 'Hausaufgabe' : 'Neue Hausaufgabe',
    focus: it ? null : '#tf-text',
    body: html`<div class="form">
      <div class="group"><div class="cell"><input id="tf-text" class="title-input" value="${d.text}" placeholder="Was ist zu tun?" autocomplete="off" data-enter="save"></div></div>
      <div class="group">${subjectCell(sid, { label: 'Fach' })}</div>
      <div>
        <div class="group-label">Fällig</div>
        <div class="opt-row" id="tf-due">${dueChips(sid)}</div>
        <div class="group" style="margin-top:10px"><div class="cell"><label for="tf-date">Datum</label><input type="date" id="tf-date" value="${dueDate || ''}"></div></div>
      </div>
      <div class="group"><div class="cell col"><label for="tf-note">Notiz</label><textarea id="tf-note" rows="3" placeholder="optional, z. B. Seite, Material">${d.note || ''}</textarea></div></div>
      ${it ? html`<div class="group">${toggleCell('tf-done', 'Erledigt', d.done)}</div>` : ''}
    </div>`,
    onSave: async (sh) => {
      const textVal = val(sh.body, '#tf-text');
      if (!textVal) { toast('Bitte eintragen, was zu tun ist', { icon: 'info' }); return false; }
      const data = {
        ...d,
        text: textVal,
        subjectId: sh.body.querySelector('[data-pick="subject"]').dataset.value || null,
        due: sh.body.querySelector('#tf-date').value || null,
        note: val(sh.body, '#tf-note'),
      };
      if (it) {
        const done = checked(sh.body, '#tf-done');
        data.done = done;
        data.doneAt = done ? d.doneAt || new Date().toISOString() : null;
        await update(it.id, data);
      } else {
        await save('task', { ...data, done: false, doneAt: null });
        toast('Hausaufgabe eingetragen', { icon: 'check' });
      }
    },
    onDelete: it ? async () => { await remove(it.id); toast('Gelöscht', { icon: 'trash' }); } : null,
  });

  const paintDue = (subj) => { sheet.body.querySelector('#tf-due').innerHTML = String(dueChips(subj)); };
  wireSubjectPicker(sheet, {
    onChange: (v) => {
      // Bei neuem Fach: Fälligkeit auf dessen nächste Stunde setzen
      const o = dueOptions(v, today(), ctx)[0];
      if (o?.key === 'next') { dueDate = o.date; sheet.body.querySelector('#tf-date').value = dueDate; }
      paintDue(v);
    },
  });
  sheet.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-due]');
    if (!b) return;
    dueDate = b.dataset.due || null;
    sheet.body.querySelector('#tf-date').value = dueDate || '';
    paintDue(sheet.body.querySelector('[data-pick="subject"]').dataset.value);
    sheet.markDirty();
  });
  sheet.body.querySelector('#tf-date').addEventListener('change', (e) => {
    dueDate = e.target.value || null;
    paintDue(sheet.body.querySelector('[data-pick="subject"]').dataset.value);
  });
  return sheet;
}

