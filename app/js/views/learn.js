// Lernen-Tab: Heute dran, Tests mit Ampel-Fortschritt, Lernziele ohne Termin, Karteikarten.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, settings } from '../store.js';
import { go, refresh } from '../router.js';
import { actionSheet } from '../ui/sheet.js';
import { topbar, subjBadge, emptyState, sectionHead, ampBar } from '../ui/components.js';
import { subjects, examKind } from '../model.js';
import { examProgress, PENSUM } from '../logic/plan.js';
import { isDue } from '../logic/cards.js';
import { today, fmtDay, relDay, daysBetween } from '../logic/dates.js';
import { buildPlan } from './plan-rows.js';
import { openTopicSheet } from './topic-sheet.js';

export const live = true;
const state = { showPast: false };

export async function onFab() {
  const v = await actionSheet({ title: 'Neu', items: [
    { label: 'Test', sub: 'Klassenarbeit, Test, Abfrage, Referat …', icon: 'learn', value: 'exam' },
    { label: 'Lernziel', sub: 'Ohne Termin, z. B. Vokabeln oder Formeln', icon: 'target', value: 'goal' },
    { label: 'Kartenstapel', sub: 'Karteikarten zum Abfragen', icon: 'cards', value: 'deck' },
  ] });
  if (v === 'exam') (await import('../forms/exam-form.js')).openExamForm();
  if (v === 'goal') (await import('../forms/exam-form.js')).openExamForm({ kind: 'goal' });
  if (v === 'deck') (await import('../forms/deck-form.js')).openDeckForm();
}

function examCard(e, subj, t) {
  const d = e.data;
  const s = subj.get(d.subjectId);
  const p = examProgress(d);
  const n = d.date ? daysBetween(t, d.date) : null;
  return html`<button class="exam-card ${n === 0 ? 'today' : ''}" data-exam="${e.id}">
    <div class="ex-top">${subjBadge(s)}<div class="grow" style="min-width:0"><div class="ex-title">${examKind(d.kind).label}${d.title ? `: ${d.title}` : ''}</div><div class="ex-meta">${s?.data.name || 'Ohne Fach'}${d.date ? ` · ${fmtDay(d.date)}` : ''}</div></div>
      ${n != null && n >= 0 ? html`<div class="ex-count">${n === 0 ? html`<b>Heute</b>` : html`<b>${n}</b><small>${n === 1 ? 'Tag' : 'Tage'}</small>`}</div>` : ''}</div>
    ${p.total ? html`${ampBar(p)}<div class="ex-meta" style="margin-top:6px">${p.green} von ${p.total} ${p.total === 1 ? 'Thema sitzt' : 'Themen sitzen'}${p.red ? ` · ${p.red} noch rot` : ''}</div>` : html`<div class="ex-meta" style="margin-top:10px">${icon('plus')} Lernstoff eintragen</div>`}
  </button>`;
}

