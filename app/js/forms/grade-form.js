// Note eintragen: Fach, Note (Tasten 1–6 mit +/−), Art, Kategorie, Gewicht, Datum – mit „Ø danach“.
import { html } from '../ui/dom.js';
import { save, update, remove, get, settings } from '../store.js';
import { toast, confirmDialog } from '../ui/sheet.js';
import { subjectById, examKind } from '../model.js';
import { GRADE_KINDS, gradeKind, parseGrade, fmtAvg, reportGrade, reportLabel, subjectAverage } from '../logic/grades.js';
import { today } from '../logic/dates.js';
import { currentTerm, subjectStats } from '../grades-data.js';
import { confetti, burstAt } from '../ui/fx.js';
import { formSheet, subjectCell, wireSubjectPicker, val, selectCell } from './kit.js';

const TEND = [
  { key: '+', label: '+' },
  { key: '', label: 'glatt' },
  { key: '-', label: '−' },
  { key: 'x', label: 'zwischen' },
];

/** Note aus Taste + Tendenz. */
function compose(base, tend) {
  if (!base) return '';
  if (tend === 'x') return base < 6 ? `${base}-${base + 1}` : String(base);
  if (tend === '-' && base === 6) return '6';
  return `${base}${tend}`;
}

export function openGradeForm({ id = null, subjectId = null, examId = null } = {}) {
  const it = id ? get(id) : null;
  const ex = !it && examId ? get(examId) : null;
  const t = settings().tendency;
  const ek = ex ? examKind(ex.data.kind) : null;
  const kindKey = it?.data.kind || ek?.gradeKind || 'ka';
  const d = it?.data || {
    subjectId: ex?.data.subjectId || subjectId || '',
    value: null,
    label: '',
    kind: kindKey,
    cat: gradeKind(kindKey).cat,
    weight: 1,
    date: ex?.data.date && ex.data.date <= today() ? ex.data.date : today(),
    title: ex?.data.title || '',
    examId: ex?.id || null,
  };
  // Startzustand der Tasten aus der vorhandenen Note
  let base = null, tend = '';
  const m = /^([1-6])([+−-]?)$/.exec(d.label || '') || /^([1-5])–([2-6])$/.exec(d.label || '');
  if (m) { base = +m[1]; tend = m[0].includes('–') ? 'x' : m[2] === '+' ? '+' : m[2] ? '-' : ''; }
  let free = base ? '' : d.label || '';
  let cat = d.cat;
  let weight = d.weight ?? 1;

  const current = () => {
    const raw = free || compose(base, tend);
    return parseGrade(raw, t);
  };

  const sheet = formSheet({
    title: it ? 'Note bearbeiten' : 'Neue Note',
    body: html`<div class="form">
      <div class="group">${subjectCell(d.subjectId)}</div>
      <div>
        <div class="group-label">Note</div>
        <div class="grade-pad" id="gf-pad">${[1, 2, 3, 4, 5, 6].map((n) => html`<button type="button" data-base="${n}" class="${base === n ? 'active' : ''}" aria-label="Note ${n}">${n}</button>`)}</div>
        <div class="tend-row" id="gf-tend">${TEND.map((x) => html`<button type="button" data-tend="${x.key}" class="${tend === x.key ? 'active' : ''}">${x.label}</button>`)}</div>
        <div class="group" style="margin-top:10px"><div class="cell"><label for="gf-free">oder tippen</label><input id="gf-free" value="${free}" placeholder="z. B. 2−, 2-3 oder 1,7" inputmode="text" autocomplete="off" class="right"></div></div>
        <div class="after-avg" id="gf-after" aria-live="polite"></div>
      </div>
      <div class="group">
        ${selectCell('gf-kind', 'Art', GRADE_KINDS.map((k) => ({ value: k.key, label: k.label })), d.kind)}
        <div class="cell"><span class="label">Zählt als</span><div class="seg grow" id="gf-cat">${[['written', 'Schriftlich'], ['oral', 'Mündlich']].map(([k, l]) => html`<button type="button" data-cat="${k}" class="${cat === k ? 'active' : ''}">${l}</button>`)}</div></div>
        <div class="cell"><span class="label">Gewicht</span><div class="seg grow" id="gf-weight">${[[0.5, '×½'], [1, '×1'], [2, '×2']].map(([k, l]) => html`<button type="button" data-weight="${k}" class="${weight === k ? 'active' : ''}">${l}</button>`)}</div></div>
        <div class="cell"><label for="gf-date">Datum</label><input type="date" id="gf-date" value="${d.date}"></div>
        <div class="cell"><label for="gf-title">Thema</label><input id="gf-title" value="${d.title || ''}" placeholder="optional" autocomplete="off"></div>
      </div>
    </div>`,
    onSave: async (sh) => {
      const g = current();
      const sid = sh.body.querySelector('[data-pick="subject"]').dataset.value;
      if (!sid) { toast('Bitte ein Fach wählen', { icon: 'info' }); return false; }
      if (!g) { toast('Bitte eine Note wählen', { icon: 'info' }); return false; }
      const data = { ...d, subjectId: sid, value: g.value, label: g.label, kind: sh.body.querySelector('#gf-kind').value, cat, weight, date: sh.body.querySelector('#gf-date').value || today(), title: val(sh.body, '#gf-title') };
      if (it) await update(it.id, data);
      else {
        const created = await save('grade', data);
        if (data.examId && get(data.examId)) await update(data.examId, { gradeId: created.id });
        if (g.value <= 1.5) confetti(60);
        else burstAt(sh.el.querySelector('[data-act="save"]'), 10);
        toast(`${g.label} in ${subjectById(sid)?.data.name || 'dem Fach'} eingetragen`, { icon: 'check' });
      }
    },
    onDelete: it ? async () => {
      if (!(await confirmDialog({ title: 'Note löschen?', ok: 'Löschen', danger: true }))) return false;
      if (d.examId && get(d.examId)?.data.gradeId === it.id) await update(d.examId, { gradeId: null });
      await remove(it.id);
    } : null,
  });

  const paintAfter = () => {
    const box = sheet.body.querySelector('#gf-after');
    const sid = sheet.body.querySelector('[data-pick="subject"]').dataset.value;
    const s = subjectById(sid);
    const g = current();
    sheet.body.querySelector('#gf-free').classList.toggle('danger-text', !!(free && !g));
    if (!s) { box.innerHTML = '<span class="muted">Wähle ein Fach, dann siehst du den neuen Schnitt.</span>'; return; }
    const date = sheet.body.querySelector('#gf-date').value || today();
    const term = currentTerm(date);
    const st = subjectStats(s, term);
    const others = st.grades.filter((x) => x.id !== it?.id);
    const before = subjectAverage(others, st.written).avg;
    const written = st.written;
    const after = g ? subjectAverage([...others, { value: g.value, cat, weight }], written).avg : null;
    const rep = reportGrade(after);
    box.innerHTML = String(html`<span>${term.label}: Ø ${fmtAvg(before)} → </span><b>${after != null ? fmtAvg(after) : '–'}</b><span class="muted">${rep ? `Zeugnis ${reportLabel(rep)}` : ''}</span>`);
  };
  paintAfter();

  sheet.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-base]');
    if (b) {
      base = +b.dataset.base;
      free = '';
      sheet.body.querySelector('#gf-free').value = '';
      sheet.body.querySelectorAll('[data-base]').forEach((x) => x.classList.toggle('active', x === b));
      sheet.markDirty();
      paintAfter();
      return;
    }
    const tb = e.target.closest('[data-tend]');
    if (tb) {
      tend = tb.dataset.tend;
      free = '';
      sheet.body.querySelector('#gf-free').value = '';
      sheet.body.querySelectorAll('[data-tend]').forEach((x) => x.classList.toggle('active', x === tb));
      sheet.markDirty();
      paintAfter();
      return;
    }
    const cb = e.target.closest('[data-cat]');
    if (cb) { cat = cb.dataset.cat; sheet.body.querySelectorAll('[data-cat]').forEach((x) => x.classList.toggle('active', x === cb)); sheet.markDirty(); paintAfter(); return; }
    const wb = e.target.closest('[data-weight]');
    if (wb) { weight = Number(wb.dataset.weight); sheet.body.querySelectorAll('[data-weight]').forEach((x) => x.classList.toggle('active', x === wb)); sheet.markDirty(); paintAfter(); }
  });
  sheet.body.querySelector('#gf-free').addEventListener('input', (e) => {
    free = e.target.value.trim();
    if (free) { base = null; sheet.body.querySelectorAll('[data-base]').forEach((x) => x.classList.remove('active')); }
    paintAfter();
  });
  sheet.body.querySelector('#gf-kind').addEventListener('change', (e) => {
    cat = gradeKind(e.target.value).cat;
    sheet.body.querySelectorAll('[data-cat]').forEach((x) => x.classList.toggle('active', x.dataset.cat === cat));
    paintAfter();
  });
  sheet.body.querySelector('#gf-date').addEventListener('change', paintAfter);
  wireSubjectPicker(sheet, { onChange: paintAfter });
  if (!it && !d.subjectId) setTimeout(() => sheet.body.querySelector('[data-pick="subject"]')?.click(), 420);
  return sheet;
}

