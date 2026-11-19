// Fächerliste: anlegen, sortieren, archivieren.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, update } from '../store.js';
import { go, refresh } from '../router.js';
import { topbar, subjBadge, emptyState } from '../ui/components.js';
import { subjects } from '../model.js';
import { hoursPerWeek } from '../logic/timetable.js';
import { fmtAvg } from '../logic/grades.js';
import { currentTerm, subjectStats } from '../grades-data.js';

export const live = true;
const state = { sorting: false, showArchived: false };

export async function onFab() {
  const { openSubjectForm } = await import('../forms/subject-form.js');
  openSubjectForm();
}

function row(s, lessons, term) {
  const d = s.data;
  const h = hoursPerWeek(lessons, s.id);
  const st = subjectStats(s, term);
  const sub = [d.teacher, d.room ? `Raum ${d.room}` : '', h ? `${String(h).replace('.', ',')} Std./Woche` : ''].filter(Boolean).join(' · ');
  return html`<div class="subj-row" style="padding-right:6px">
    <button class="row grow" data-open="${s.id}" style="text-align:left;gap:12px">${subjBadge(s)}<span class="sr-main"><span class="sr-title" style="display:block">${d.name}${d.main ? html` <span class="pill" style="margin-left:4px">Hauptfach</span>` : ''}</span><span class="sr-sub" style="display:block">${sub || 'Tippen für Details'}</span></span>
    ${st.res.avg != null ? html`<span class="sr-avg"><b>${fmtAvg(st.res.avg)}</b><small>Ø</small></span>` : ''}</button>
    ${state.sorting ? html`<button class="icon-btn" data-up="${s.id}" aria-label="${d.name} nach oben">${icon('chevronUp')}</button><button class="icon-btn" data-down="${s.id}" aria-label="${d.name} nach unten">${icon('chevronDown')}</button>` : html`<span class="chev faint">${icon('chevron')}</span>`}
  </div>`;
}

export function render(el) {
  const list = subjects();
  const archived = all('subject').filter((s) => s.data.archived);
  const lessons = all('lesson').map((l) => l.data);
  const term = currentTerm();
  el.innerHTML = String(html`
    ${topbar({ title: 'Fächer', back: true, right: list.length > 1 ? html`<button class="text-btn" data-act="sort">${state.sorting ? 'Fertig' : 'Ordnen'}</button>` : '' })}
    <div class="page">
      <h1 class="large-title">Fächer</h1>
      <p class="page-sub">${list.length ? `${list.length} ${list.length === 1 ? 'Fach' : 'Fächer'}` : 'Lege deine Fächer an.'}</p>
      ${list.length ? html`<div class="todo-group">${list.map((s) => row(s, lessons, term))}</div>` : emptyState({ icon: 'book', title: 'Noch keine Fächer', text: 'Fächer brauchst du für Stundenplan, Hausaufgaben, Tests und Noten.', action: html`<button class="btn primary" data-act="new">${icon('plus')} Fach anlegen</button>` })}
      ${archived.length ? html`
        <div class="section">
          <button class="text-btn" data-act="archived">${icon(state.showArchived ? 'chevronDown' : 'chevron')} Archiv · ${archived.length}</button>
          ${state.showArchived ? html`<div class="todo-group" style="margin-top:8px">${archived.map((s) => html`<div class="subj-row">${subjBadge(s)}<span class="sr-main"><span class="sr-title">${s.data.name}</span></span><button class="text-btn small" data-restore="${s.id}">Zurückholen</button></div>`)}</div>` : ''}
        </div>` : ''}
    </div>`);

  const move = async (id, dir) => {
    const ids = list.map((s) => s.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    for (let k = 0; k < ids.length; k++) {
      const s = list.find((x) => x.id === ids[k]);
      if (s.data.order !== k) await update(s.id, { order: k });
    }
  };
  const onClick = async (e) => {
    const o = e.target.closest('[data-open]');
    if (o && !state.sorting) { go(`/subject/${o.dataset.open}`); return; }
    const up = e.target.closest('[data-up]');
    if (up) { move(up.dataset.up, -1); return; }
    const dn = e.target.closest('[data-down]');
    if (dn) { move(dn.dataset.down, 1); return; }
    const rs = e.target.closest('[data-restore]');
    if (rs) { await update(rs.dataset.restore, { archived: false }); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'sort') { state.sorting = !state.sorting; refresh(); }
    if (a.dataset.act === 'archived') { state.showArchived = !state.showArchived; refresh(); }
    if (a.dataset.act === 'new') onFab();
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}