export function render(el) {
  const t = today();
  const subj = new Map(subjects({ archived: true }).map((x) => [x.id, x]));
  const { plan, rows, anyUpcoming, cap } = buildPlan(t, subj);
  const exams = all('exam');
  const upcoming = exams.filter((e) => e.data.date && e.data.date >= t && e.data.kind !== 'goal').sort((a, b) => a.data.date.localeCompare(b.data.date));
  const past = exams.filter((e) => e.data.date && e.data.date < t && e.data.kind !== 'goal').sort((a, b) => b.data.date.localeCompare(a.data.date)).slice(0, 20);
  const goals = exams.filter((e) => e.data.kind === 'goal' || !e.data.date);
  const decks = all('deck');
  const cards = all('card');
  const dueTotal = cards.filter((c) => isDue(c.data, t)).length;
  const pensum = PENSUM[settings().pensum] || PENSUM.normal;

  el.innerHTML = String(html`
    ${topbar({ title: 'Lernen' })}
    <div class="page">
      <h1 class="large-title">Lernen</h1>
      <p class="page-sub">${plan.open ? `${plan.open} ${plan.open === 1 ? 'Thema' : 'Themen'} für heute` : plan.done ? 'Für heute erledigt – stark!' : 'Dein Lernplan für die nächsten Tests'}</p>
      <div class="cols">
        <div>
          <div class="section" style="margin-top:6px">
            ${sectionHead('Heute dran', html`<a class="section-link" href="#/settings">Pensum: ${pensum.label}</a>`)}
            ${rows.length ? html`<div class="todo-group">${rows}</div>` : anyUpcoming
              ? html`<div class="card tight muted">Heute steht nichts an – alles im grünen Bereich.</div>`
              : emptyState({ icon: 'learn', title: 'Noch kein Lernplan', text: 'Trag einen Test mit Lernstoff ein. Dann verteilt die App die Themen bis zum Testtag – rote Themen zuerst.', action: html`<button class="btn primary" data-act="new-exam">${icon('plus')} Test eintragen</button>`, small: true })}
            ${rows.length ? html`<p class="muted" style="font-size:13px;margin:8px 4px 0">Bis zu ${cap} Themen am Tag. Nach dem Lernen kurz einschätzen – der Plan passt sich an.</p>` : ''}
          </div>
          <div class="section">
            ${sectionHead('Tests', '')}
            ${upcoming.length ? html`<div class="list">${upcoming.map((e) => examCard(e, subj, t))}</div>` : html`<p class="muted" style="margin:0 4px">Keine anstehenden Tests.</p>`}
            ${past.length ? html`<button class="text-btn small" data-act="past" style="margin-top:8px">${icon(state.showPast ? 'chevronDown' : 'chevron')} Vergangene · ${past.length}</button>
              ${state.showPast ? html`<div class="list" style="margin-top:6px">${past.map((e) => html`<button class="ev-row soft" data-exam="${e.id}" style="--c:${subj.get(e.data.subjectId)?.data.color || 'var(--text3)'}"><span class="bar"></span><span class="grow"><span class="t" style="display:block">${examKind(e.data.kind).label}${e.data.title ? `: ${e.data.title}` : ''}</span><span class="m" style="display:block">${subj.get(e.data.subjectId)?.data.name || ''} · ${relDay(e.data.date, t)}${e.data.gradeId ? ' · Note eingetragen' : ''}</span></span></button>`)}</div>` : ''}` : ''}
          </div>
        </div>
        <div>
          <div class="section">
            ${sectionHead('Lernziele', html`<button class="section-link" data-act="new-goal">${icon('plus')} Neu</button>`)}
            ${goals.length ? html`<div class="list">${goals.map((e) => examCard(e, subj, t))}</div>` : html`<p class="muted" style="margin:0 4px">Lernziele ohne Termin, z. B. „Unregelmäßige Verben“. Sie füllen freie Plätze in deinem Tagesplan.</p>`}
          </div>
          <div class="section">
            ${sectionHead('Karteikarten', html`<button class="section-link" data-act="new-deck">${icon('plus')} Stapel</button>`)}
            ${dueTotal ? html`<button class="btn block primary" data-go="/quiz/due" style="margin-bottom:10px">${icon('play')} ${dueTotal} fällige ${dueTotal === 1 ? 'Karte' : 'Karten'} üben</button>` : ''}
            ${decks.length ? html`<div class="list">${decks.map((k) => {
              const own = cards.filter((c) => c.data.deckId === k.id);
              const due = own.filter((c) => isDue(c.data, t)).length;
              const s = subj.get(k.data.subjectId);
              return html`<button class="deck-card" data-go="/deck/${k.id}">${s ? subjBadge(s) : html`<span class="ico-tile">${icon('cards')}</span>`}<span class="grow"><span class="dc-title" style="display:block">${k.data.name}</span><span class="dc-sub" style="display:block">${own.length} ${own.length === 1 ? 'Karte' : 'Karten'}${due ? ` · ${due} fällig` : ' · nichts fällig'}</span></span><span class="chev faint">${icon('chevron')}</span></button>`;
            })}</div>` : html`<p class="muted" style="margin:0 4px">Vokabeln und Definitionen als Karteikarten – mit dem 5-Fächer-System kommen gekonnte Karten seltener dran.</p>`}
          </div>
        </div>
      </div>
    </div>`);

  const onClick = async (e) => {
    const tp = e.target.closest('[data-topic]');
    if (tp) { const [ex, topic] = tp.dataset.topic.split(':'); openTopicSheet(ex, topic); return; }
    const ex = e.target.closest('[data-exam]');
    if (ex) { go(`/exam/${ex.dataset.exam}`); return; }
    const g = e.target.closest('[data-go]');
    if (g) { go(g.dataset.go); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'past') { state.showPast = !state.showPast; refresh(); }
    if (a.dataset.act === 'new-exam') (await import('../forms/exam-form.js')).openExamForm();
    if (a.dataset.act === 'new-goal') (await import('../forms/exam-form.js')).openExamForm({ kind: 'goal' });
    if (a.dataset.act === 'new-deck') (await import('../forms/deck-form.js')).openDeckForm();
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}
