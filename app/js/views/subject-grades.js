// Noten eines Fachs: Schnitt, Zeugnis-Prognose, Noten je Kategorie, Verlauf und Zielnoten-Rechner.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get, settings } from '../store.js';
import { go, refresh } from '../router.js';
import { topbar, subjBadge, emptyState, gradeChip, progChip } from '../ui/components.js';
import { fmtAvg, runningAverages, requiredGrade, reportLabel, weightLabel, gradeKind, GRADE_KINDS, CATS } from '../logic/grades.js';
import { fmtShort } from '../logic/dates.js';
import { subjectStats, gradeView, viewRange } from '../grades-data.js';
import { gradeChart, wireChart } from '../ui/chart.js';
import { debounce } from '../ui/dom.js';

export const live = true;
const calc = { target: null, kind: 'ka', weight: 1 };

export async function onFab() {
  const id = location.hash.split('/')[2];
  (await import('../forms/grade-form.js')).openGradeForm({ subjectId: id });
}

function calcHtml(st, s) {
  const t = settings().tendency;
  const kind = gradeKind(calc.kind);
  const target = calc.target;
  const r = requiredGrade({ grades: st.grades, written: st.written, cat: kind.cat, weight: calc.weight, target, tendency: t });
  let result;
  if (r.status === 'need') result = html`<div class="calc-result">Du brauchst in der nächsten ${kind.label === 'Mündlich / Mitarbeit' ? 'mündlichen Note' : kind.label} mindestens eine <b>${r.label}</b>.<div class="muted" style="font-size:14px;margin-top:4px">Dann stehst du bei Ø ${fmtAvg(r.result)}.</div></div>`;
  else if (r.status === 'safe') result = html`<div class="calc-result good">Die ${target} ist dir sicher – selbst mit einer 6 bleibst du bei Ø ${fmtAvg(r.result)}.</div>`;
  else result = html`<div class="calc-result bad">Mit einer einzigen Note reicht es nicht mehr: Selbst mit einer ${r.bestLabel} kommst du nur auf Ø ${fmtAvg(r.best)}.<div class="muted" style="font-size:14px;margin-top:4px">Mehrere gute Noten – auch mündlich – können es noch drehen.</div></div>`;
  return html`<div class="card calc-card">
    <div class="row"><span class="ico-tile" style="--c:var(--accent2-ink)">${icon('target')}</span><b class="grow">Zielnoten-Rechner</b></div>
    <div class="group" style="margin-top:12px">
      <label class="cell" for="zc-target"><span class="label">Ziel im Zeugnis</span><select id="zc-target">${[1, 2, 3, 4, 5].map((n) => html`<option value="${n}" ${n === target ? 'selected' : ''}>${n}</option>`)}</select></label>
      <label class="cell" for="zc-kind"><span class="label">Nächste Note</span><select id="zc-kind">${GRADE_KINDS.filter((k) => k.key !== 'other').map((k) => html`<option value="${k.key}" ${k.key === calc.kind ? 'selected' : ''}>${k.label}</option>`)}</select></label>
      <label class="cell" for="zc-weight"><span class="label">Gewicht</span><select id="zc-weight">${[[0.5, '×½'], [1, '×1'], [2, '×2']].map(([k, l]) => html`<option value="${k}" ${k === calc.weight ? 'selected' : ''}>${l}</option>`)}</select></label>
    </div>
    ${result}
    <p class="muted" style="font-size:12.5px;margin-top:8px">Gilt für ${viewRange().label}${s.data.target ? '' : ' · Tipp: Unter „Fach“ kannst du eine feste Zielnote speichern'}.</p>
  </div>`;
}

