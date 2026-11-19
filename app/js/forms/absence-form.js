// Fehltag eintragen: Zeitraum, ganztägig oder Stunden, Grund, Entschuldigung mit Frist.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { save, update, remove, get, settings } from '../store.js';
import { toast } from '../ui/sheet.js';
import { ABSENCE_REASONS, EXCUSE, timetableCtx } from '../model.js';
import { addSchoolDays, lessonsInRange, isSchoolDay } from '../logic/timetable.js';
import { today, fmtDay } from '../logic/dates.js';
import { formSheet, val, checked, toggleCell, selectCell } from './kit.js';

/** Frist: n Schultage nach dem letzten Fehltag. */
export function excuseDeadline(to, ctx = timetableCtx()) {
  return addSchoolDays(to, settings().excuseDays || 3, ctx);
}

export function openAbsenceForm({ id = null, date = null } = {}) {
  const it = id ? get(id) : null;
  const ctx = timetableCtx();
  const d = it?.data || { from: date || today(), to: date || today(), allDay: true, hours: 1, reason: 'sick', excuse: 'open', dueBy: null, note: '' };
  let excuse = d.excuse;

  const info = (from, to, allDay) => {
    const n = allDay ? lessonsInRange(from, to || from, ctx).length : null;
    const due = excuseDeadline(to || from, ctx);
    return html`${n != null && ctx.lessons.length ? html`<span>${icon('clock')} ${n} ${n === 1 ? 'Stunde' : 'Stunden'} laut Stundenplan</span> · ` : ''}<span>Frist für die Entschuldigung: <b>${fmtDay(due)}</b></span>`;
  };

  const sheet = formSheet({
    title: it ? 'Fehltag' : 'Fehltag eintragen',
    body: html`<div class="form">
      <div class="group">
        <div class="cell"><label for="af-from">Von</label><input type="date" id="af-from" value="${d.from}"></div>
        <div class="cell"><label for="af-to">Bis</label><input type="date" id="af-to" value="${d.to || d.from}"></div>
        ${toggleCell('af-allday', 'Ganzer Tag', d.allDay !== false)}
        <div class="cell ${d.allDay !== false ? 'hidden' : ''}" id="af-hours-row"><label for="af-hours">Fehlstunden</label><select id="af-hours">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => html`<option value="${n}" ${n === d.hours ? 'selected' : ''}>${n}</option>`)}</select></div>
        ${selectCell('af-reason', 'Grund', ABSENCE_REASONS.map((r) => ({ value: r.key, label: r.label })), d.reason)}
      </div>
      <div>
        <div class="group-label">Entschuldigung</div>
        <div class="seg" id="af-excuse">${Object.entries(EXCUSE).map(([k, v]) => html`<button type="button" data-excuse="${k}" class="${excuse === k ? 'active' : ''}">${v.short}</button>`)}</div>
        <div class="group-foot" id="af-info">${info(d.from, d.to, d.allDay !== false)}</div>
      </div>
      <div class="group"><div class="cell col"><label for="af-note">Notiz</label><textarea id="af-note" rows="2" placeholder="optional">${d.note || ''}</textarea></div></div>
    </div>`,
    onSave: async (sh) => {
      const from = sh.body.querySelector('#af-from').value;
      let to = sh.body.querySelector('#af-to').value || from;
      if (!from) { toast('Bitte ein Datum wählen', { icon: 'info' }); return false; }
      if (to < from) to = from;
      const allDay = checked(sh.body, '#af-allday');
      const data = { ...d, from, to, allDay, hours: allDay ? null : Number(sh.body.querySelector('#af-hours').value), reason: sh.body.querySelector('#af-reason').value, excuse, dueBy: excuse === 'open' ? excuseDeadline(to, ctx) : null, note: val(sh.body, '#af-note') };
      if (it) await update(it.id, data);
      else {
        await save('absence', data);
        const missed = !isSchoolDay(from, ctx) && from === to ? 0 : lessonsInRange(from, to, ctx).length;
        toast(missed ? 'Fehltag eingetragen – denk an den verpassten Stoff' : 'Fehltag eingetragen', { icon: 'check' });
      }
    },
    onDelete: it ? async () => { await remove(it.id); } : null,
  });
  const repaintInfo = () => {
    const from = sheet.body.querySelector('#af-from').value;
    const to = sheet.body.querySelector('#af-to').value;
    if (from && to && to < from) sheet.body.querySelector('#af-to').value = from;
    sheet.body.querySelector('#af-info').innerHTML = String(info(from, sheet.body.querySelector('#af-to').value, checked(sheet.body, '#af-allday')));
  };
  sheet.body.querySelector('#af-from').addEventListener('change', (e) => {
    const toEl = sheet.body.querySelector('#af-to');
    if (!toEl.value || toEl.value < e.target.value) toEl.value = e.target.value;
    repaintInfo();
  });
  sheet.body.querySelector('#af-to').addEventListener('change', repaintInfo);
  sheet.body.querySelector('#af-allday').addEventListener('change', (e) => { sheet.body.querySelector('#af-hours-row').classList.toggle('hidden', e.target.checked); repaintInfo(); });
  sheet.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-excuse]');
    if (!b) return;
    excuse = b.dataset.excuse;
    sheet.body.querySelectorAll('[data-excuse]').forEach((x) => x.classList.toggle('active', x === b));
    sheet.markDirty();
  });
  return sheet;
}
