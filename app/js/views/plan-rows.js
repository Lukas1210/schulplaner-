// „Heute dran“ – gemeinsame Zeilen für Heute und Lernen.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, settings } from '../store.js';
import { amp } from '../ui/components.js';
import { examKind, examData } from '../model.js';
import { todayPlan, PENSUM, HORIZON } from '../logic/plan.js';
import { isDue } from '../logic/cards.js';
import { relDay, daysBetween } from '../logic/dates.js';

export function buildPlan(t, subj, { limit = Infinity } = {}) {
  const exams = all('exam').map(examData).filter((e) => !e.date || e.date >= t);
  const cap = (PENSUM[settings().pensum] || PENSUM.normal).cap;
  const plan = todayPlan({ exams, today: t, cap });
  const byId = new Map(exams.map((e) => [e.id, e]));
  const dueCards = all('card').filter((c) => isDue(c.data, t)).length;
  const rows = [];
  for (const it of plan.items.slice(0, limit)) {
    const ex = byId.get(it.examId);
    const tp = ex?.topics?.find((x) => x.id === it.topicId);
    if (!tp) continue;
    const sb = subj.get(ex.subjectId);
    const where = ex.date ? `${examKind(ex.kind).short} ${relDay(ex.date, t)}` : 'Lernziel';
    rows.push(html`<div class="topic ${it.done ? 'done' : ''}">
      <button class="amp-btn" data-topic="${ex.id}:${tp.id}" aria-label="${tp.text} einschätzen">${amp(tp.level)}</button>
      <button class="t-text" data-topic="${ex.id}:${tp.id}"><span>${tp.text}</span><span class="t-sub">${sb ? `${sb.data.name} · ` : ''}${where}${it.done ? ' · heute gelernt' : it.review ? ' · wiederholen' : ' · neu lernen'}</span></button>
    </div>`);
  }
  for (const id of plan.rehearsals) {
    const ex = byId.get(id);
    const sb = subj.get(ex.subjectId);
    rows.push(html`<div class="topic"><span class="amp-btn">${icon('flag')}</span><button class="t-text" data-exam="${id}"><span>Generalprobe: alles einmal durchgehen</span><span class="t-sub">${sb ? `${sb.data.name} · ` : ''}${examKind(ex.kind).label} morgen</span></button></div>`);
  }
  for (const id of plan.missing) {
    const ex = byId.get(id);
    const sb = subj.get(ex.subjectId);
    rows.push(html`<div class="topic"><span class="amp-btn">${icon('plus')}</span><button class="t-text" data-exam="${id}"><span>Lernstoff eintragen</span><span class="t-sub">${sb ? `${sb.data.name} · ` : ''}${examKind(ex.kind).label} ${relDay(ex.date, t)}</span></button></div>`);
  }
  if (dueCards) rows.push(html`<div class="topic"><span class="amp-btn">${icon('cards')}</span><button class="t-text" data-go="/quiz/due"><span>Karteikarten wiederholen</span><span class="t-sub">${dueCards} ${dueCards === 1 ? 'Karte ist' : 'Karten sind'} heute fällig</span></button></div>`);
  const anyUpcoming = exams.some((e) => (e.date && daysBetween(t, e.date) <= HORIZON) || !e.date);
  return { plan, rows, dueCards, anyUpcoming, cap };
}
