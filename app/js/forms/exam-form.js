// Test / Klassenarbeit / Referat / Lernziel anlegen oder bearbeiten.
import { html } from '../ui/dom.js';
import { save, update, removeMany, get, shortId } from '../store.js';
import { toast, confirmDialog } from '../ui/sheet.js';
import { go } from '../router.js';
import { EXAM_KINDS, timetableCtx } from '../model.js';
import { periodsOf, lessonsOn, nextLessonDate } from '../logic/timetable.js';
import { today, fmtDay } from '../logic/dates.js';
import { formSheet, subjectCell, wireSubjectPicker, val, selectCell } from './kit.js';

/** Stunde des Fachs an diesem Tag (für die Vorauswahl). */
function lessonPeriod(subjectId, date, ctx) {
  if (!subjectId || !date) return null;
  const l = lessonsOn(ctx.lessons, date, ctx.settings).find((x) => x.subjectId === subjectId);
  return l ? l.period : null;
}

export function openExamForm({ id = null, subjectId = null, date = null, period = null, kind = 'ka' } = {}) {
  const it = id ? get(id) : null;
  const ctx = timetableCtx();
  const periods = periodsOf(ctx.settings);
  const d = it?.data || { kind, subjectId, title: '', date: kind === 'goal' ? null : date, period, notes: '', topics: [], gradeId: null };
  if (!it && d.kind !== 'goal' && !d.date && subjectId) d.date = nextLessonDate(subjectId, today(), ctx);
  if (!it && d.date && !d.period) d.period = lessonPeriod(d.subjectId, d.date, ctx);
  const periodOptions = (sel) => [{ value: '', label: 'ohne Stunde' }, ...periods.map((p, i) => ({ value: i + 1, label: `${i + 1}. Stunde (${p.start})` }))].map((o) => ({ ...o, selected: String(o.value) === String(sel ?? '') }));

  const sheet = formSheet({
    title: it ? 'Bearbeiten' : d.kind === 'goal' ? 'Neues Lernziel' : 'Neuer Test',
    body: html`<div class="form">
      <div class="group">
        ${selectCell('xf-kind', 'Art', EXAM_KINDS.map((k) => ({ value: k.key, label: k.label })), d.kind)}
        ${subjectCell(d.subjectId)}
        <div class="cell"><label for="xf-title">Thema</label><input id="xf-title" value="${d.title || ''}" placeholder="z. B. Quadratische Funktionen" autocomplete="off" data-enter="save"></div>
      </div>
      <div class="group" id="xf-when" ${d.kind === 'goal' ? 'hidden' : ''}>
        <div class="cell"><label for="xf-date">Datum</label><input type="date" id="xf-date" value="${d.date || ''}"></div>
        <label class="cell" for="xf-period"><span class="label">Stunde</span><select id="xf-period">${periodOptions(d.period).map((o) => html`<option value="${o.value}" ${o.selected ? 'selected' : ''}>${o.label}</option>`)}</select></label>
      </div>
      ${it ? '' : html`<div><div class="group-label">Lernstoff</div><div class="group"><div class="cell col"><textarea id="xf-topics" rows="5" placeholder="Ein Thema pro Zeile, z. B.&#10;Scheitelpunktform&#10;p-q-Formel&#10;Textaufgaben"></textarea></div></div><div class="group-foot">Später schätzt du jedes Thema mit der Ampel ein – daraus entsteht dein Lernplan.</div></div>`}
      <div class="group"><div class="cell col"><label for="xf-notes">Notizen</label><textarea id="xf-notes" rows="3" placeholder="z. B. Taschenrechner mitbringen">${d.notes || ''}</textarea></div></div>
    </div>`,
    onSave: async (sh) => {
      const kindVal = sh.body.querySelector('#xf-kind').value;
      const sid = sh.body.querySelector('[data-pick="subject"]').dataset.value || null;
      const title = val(sh.body, '#xf-title');
      const dateVal = kindVal === 'goal' ? null : sh.body.querySelector('#xf-date').value || null;
      if (kindVal !== 'goal' && !dateVal) { toast('Bitte ein Datum wählen', { icon: 'info' }); return false; }
      if (!sid && !title) { toast('Bitte Fach oder Thema angeben', { icon: 'info' }); return false; }
      const p = sh.body.querySelector('#xf-period').value;
      const data = { ...d, kind: kindVal, subjectId: sid, title, date: dateVal, period: kindVal === 'goal' || !p ? null : Number(p), notes: val(sh.body, '#xf-notes') };
      if (it) { await update(it.id, data); return; }
      const lines = (sh.body.querySelector('#xf-topics')?.value || '').split(/\r?\n/).map((x) => x.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);
      data.topics = lines.map((text) => ({ id: shortId(), text, level: 0, studied: [] }));
      const created = await save('exam', data);
      toast(kindVal === 'goal' ? 'Lernziel eingetragen' : `${EXAM_KINDS.find((k) => k.key === kindVal).label} am ${fmtDay(dateVal)} eingetragen`, { icon: 'check', actionLabel: 'Öffnen', onAction: () => go(`/exam/${created.id}`), duration: 4000 });
    },
    onDelete: it ? async () => {
      const ok = await confirmDialog({ title: 'Löschen?', message: 'Der Lernstoff wird mit gelöscht. Eingetragene Noten bleiben erhalten.', ok: 'Löschen', danger: true });
      if (!ok) return false;
      await removeMany([it.id]);
      if (location.hash.includes(it.id)) history.back();
    } : null,
  });

  const kindSel = sheet.body.querySelector('#xf-kind');
  kindSel.addEventListener('change', () => { sheet.body.querySelector('#xf-when').hidden = kindSel.value === 'goal'; });
  const dateEl = sheet.body.querySelector('#xf-date');
  const perEl = sheet.body.querySelector('#xf-period');
  const autoPeriod = () => {
    const sid = sheet.body.querySelector('[data-pick="subject"]').dataset.value;
    const p = lessonPeriod(sid, dateEl.value, ctx);
    if (p) perEl.value = String(p);
  };
  dateEl.addEventListener('change', autoPeriod);
  wireSubjectPicker(sheet, {
    onChange: (sid) => {
      if (!dateEl.value && kindSel.value !== 'goal') dateEl.value = nextLessonDate(sid, today(), ctx) || '';
      autoPeriod();
    },
  });
  if (!it && !d.subjectId) setTimeout(() => sheet.body.querySelector('[data-pick="subject"]')?.click(), 420);
  return sheet;
}

