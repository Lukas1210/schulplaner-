// Stundenplan bearbeiten: Raster antippen oder mit einem Fach „malen“, Stundenzeiten, Schultage, A/B-Wochen.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, save, update, removeMany, settings, saveSettings } from '../store.js';
import { topbar, subjBadge, emptyState } from '../ui/components.js';
import { openSheet, toast, confirmDialog } from '../ui/sheet.js';
import { subjects, subjectById } from '../model.js';
import { ttGrid } from '../ui/tt-grid.js';
import { periodsOf, generatePeriods, weekType, refForWeek, schoolDays } from '../logic/timetable.js';
import { WEEKDAYS_SHORT, today, timeToMin } from '../logic/dates.js';
import { formSheet, subjectCell, wireSubjectPicker, val, toggleCell } from '../forms/kit.js';

export const live = true;
const state = { paint: null, week: 'A' };

const lessonItems = () => all('lesson');
/** Stunden in einer Zelle, passend zur gezeigten Woche. */
function cellLessons(day, period, s) {
  return lessonItems().filter((l) => l.data.day === day && l.data.period === period && (!s.abWeeks || !l.data.week || l.data.week === 'all' || l.data.week === state.week));
}

function cellContent(l, subj, s) {
  const sb = subj.get(l.data.subjectId);
  return html`<span class="tc-name"><span class="tc-short">${sb?.data.short || '?'}</span><span class="tc-long">${sb?.data.name || '?'}</span></span><span class="tc-room">${l.data.room || sb?.data.room || ''}</span>${s.abWeeks && l.data.week && l.data.week !== 'all' ? html`<span class="tc-week">${l.data.week}</span>` : ''}`;
}

/** Zelle bearbeiten: Fach, Raum, Woche, Doppelstunde. */
function openCellSheet(day, period) {
  const s = settings();
  const existing = cellLessons(day, period, s)[0];
  const d = existing?.data || { subjectId: '', room: '', week: 'all' };
  const per = periodsOf(s)[period - 1];
  const sheet = formSheet({
    title: `${WEEKDAYS_SHORT[day - 1]}, ${period}. Stunde`,
    body: html`<div class="form">
      ${per ? html`<p class="muted center">${per.start} – ${per.end}</p>` : ''}
      <div class="group">
        ${subjectCell(d.subjectId)}
        <div class="cell"><label for="tc-room">Raum</label><input id="tc-room" value="${d.room || ''}" placeholder="${subjectById(d.subjectId)?.data.room || 'optional'}" autocomplete="off"></div>
        ${s.abWeeks ? html`<label class="cell" for="tc-week"><span class="label">Gilt für</span><select id="tc-week">${[['all', 'Beide Wochen'], ['A', 'Nur A-Woche'], ['B', 'Nur B-Woche']].map(([k, l]) => html`<option value="${k}" ${(d.week || 'all') === k ? 'selected' : ''}>${l}</option>`)}</select></label>` : ''}
        ${existing ? '' : toggleCell('tc-double', 'Doppelstunde', false, `Auch die ${period + 1}. Stunde`)}
      </div>
    </div>`,
    onSave: async (sh) => {
      const subjectId = sh.body.querySelector('[data-pick="subject"]').dataset.value;
      if (!subjectId) { toast('Bitte ein Fach wählen', { icon: 'info' }); return false; }
      const week = sh.body.querySelector('#tc-week')?.value || 'all';
      const data = { subjectId, day, period, room: val(sh.body, '#tc-room'), week };
      if (existing) await update(existing.id, data);
      else await save('lesson', data);
      if (sh.body.querySelector('#tc-double')?.checked && period < periodsOf(s).length) {
        const next = cellLessons(day, period + 1, s);
        await removeMany(next.map((x) => x.id));
        await save('lesson', { ...data, period: period + 1 });
      }
    },
    onDelete: existing ? async () => { await removeMany([existing.id]); } : null,
    deleteLabel: 'Stunde entfernen',
  });
  wireSubjectPicker(sheet);
  if (!existing) setTimeout(() => sheet.body.querySelector('[data-pick="subject"]')?.click(), 420);
}

