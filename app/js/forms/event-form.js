// Termin anlegen/bearbeiten: Ausflug, Elternabend, unterrichtsfreier Tag …
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { save, update, remove, get } from '../store.js';
import { toast } from '../ui/sheet.js';
import { EVENT_KINDS } from '../model.js';
import { today } from '../logic/dates.js';
import { formSheet, val, checked, toggleCell, selectCell } from './kit.js';

export function openEventForm({ id = null, date = null, kind = 'event' } = {}) {
  const it = id ? get(id) : null;
  const d = it?.data || { title: '', kind, date: date || today(), endDate: null, allDay: true, time: '', endTime: '', notes: '' };
  const sheet = formSheet({
    title: it ? 'Termin' : 'Neuer Termin',
    focus: it ? null : '#ef-title',
    body: html`<div class="form">
      <div class="group"><div class="cell"><input id="ef-title" class="title-input" value="${d.title}" placeholder="z. B. Wandertag" autocomplete="off" data-enter="save"></div></div>
      <div class="group">
        ${selectCell('ef-kind', 'Art', EVENT_KINDS.map((k) => ({ value: k.key, label: k.label })), d.kind)}
        <div class="cell"><label for="ef-date">Datum</label><input type="date" id="ef-date" value="${d.date}"></div>
        <div class="cell"><label for="ef-end">Bis</label><input type="date" id="ef-end" value="${d.endDate || ''}" placeholder="optional"></div>
        ${toggleCell('ef-allday', 'Ganztägig', d.allDay !== false)}
        <div class="cell ${d.allDay !== false ? 'hidden' : ''}" id="ef-times"><label>Uhrzeit</label><input type="time" class="pill-input" id="ef-time" value="${d.time || ''}"><span class="faint">–</span><input type="time" class="pill-input" id="ef-endtime" value="${d.endTime || ''}"></div>
      </div>
      <div class="group-foot" id="ef-free-hint" ${d.kind === 'free' ? '' : 'hidden'}>${icon('palm')} An unterrichtsfreien Tagen zählen keine Stunden – auch nicht für „nächste Stunde“.</div>
      <div class="group"><div class="cell col"><label for="ef-notes">Notizen</label><textarea id="ef-notes" rows="3">${d.notes || ''}</textarea></div></div>
      ${it && d.kind !== 'free' ? html`<button type="button" class="btn block ghost" data-ics>${icon('calendarPlus')} In den iPhone-Kalender</button>` : ''}
    </div>`,
    onSave: async (sh) => {
      const title = val(sh.body, '#ef-title');
      const kindVal = sh.body.querySelector('#ef-kind').value;
      const date = sh.body.querySelector('#ef-date').value;
      if (!date) { toast('Bitte ein Datum wählen', { icon: 'info' }); return false; }
      if (!title && kindVal !== 'free') { toast('Bitte einen Titel eingeben', { icon: 'info' }); return false; }
      let endDate = sh.body.querySelector('#ef-end').value || null;
      if (endDate && endDate < date) endDate = null;
      const allDay = checked(sh.body, '#ef-allday');
      const data = { ...d, title: title || 'Unterrichtsfrei', kind: kindVal, date, endDate, allDay, time: allDay ? '' : sh.body.querySelector('#ef-time').value, endTime: allDay ? '' : sh.body.querySelector('#ef-endtime').value, notes: val(sh.body, '#ef-notes') };
      if (it) await update(it.id, data);
      else { await save('event', data); toast('Termin eingetragen', { icon: 'check' }); }
    },
    onDelete: it ? async () => { await remove(it.id); } : null,
  });
  sheet.body.querySelector('[data-ics]')?.addEventListener('click', async () => (await import('../ics.js')).exportEvent(get(it.id)));
  sheet.body.querySelector('#ef-allday').addEventListener('change', (e) => sheet.body.querySelector('#ef-times').classList.toggle('hidden', e.target.checked));
  sheet.body.querySelector('#ef-kind').addEventListener('change', (e) => { sheet.body.querySelector('#ef-free-hint').hidden = e.target.value !== 'free'; });
  return sheet;
}
