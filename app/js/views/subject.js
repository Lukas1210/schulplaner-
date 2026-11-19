// Fach-Seite: alles zu einem Fach – Stunden, Hausaufgaben, Tests, Noten, Karteikarten, Fehlstunden.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, get, update } from '../store.js';
import { go } from '../router.js';
import { topbar, subjBadge, emptyState, sectionHead, progChip, ampBar } from '../ui/components.js';
import { subjects, timetableCtx, examKind } from '../model.js';
import { hoursPerWeek, nextLessonDate, periodsOf } from '../logic/timetable.js';
import { fmtAvg } from '../logic/grades.js';
import { examProgress } from '../logic/plan.js';
import { today, fmtDay, relDay, WEEKDAYS_SHORT, daysBetween } from '../logic/dates.js';
import { currentTerm, subjectStats } from '../grades-data.js';
import { taskRow, wireTasks } from './task-row.js';
import { toast } from '../ui/sheet.js';

export const live = true;

function lessonSummary(lessons, s) {
  const byDay = new Map();
  for (const l of lessons.filter((x) => x.subjectId === s.id).sort((a, b) => a.day - b.day || a.period - b.period)) {
    if (!byDay.has(l.day)) byDay.set(l.day, []);
    byDay.get(l.day).push(l);
  }
  const parts = [];
  for (const [day, ls] of byDay) {
    const ps = ls.map((l) => l.period);
    const ranges = [];
    for (const p of ps) {
      const last = ranges[ranges.length - 1];
      if (last && last[1] === p - 1) last[1] = p; else ranges.push([p, p]);
    }
    const week = ls.every((l) => l.week === 'A') ? ' (A)' : ls.every((l) => l.week === 'B') ? ' (B)' : '';
    parts.push(`${WEEKDAYS_SHORT[day - 1]} ${ranges.map(([a, b]) => (a === b ? `${a}.` : `${a}.–${b}.`)).join(', ')}${week}`);
  }
  return parts.join(' · ');
}

export async function onFab() {
  const id = location.hash.split('/')[2];
  const { actionSheet } = await import('../ui/sheet.js');
  const v = await actionSheet({ title: 'Neu', items: [
    { label: 'Hausaufgabe', icon: 'tasks', value: 'task' },
    { label: 'Test', icon: 'learn', value: 'exam' },
    { label: 'Note', icon: 'grades', value: 'grade' },
    { label: 'Karteikarten', icon: 'cards', value: 'deck' },
  ] });
  if (v === 'task') (await import('../forms/task-form.js')).openTaskForm({ subjectId: id });
  if (v === 'exam') (await import('../forms/exam-form.js')).openExamForm({ subjectId: id });
  if (v === 'grade') (await import('../forms/grade-form.js')).openGradeForm({ subjectId: id });
  if (v === 'deck') (await import('../forms/deck-form.js')).openDeckForm({ subjectId: id });
}