export function render(el, { id }) {
  const s = get(id);
  if (!s || s.type !== 'subject') {
    el.innerHTML = String(html`${topbar({ back: true })}<div class="page">${emptyState({ icon: 'grades', title: 'Fach nicht gefunden' })}</div>`);
    return;
  }
  const range = viewRange();
  const st = subjectStats(s, range);
  const t = settings().tendency;
  if (calc.subject !== id) {
    calc.subject = id;
    calc.target = s.data.target || (st.rep ? Math.max(1, st.rep.grade - (st.rep.alt && st.rep.alt < st.rep.grade ? 1 : 0)) : 2);
    calc.kind = 'ka';
    calc.weight = 1;
  }
  const byCat = (c) => st.grades.filter((g) => (st.res.flat ? true : c === 'written' ? g.cat === 'written' : g.cat !== 'written'));
  const chipList = (list) => html`<div class="grade-chips">${list.map((g) => gradeChip(g, t, { meta: `${gradeKind(g.kind).short} · ${fmtShort(g.date)}` }))}</div>`;
  const points = runningAverages(st.grades, st.written).map((p) => ({ ...p, label: p.grade.label, kind: gradeKind(p.grade.kind).label }));
  const cats = st.res.flat ? [['all', 'Alle Noten', null]] : [['written', CATS.written.long, st.written], ['oral', CATS.oral.long, 100 - st.written]];

  el.innerHTML = String(html`
    ${topbar({ title: s.data.name, back: true, backLabel: 'Noten', fallback: '/grades', right: html`<button class="text-btn" data-go="/subject/${id}">Fach</button>` })}
    <div class="page">
      <div class="detail-head">${subjBadge(s, { size: 'lg' })}<div class="grow"><h1>${s.data.name}</h1><button class="dh-sub text-btn small" data-act="weights" style="padding:0;color:var(--text2)">${weightLabel(st.written)} ${icon('edit')}</button></div></div>
      <div class="seg" style="margin:12px 0 14px">${[['h1', '1. Halbjahr'], ['h2', '2. Halbjahr'], ['year', 'Ganzes Jahr']].map(([k, l]) => html`<button class="${range.kind === k ? 'active' : ''}" data-term="${k}">${l}</button>`)}</div>
      <div class="stat-grid">
        <div class="stat"><span class="s-label">Schnitt${st.res.provisional ? ' (vorläufig)' : ''}</span><b>${fmtAvg(st.res.avg)}</b><span class="s-label">${st.grades.length} ${st.grades.length === 1 ? 'Note' : 'Noten'}</span></div>
        <div class="stat"><span class="s-label">Zeugnis voraussichtlich</span><b>${st.rep ? reportLabel(st.rep) : '–'}</b><span class="s-label">${st.rep?.alt ? `wackelt zwischen ${Math.min(st.rep.grade, st.rep.alt)} und ${Math.max(st.rep.grade, st.rep.alt)}` : st.rep ? 'ziemlich sicher' : 'noch keine Noten'}</span></div>
      </div>
      ${st.res.provisional ? html`<p class="muted" style="font-size:13px;margin:8px 4px 0">${icon('info')} Vorläufig: Es gibt erst Noten in einer Kategorie, deshalb zählt diese voll.</p>` : ''}

      <div class="cols">
        <div>
          ${st.grades.length ? cats.map(([c, label, pct]) => {
            const list = c === 'all' ? st.grades : byCat(c);
            const avg = c === 'all' ? st.res.avg : c === 'written' ? st.res.written.avg : st.res.oral.avg;
            return html`<div class="section" style="margin-top:20px"><div class="cat-head"><b>${label}${pct != null ? ` · ${Math.round(pct)} %` : ''}</b><span>${list.length ? `Ø ${fmtAvg(avg)}` : 'noch keine'}</span></div>${list.length ? chipList(list) : html`<p class="muted" style="margin:0;font-size:14px">Noch keine Noten in dieser Kategorie.</p>`}</div>`;
          }) : html`<div class="section">${emptyState({ icon: 'grades', title: `Noch keine Noten in ${range.label}`, text: 'Trag deine erste Note ein – Schnitt, Prognose und Verlauf rechnen sich dann von selbst.', small: true })}</div>`}
          <div class="section"><button class="btn block primary" data-act="add">${icon('plus')} Note eintragen</button></div>
        </div>
        <div>
          ${points.length >= 2 ? html`<div class="section"><div class="section-head"><h2 class="section-title small">Verlauf</h2></div><div class="card" id="chart-slot"></div></div>` : ''}
          <div class="section">${calcHtml(st, s)}</div>
        </div>
      </div>
    </div>`);

  const offChart = wireChart(el);
  const onClick = async (e) => {
    const tm = e.target.closest('[data-term]');
    if (tm) { gradeView.kind = tm.dataset.term; refresh(); return; }
    const gc = e.target.closest('[data-grade]');
    if (gc) { (await import('../forms/grade-form.js')).openGradeForm({ id: gc.dataset.grade }); return; }
    const g = e.target.closest('[data-go]');
    if (g) { go(g.dataset.go); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'add') (await import('../forms/grade-form.js')).openGradeForm({ subjectId: id });
    if (a.dataset.act === 'weights') (await import('../forms/subject-form.js')).openSubjectForm(id);
  };
  const onChange = (e) => {
    if (e.target.id === 'zc-target') calc.target = Number(e.target.value);
    else if (e.target.id === 'zc-kind') calc.kind = e.target.value;
    else if (e.target.id === 'zc-weight') calc.weight = Number(e.target.value);
    else return;
    const card = el.querySelector('.calc-card');
    card.outerHTML = String(calcHtml(subjectStats(get(id), viewRange()), get(id)));
  };
  const paintChart = () => {
    const slot = el.querySelector('#chart-slot');
    if (!slot) return;
    slot.innerHTML = String(gradeChart(points, { target: s.data.target || null, tendency: t, width: slot.clientWidth - 32, title: `Notenverlauf ${s.data.name}` }));
  };
  paintChart();
  const onResize = debounce(paintChart, 200);
  el.addEventListener('click', onClick);
  el.addEventListener('change', onChange);
  window.addEventListener('resize', onResize);
  return () => {
    offChart();
    el.removeEventListener('click', onClick);
    el.removeEventListener('change', onChange);
    window.removeEventListener('resize', onResize);
  };
}