/** Stundenzeiten: Generator + einzelne Zeiten. */
function openPeriodsSheet() {
  const s = settings();
  let periods = periodsOf(s).map((p) => ({ ...p }));
  const listHtml = () => html`${periods.map((p, i) => html`<div class="cell"><span class="label" style="min-width:64px">${i + 1}. Std.</span><input type="time" class="pill-input" data-i="${i}" data-f="start" value="${p.start}"><span class="faint">–</span><input type="time" class="pill-input" data-i="${i}" data-f="end" value="${p.end}"></div>`)}`;
  const sheet = formSheet({
    title: 'Stundenzeiten',
    full: true,
    body: html`<div class="form">
      <div>
        <div class="group-label">Schnell erzeugen</div>
        <div class="group">
          <div class="cell"><label for="pg-start">1. Stunde ab</label><input type="time" id="pg-start" class="pill-input" value="${periods[0]?.start || '08:00'}"></div>
          <div class="cell"><label for="pg-len">Länge</label><select id="pg-len">${[45, 60, 67, 90].map((m) => html`<option value="${m}" ${timeToMin(periods[0]?.end) - timeToMin(periods[0]?.start) === m ? 'selected' : ''}>${m} Minuten</option>`)}</select></div>
          <div class="cell"><label for="pg-gap">Kleine Pause</label><select id="pg-gap">${[0, 5, 10].map((m) => html`<option value="${m}" ${m === 5 ? 'selected' : ''}>${m} Minuten</option>`)}</select></div>
          <div class="cell"><label for="pg-count">Stunden</label><select id="pg-count">${[6, 7, 8, 9, 10, 11, 12].map((m) => html`<option value="${m}" ${m === periods.length ? 'selected' : ''}>${m}</option>`)}</select></div>
          <button class="cell link" data-gen><span class="grow ink">Zeiten neu berechnen</span><span class="chev">${icon('refresh')}</span></button>
        </div>
        <div class="group-foot">Große Pausen: 20 Min. nach der 2., 15 Min. nach der 4. und 45 Min. nach der 6. Stunde – danach einzeln anpassen.</div>
      </div>
      <div>
        <div class="group-label">Schultage</div>
        <div class="seg" id="pg-days">${[[5, 'Mo – Fr'], [6, 'Mo – Sa']].map(([n, l]) => html`<button class="${schoolDays(s) === n ? 'active' : ''}" data-days="${n}">${l}</button>`)}</div>
      </div>
      <div>
        <div class="group-label">Zeiten</div>
        <div class="group" id="pg-list">${listHtml()}</div>
      </div>
    </div>`,
    onSave: async (sh) => {
      const days = Number(sh.body.querySelector('#pg-days .active')?.dataset.days || 5);
      const bad = periods.some((p) => !p.start || !p.end || p.end <= p.start);
      if (bad) { toast('Bitte alle Zeiten prüfen', { icon: 'info' }); return false; }
      await saveSettings({ periods, days });
    },
  });
  sheet.body.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.i != null) periods[+t.dataset.i][t.dataset.f] = t.value;
  });
  sheet.body.addEventListener('click', (e) => {
    if (e.target.closest('[data-gen]')) {
      periods = generatePeriods({ start: val(sheet.body, '#pg-start') || '08:00', length: Number(val(sheet.body, '#pg-len')), gap: Number(val(sheet.body, '#pg-gap')), count: Number(val(sheet.body, '#pg-count')) });
      sheet.body.querySelector('#pg-list').innerHTML = String(listHtml());
      sheet.markDirty();
    }
    const dd = e.target.closest('[data-days]');
    if (dd) {
      sheet.body.querySelectorAll('[data-days]').forEach((b) => b.classList.toggle('active', b === dd));
      sheet.markDirty();
    }
  });
}


/**
 * Malen/Leeren einer Zelle. Mit A/B-Wochen wird nur die gerade bearbeitete Woche verändert:
 * Eine Stunde für „beide Wochen“ wird dabei in die andere Woche verschoben.
 */
async function paintCell(day, period, subjectId, s) {
  const inCell = lessonItems().filter((l) => l.data.day === day && l.data.period === period);
  if (!s.abWeeks) {
    if (subjectId !== 'erase' && inCell.length === 1 && inCell[0].data.subjectId === subjectId) { await removeMany([inCell[0].id]); return; }
    await removeMany(inCell.map((x) => x.id));
    if (subjectId !== 'erase') await save('lesson', { subjectId, day, period, room: '', week: 'all' });
    return;
  }
  const W = state.week;
  const other = W === 'A' ? 'B' : 'A';
  const both = inCell.find((l) => !l.data.week || l.data.week === 'all');
  const mine = inCell.find((l) => l.data.week === W);
  const theirs = inCell.find((l) => l.data.week === other);
  if (subjectId === 'erase' || (both && both.data.subjectId === subjectId) || (mine && mine.data.subjectId === subjectId)) {
    if (both) await update(both.id, { week: other });
    if (mine) await removeMany([mine.id]);
    return;
  }
  if (both) await update(both.id, { week: other });
  if (mine) await removeMany([mine.id]);
  if (!both && theirs && theirs.data.subjectId === subjectId) { await update(theirs.id, { week: 'all' }); return; }
  const week = both || theirs ? W : 'all';
  await save('lesson', { subjectId, day, period, room: '', week });
}