export function render(el, { id }) {
  const s = get(id);
  if (!s || s.type !== 'subject') {
    el.innerHTML = String(html`${topbar({ back: true })}<div class="page">${emptyState({ icon: 'book', title: 'Fach nicht gefunden' })}</div>`);
    return;
  }
  const d = s.data;
  const t = today();
  const ctx = timetableCtx();
  const subj = new Map(subjects({ archived: true }).map((x) => [x.id, x]));
  const h = hoursPerWeek(ctx.lessons, s.id);
  const next = nextLessonDate(s.id, t, ctx);
  const st = subjectStats(s, currentTerm(t));
  const tasks = all('task').filter((x) => x.data.subjectId === id && !x.data.done).sort((a, b) => String(a.data.due || '9999').localeCompare(String(b.data.due || '9999')));
  const exams = all('exam').filter((x) => x.data.subjectId === id && (!x.data.date || x.data.date >= t)).sort((a, b) => String(a.data.date || '9999').localeCompare(String(b.data.date || '9999')));
  const decks = all('deck').filter((x) => x.data.subjectId === id);
  const cards = all('card');
  const summary = lessonSummary(ctx.lessons, s);
  const periods = periodsOf(ctx.settings);

  el.innerHTML = String(html`
    ${topbar({ title: d.name, back: true, right: html`<button class="text-btn" data-act="edit">Bearbeiten</button>` })}
    <div class="page">
      <div class="detail-head">${subjBadge(s, { size: 'lg' })}<div class="grow"><h1>${d.name}</h1><div class="dh-sub">${[d.teacher, d.room ? `Raum ${d.room}` : '', d.main ? 'Hauptfach' : ''].filter(Boolean).join(' · ') || 'Lehrkraft und Raum unter „Bearbeiten“'}</div></div></div>
      <div class="fact-row">
        <button class="fact" data-go="/grades/${id}" style="text-align:left"><div class="k">Schnitt</div><div class="v">${st.res.avg != null ? fmtAvg(st.res.avg) : '–'}</div></button>
        <button class="fact" data-go="/grades/${id}" style="text-align:left"><div class="k">Zeugnis</div><div class="v">${progChip(st.rep)}</div></button>
        <div class="fact"><div class="k">Pro Woche</div><div class="v">${h ? `${String(h).replace('.', ',')} Std.` : '–'}</div></div>
        <div class="fact"><div class="k">Nächste Stunde</div><div class="v">${next ? (daysBetween(t, next) <= 2 ? relDay(next, t) : fmtDay(next)) : '–'}</div></div>
      </div>
      ${summary ? html`<p class="muted" style="margin:12px 2px 0;font-size:14px">${icon('clock')} ${summary}${periods.length ? '' : ''}</p>` : html`<button class="notice" data-go="/timetable" style="margin-top:12px">${icon('grid')}<span class="grow">Noch nicht im Stundenplan</span><span class="chev faint">${icon('chevron')}</span></button>`}

      <div class="cols">
        <div>
          <div class="section">${sectionHead('Hausaufgaben', html`<button class="section-link" data-act="add-task">${icon('plus')} Neu</button>`)}
            ${tasks.length ? html`<div class="todo-group">${tasks.map((x) => taskRow(x, subj, t, { showSubject: false }))}</div>` : html`<p class="muted" style="margin:0 4px">Keine offenen Hausaufgaben.</p>`}
          </div>
          <div class="section">${sectionHead('Tests & Lernziele', html`<button class="section-link" data-act="add-exam">${icon('plus')} Neu</button>`)}
            ${exams.length ? html`<div class="list">${exams.map((x) => {
              const p = examProgress(x.data);
              return html`<button class="exam-card" data-exam="${x.id}"><div class="ex-top"><div class="grow"><div class="ex-title">${examKind(x.data.kind).label}${x.data.title ? `: ${x.data.title}` : ''}</div><div class="ex-meta">${x.data.date ? `${fmtDay(x.data.date)} · ${relDay(x.data.date, t)}` : 'ohne Termin'} · ${p.total ? `${p.green}/${p.total} sitzen` : 'kein Lernstoff'}</div></div></div>${p.total ? ampBar(p) : ''}</button>`;
            })}</div>` : html`<p class="muted" style="margin:0 4px">Keine anstehenden Tests.</p>`}
          </div>
        </div>
        <div>
          <div class="section">${sectionHead('Noten', html`<a class="section-link" href="#/grades/${id}">Alle</a>`)}
            <button class="card card-link" data-go="/grades/${id}" style="width:100%;text-align:left"><div class="row"><div class="grow"><div class="kicker">${currentTerm(t).label}</div><div style="font-family:var(--font-round);font-size:28px;font-weight:800">${st.res.avg != null ? fmtAvg(st.res.avg) : '–'}</div><div class="muted" style="font-size:14px">${st.grades.length} ${st.grades.length === 1 ? 'Note' : 'Noten'}${st.res.provisional ? ' · vorläufig' : ''}</div></div>${progChip(st.rep)}</div></button>
          </div>
          <div class="section">${sectionHead('Karteikarten', html`<button class="section-link" data-act="add-deck">${icon('plus')} Neu</button>`)}
            ${decks.length ? html`<div class="list">${decks.map((k) => {
              const n = cards.filter((c) => c.data.deckId === k.id).length;
              return html`<button class="deck-card" data-go="/deck/${k.id}">${icon('cards')}<span class="grow"><span class="dc-title" style="display:block">${k.data.name}</span><span class="dc-sub" style="display:block">${n} ${n === 1 ? 'Karte' : 'Karten'}</span></span><span class="chev faint">${icon('chevron')}</span></button>`;
            })}</div>` : html`<p class="muted" style="margin:0 4px">Noch keine Kartenstapel.</p>`}
          </div>
        </div>
      </div>

      <div class="section">
        <button class="btn block" data-act="archive">${d.archived ? 'Aus dem Archiv holen' : 'Fach archivieren'}</button>
        <p class="muted center" style="font-size:13px;margin-top:8px">Archivierte Fächer verschwinden aus Listen, Noten bleiben erhalten.</p>
      </div>
    </div>`);

  const offTasks = wireTasks(el);
  const onClick = async (e) => {
    const g = e.target.closest('[data-go]');
    if (g) { go(g.dataset.go); return; }
    const ex = e.target.closest('[data-exam]');
    if (ex) { go(`/exam/${ex.dataset.exam}`); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    switch (a.dataset.act) {
      case 'edit': {
        const { openSubjectForm } = await import('../forms/subject-form.js');
        const r = await openSubjectForm(id);
        if (r === null) go('/subjects', { replace: true });
        break;
      }
      case 'add-task': (await import('../forms/task-form.js')).openTaskForm({ subjectId: id }); break;
      case 'add-exam': (await import('../forms/exam-form.js')).openExamForm({ subjectId: id }); break;
      case 'add-deck': (await import('../forms/deck-form.js')).openDeckForm({ subjectId: id }); break;
      case 'archive':
        await update(id, { archived: !d.archived });
        toast(d.archived ? 'Fach ist wieder aktiv' : 'Fach archiviert', { icon: 'check' });
        break;
    }
  };
  el.addEventListener('click', onClick);
  return () => { offTasks(); el.removeEventListener('click', onClick); };
}
