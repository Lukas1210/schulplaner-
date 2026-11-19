// Bausteine für Formulare in Sheets: Abbrechen/Sichern, Fach-Auswahl, Felder.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { openSheet, confirmDialog, actionSheet } from '../ui/sheet.js';
import { subjects, subjectById } from '../model.js';
import { subjBadge } from '../ui/components.js';

/**
 * Formular-Sheet. onSave(sheet) → false verhindert das Schließen. onDelete optional.
 */
export function formSheet({ title, body, onSave, saveLabel = 'Sichern', onDelete, deleteLabel = 'Löschen', full = false, focus = null, className = '' }) {
  let dirty = false;
  let busy = false;
  const sheet = openSheet({
    title,
    full,
    className: `form-sheet ${className}`,
    left: html`<button class="text-btn" data-act="cancel">Abbrechen</button>`,
    right: html`<button class="text-btn strong" data-act="save">${saveLabel}</button>`,
    body: html`${body}${onDelete ? html`<div style="margin-top:24px"><button class="btn danger block" data-act="delete">${icon('trash')} ${deleteLabel}</button></div>` : ''}`,
    beforeClose: async () => !dirty || (await confirmDialog({ title: 'Änderungen verwerfen?', ok: 'Verwerfen', danger: true })),
  });
  sheet.body.addEventListener('input', () => { dirty = true; });
  sheet.body.addEventListener('change', () => { dirty = true; });
  sheet.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || busy) return;
    if (b.dataset.act === 'cancel') sheet.close();
    else if (b.dataset.act === 'save') {
      busy = true;
      try {
        const ok = await onSave(sheet);
        if (ok !== false) sheet.close(true, true);
      } finally { busy = false; }
    } else if (b.dataset.act === 'delete' && onDelete) {
      busy = true;
      try {
        const ok = await onDelete(sheet);
        if (ok !== false) sheet.close(true, true);
      } finally { busy = false; }
    }
  });
  // Eingabetaste in einzeiligen Feldern sichert (praktisch mit iPad-Tastatur)
  sheet.body.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input[data-enter="save"]')) {
      e.preventDefault();
      sheet.el.querySelector('[data-act="save"]').click();
    }
  });
  sheet.markDirty = () => { dirty = true; };
  if (focus) setTimeout(() => sheet.body.querySelector(focus)?.focus(), 400);
  return sheet;
}

/** Zeile zum Auswählen eines Fachs. */
export function subjectCell(subjectId, { label = 'Fach', name = 'subject' } = {}) {
  const s = subjectById(subjectId);
  return html`<button type="button" class="cell link" data-pick="${name}" data-value="${subjectId || ''}">
    <span class="label">${label}</span>
    <span class="grow" style="text-align:right;display:flex;align-items:center;justify-content:flex-end;gap:8px" data-shown>${s ? html`${subjBadge(s, { size: 'sm' })}<span>${s.data.name}</span>` : html`<span class="faint">Wählen</span>`}</span>
    <span class="chev">${icon('chevron')}</span>
  </button>`;
}

/** Fach auswählen (Liste mit Kürzeln). Liefert die ID, '' für „ohne Fach“ oder undefined bei Abbruch. */
export async function pickSubject(current, { allowNone = false, title = 'Fach wählen' } = {}) {
  const items = subjects().map((s) => ({ label: s.data.name, value: s.id, badge: s.data.short, color: s.data.color, selected: s.id === current }));
  if (allowNone) items.push({ label: 'Ohne Fach', value: '', icon: 'minus', color: 'var(--text3)', selected: !current });
  if (!items.length || (items.length === 1 && allowNone)) {
    items.unshift({ label: 'Neues Fach anlegen', value: '__new', icon: 'plus' });
  } else items.push({ label: 'Neues Fach anlegen', value: '__new', icon: 'plus' });
  const v = await actionSheet({ title, items });
  if (v === '__new') {
    const { openSubjectForm } = await import('./subject-form.js');
    const created = await openSubjectForm();
    return created?.id;
  }
  return v;
}

/** Fach-Auswahl in einem Formular verdrahten; onChange(id) wird nach jeder Wahl aufgerufen. */
export function wireSubjectPicker(sheet, { name = 'subject', allowNone = false, onChange } = {}) {
  sheet.body.addEventListener('click', async (e) => {
    const cell = e.target.closest(`[data-pick="${name}"]`);
    if (!cell) return;
    const v = await pickSubject(cell.dataset.value, { allowNone });
    if (v === undefined) return;
    cell.dataset.value = v;
    const s = subjectById(v);
    cell.querySelector('[data-shown]').innerHTML = String(s ? html`${subjBadge(s, { size: 'sm' })}<span>${s.data.name}</span>` : html`<span class="faint">${allowNone ? 'Ohne Fach' : 'Wählen'}</span>`);
    sheet.markDirty?.();
    onChange && onChange(v);
  });
}

export const val = (root, sel) => root.querySelector(sel)?.value?.trim() ?? '';
export const checked = (root, sel) => !!root.querySelector(sel)?.checked;

export function toggleCell(id, label, on, sub = '') {
  return html`<label class="cell" for="${id}"><span class="grow">${label}${sub ? html`<span class="sub">${sub}</span>` : ''}</span><span class="toggle"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span></span></span></label>`;
}

export function selectCell(id, label, options, value) {
  return html`<label class="cell" for="${id}"><span class="label">${label}</span><select id="${id}">${options.map((o) => html`<option value="${o.value}" ${String(o.value) === String(value) ? 'selected' : ''}>${o.label}</option>`)}</select></label>`;
}