function paint(el) {
  const s = settings();
  const periods = periodsOf(s);
  const subjList = subjects();
  const subj = new Map(subjects({ archived: true }).map((x) => [x.id, x]));
  const nDays = schoolDays(s);
  const days = Array.from({ length: nDays }, (_, i) => ({ key: i + 1, title: WEEKDAYS_SHORT[i] }));
  const used = lessonItems().reduce((m, l) => Math.max(m, l.data.period || 0), 0);
  const rows = Math.min(periods.length, Math.max(6, used + 1));
  const cw = s.abWeeks ? weekType(today(), s) : null;

  const grid = ttGrid({
    days,
    periods,
    rows,
    cells: (d) => {
      const out = [];
      for (let p = 1; p <= rows; p++) {
        const l = cellLessons(d.key, p, s)[0];
        if (!l) continue;
        const sb = subj.get(l.data.subjectId);
        out.push({ from: p, to: p, content: cellContent(l, subj, s), cls: 'filled', style: `--c:${sb?.data.color || '#5A6B7B'}`, attrs: html`data-cell="${d.key}:${p}" aria-label="${WEEKDAYS_SHORT[d.key - 1]} ${p}. Stunde: ${sb?.data.name || ''}"` });
      }
      return out;
    },
    empty: (d, p) => ({ content: '', cls: 'empty-cell', attrs: html`data-cell="${d.key}:${p}" aria-label="${WEEKDAYS_SHORT[d.key - 1]} ${p}. Stunde: frei"` }),
  });

  el.innerHTML = String(html`
    ${topbar({ title: 'Stundenplan', back: true, right: html`<button class="text-btn" data-act="times">Zeiten</button>` })}
    <div class="page">
      <h1 class="large-title">Stundenplan</h1>
      <p class="page-sub">${subjList.length ? (state.paint ? 'Malen: Tippe auf die Stunden für das gewählte Fach.' : 'Tippe auf eine Stunde oder wähle unten ein Fach zum Malen.') : 'Lege zuerst deine Fächer an.'}</p>
      ${!subjList.length ? emptyState({ icon: 'book', title: 'Noch keine Fächer', text: 'Ohne Fächer kann ich keinen Stundenplan bauen.', action: html`<button class="btn primary" data-act="new-subject">${icon('plus')} Fach anlegen</button>` }) : html`
        <div class="group" style="margin-bottom:14px">
          ${toggleCell('tt-ab', 'A/B-Wochen', s.abWeeks, s.abWeeks ? `Diese Woche ist eine ${cw}-Woche` : 'Für Stundenpläne, die sich wöchentlich abwechseln')}
          ${s.abWeeks ? html`<button class="cell link" data-act="swap-week"><span class="grow ink">Diese Woche ist eigentlich eine ${cw === 'A' ? 'B' : 'A'}-Woche</span></button>` : ''}
        </div>
        ${s.abWeeks ? html`<div class="seg" style="margin-bottom:12px">${['A', 'B'].map((w) => html`<button class="${state.week === w ? 'active' : ''}" data-week="${w}">${w}-Woche bearbeiten</button>`)}</div>` : ''}
        ${grid}
        <div class="paint-bar" role="toolbar" aria-label="Fach zum Malen">
          <div class="chips">
            <button class="chip ${state.paint === 'erase' ? 'active' : ''}" data-paint="erase">${icon('trash')} Leeren</button>
            ${subjList.map((x) => html`<button class="chip ${state.paint === x.id ? 'active' : ''}" data-paint="${x.id}"><span class="subj-dot" style="--c:${x.data.color}"></span>${x.data.short} · ${x.data.name}</button>`)}
          </div>
        </div>`}
    </div>`);
}

export function render(el) {
  paint(el);
  const onClick = async (e) => {
    const s = settings();
    const pt = e.target.closest('[data-paint]');
    if (pt) { state.paint = state.paint === pt.dataset.paint ? null : pt.dataset.paint; paint(el); return; }
    const wk = e.target.closest('[data-week]');
    if (wk) { state.week = wk.dataset.week; paint(el); return; }
    const c = e.target.closest('[data-cell]');
    if (c) {
      const [day, period] = c.dataset.cell.split(':').map(Number);
      if (!state.paint) { openCellSheet(day, period); return; }
      await paintCell(day, period, state.paint, s);
      return;
    }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'times') openPeriodsSheet();
    if (a.dataset.act === 'new-subject') { const { openSubjectForm } = await import('../forms/subject-form.js'); openSubjectForm(); }
    if (a.dataset.act === 'swap-week') {
      const cw = weekType(today(), s);
      await saveSettings({ abRef: refForWeek(today(), cw === 'A' ? 'B' : 'A') });
      toast(`Diese Woche ist jetzt eine ${cw === 'A' ? 'B' : 'A'}-Woche`, { icon: 'repeat' });
    }
  };
  const onChange = async (e) => {
    if (e.target.id === 'tt-ab') {
      const on = e.target.checked;
      if (!on && all('lesson').some((l) => l.data.week === 'B')) {
        const ok = await confirmDialog({ title: 'A/B-Wochen ausschalten?', message: 'Stunden, die nur in B-Wochen stattfinden, werden dann nicht mehr angezeigt. Sie bleiben gespeichert.', ok: 'Ausschalten' });
        if (!ok) { e.target.checked = true; return; }
      }
      await saveSettings({ abWeeks: on, abRef: settings().abRef || refForWeek(today(), 'A') });
    }
  };
  el.addEventListener('click', onClick);
  el.addEventListener('change', onChange);
  return () => { el.removeEventListener('click', onClick); el.removeEventListener('change', onChange); };
}
