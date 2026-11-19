// Noten-Tab: Gesamtschnitt mit Trend, alle Fächer mit Schnitt, Prognose und Mini-Verlauf.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { settings } from '../store.js';
import { go, refresh } from '../router.js';
import { topbar, subjBadge, emptyState, progChip } from '../ui/components.js';
import { fmtAvg, runningAverages, overallAverage, TENDENCIES } from '../logic/grades.js';
import { today, addDays } from '../logic/dates.js';
import { overallStats, gradeView, viewRange, gradeYears } from '../grades-data.js';
import { sparkline } from '../ui/chart.js';

export const live = true;

export async function onFab() {
  (await import('../forms/grade-form.js')).openGradeForm();
}

/** Gesamtschnitt vor 30 Tagen (nur Noten bis dahin) – für den Trend. */
function trend(o, range) {
  const cut = addDays(today(), -30);
  if (cut < range.from) return null;
  const before = overallAverage(o.list.map((x) => {
    const gs = x.grades.filter((g) => g.date <= cut);
    const r = runningAverages(gs, x.written);
    return { avg: r.length ? r[r.length - 1].avg : null, main: !!x.subject.data.main };
  }), { mainDouble: !!settings().mainDouble }).avg;
  if (before == null || o.avg == null) return null;
  const diff = before - o.avg; // positiv = besser geworden
  return Math.abs(diff) < 0.05 ? { diff: 0 } : { diff };
}

export function render(el) {
  const range = viewRange();
  const o = overallStats(range);
  const s = settings();
  const withGrades = o.list.filter((x) => x.grades.length);
  const without = o.list.filter((x) => !x.grades.length);
  const nGrades = withGrades.reduce((n, x) => n + x.grades.length, 0);
  const tr = trend(o, range);
  const years = gradeYears();
  const tLabel = TENDENCIES.find((x) => Math.abs(x.value - s.tendency) < 0.01)?.label || '0,25';

  const row = (x) => {
    const sub = x.res.flat
      ? `${x.grades.length} ${x.grades.length === 1 ? 'Note' : 'Noten'}`
      : [x.res.written.count ? `schriftl. ${fmtAvg(x.res.written.avg)}` : '', x.res.oral.count ? `mündl. ${fmtAvg(x.res.oral.avg)}` : ''].filter(Boolean).join(' · ') + (x.res.provisional ? ' · vorläufig' : '');
    const ra = runningAverages(x.grades, x.written).map((r) => -r.avg);
    return html`<button class="subj-row" data-open="${x.subject.id}">${subjBadge(x.subject)}<span class="sr-main"><span class="sr-title" style="display:block">${x.subject.data.name}</span><span class="sr-sub" style="display:block">${sub}</span></span>${sparkline(ra.map((v) => -v))}<span class="sr-avg"><b>${fmtAvg(x.res.avg)}</b><small>Ø</small></span>${progChip(x.rep)}</button>`;
  };

  el.innerHTML = String(html`
    ${topbar({ title: 'Noten' })}
    <div class="page">
      <h1 class="large-title">Noten</h1>
      <p class="page-sub">Schuljahr ${range.year.label}${years.length > 1 ? html` · <button class="text-btn small" data-act="year" style="padding:0">anderes Schuljahr</button>` : ''}</p>
      <div class="seg" style="margin-bottom:14px">${[['h1', '1. Halbjahr'], ['h2', '2. Halbjahr'], ['year', 'Ganzes Jahr']].map(([k, l]) => html`<button class="${range.kind === k ? 'active' : ''}" data-term="${k}">${l}</button>`)}</div>
      ${o.list.length ? html`
        <div class="avg-hero">
          <div class="grow">
            <div class="lbl">Gesamtschnitt · ${range.label}</div>
            <div class="big" style="margin-top:6px">${o.avg != null ? fmtAvg(o.avg) : '–'}</div>
            <div class="muted" style="font-size:14px;margin-top:6px">${o.count ? `aus ${o.count} ${o.count === 1 ? 'Fach' : 'Fächern'} · ${nGrades} ${nGrades === 1 ? 'Note' : 'Noten'}` : 'Noch keine Noten in diesem Zeitraum'}${s.mainDouble ? ' · Hauptfächer doppelt' : ''}</div>
            ${tr && tr.diff ? html`<div class="trend ${tr.diff > 0 ? 'ok-text' : 'warn-text'}">${icon(tr.diff > 0 ? 'arrowUp' : 'arrowDown')} ${fmtAvg(Math.abs(tr.diff))} ${tr.diff > 0 ? 'besser' : 'schlechter'} als vor 30 Tagen</div>` : tr ? html`<div class="trend muted">${icon('minus')} gleich wie vor 30 Tagen</div>` : ''}
          </div>
          <span class="ico-tile lg" style="--c:var(--ok)">${icon('grades')}</span>
        </div>
        ${withGrades.length ? html`<div class="section"><div class="todo-group">${withGrades.map(row)}</div></div>` : ''}
        ${without.length ? html`<div class="section"><div class="group-label">Noch ohne Noten</div><div class="todo-group">${without.map((x) => html`<button class="subj-row" data-open="${x.subject.id}">${subjBadge(x.subject)}<span class="sr-main"><span class="sr-title">${x.subject.data.name}</span></span><span class="text-btn small" data-add="${x.subject.id}">${icon('plus')} Note</span></button>`)}</div></div>` : ''}
        <p class="muted" style="font-size:13px;margin:14px 4px 0">Plus und Minus zählen ${tLabel}. Die Zeugnisnote ist eine Prognose – bei genau x,5 entscheidet die Lehrkraft. <a href="#/settings">Einstellungen</a></p>`
      : emptyState({ icon: 'grades', title: 'Noch keine Fächer', text: 'Lege zuerst deine Fächer an, dann kannst du Noten eintragen.', action: html`<button class="btn primary" data-go="/subjects">${icon('book')} Fächer</button>` })}
    </div>`);

  const onClick = async (e) => {
    const tm = e.target.closest('[data-term]');
    if (tm) { gradeView.kind = tm.dataset.term; refresh(); return; }
    const add = e.target.closest('[data-add]');
    if (add) { e.stopPropagation(); (await import('../forms/grade-form.js')).openGradeForm({ subjectId: add.dataset.add }); return; }
    const op = e.target.closest('[data-open]');
    if (op) { go(`/grades/${op.dataset.open}`); return; }
    const g = e.target.closest('[data-go]');
    if (g) { go(g.dataset.go); return; }
    if (e.target.closest('[data-act="year"]')) {
      const { actionSheet } = await import('../ui/sheet.js');
      const v = await actionSheet({ title: 'Schuljahr', items: years.map((y) => ({ label: `Schuljahr ${y.label}`, value: y.start, selected: y.start === range.year.start })) });
      if (v) { gradeView.ref = addDays(v, 10); gradeView.kind = 'year'; refresh(); }
    }
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}
