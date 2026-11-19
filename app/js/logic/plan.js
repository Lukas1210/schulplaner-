// Lernplan „Heute dran“ (rein, ohne DOM).
// Ein Test hat Themen [{ id, text, level: 0 rot | 1 gelb | 2 grün, studied: ['YYYY-MM-DD', …] }].
// Rote Themen brauchen zwei Lerneinheiten (lernen + wiederholen), gelbe eine, grüne keine.
// Pro Tag kommt jedes Thema höchstens einmal dran; die Einheiten werden gleichmäßig auf die Tage bis zum Test verteilt.
import { daysBetween } from './dates.js';

export const PENSUM = {
  locker: { label: 'Locker', sub: 'bis 3 Themen am Tag', cap: 3 },
  normal: { label: 'Normal', sub: 'bis 5 Themen am Tag', cap: 5 },
  viel: { label: 'Viel', sub: 'bis 8 Themen am Tag', cap: 8 },
};

export const HORIZON = 28;

const units = (t) => (t.level === 0 ? 2 : t.level === 1 ? 1 : 0);
export const studiedOn = (t, day) => (t.studied || []).includes(day);

/** Fortschritt eines Tests: Anzahl rot/gelb/grün. */
export function examProgress(exam) {
  const topics = exam?.topics || [];
  const c = { red: 0, yellow: 0, green: 0, total: topics.length };
  for (const t of topics) {
    if (t.level === 2) c.green++;
    else if (t.level === 1) c.yellow++;
    else c.red++;
  }
  c.pct = c.total ? (c.green + c.yellow * 0.5) / c.total : 0;
  return c;
}

/**
 * Tagesplan.
 * exams: [{ id, date | null, topics }] – Tests mit Datum und Lernziele ohne Datum.
 * Liefert { items: [{ examId, topicId, done, review }], rehearsals: [examId], missing: [examId], examsToday: [examId], open, done }.
 */
export function todayPlan({ exams = [], today, cap = 5, horizon = HORIZON }) {
  const dated = exams
    .filter((e) => e.date && e.date >= today && daysBetween(today, e.date) <= horizon)
    .sort((a, b) => a.date.localeCompare(b.date));
  const goals = exams.filter((e) => !e.date);
  const res = { items: [], rehearsals: [], missing: [], examsToday: [], open: 0, done: 0 };

  // Heute schon Gelerntes zählt (und belegt Plätze im Tageslimit)
  for (const e of [...dated, ...goals]) {
    for (const t of e.topics || []) {
      if (studiedOn(t, today)) res.items.push({ examId: e.id, topicId: t.id, done: true, review: t.level >= 1 });
    }
  }
  res.done = res.items.length;
  let free = Math.max(0, cap - res.done);

  for (const e of dated) {
    const daysLeft = daysBetween(today, e.date);
    if (daysLeft === 0) { res.examsToday.push(e.id); continue; }
    const topics = e.topics || [];
    if (!topics.length) { res.missing.push(e.id); continue; }
    if (daysLeft === 1) res.rehearsals.push(e.id);
    const doneToday = topics.filter((t) => studiedOn(t, today)).length;
    const open = topics.filter((t) => t.level < 2 && !studiedOn(t, today));
    const remaining = open.reduce((n, t) => n + units(t), 0);
    // Ziel für heute: (offene Einheiten + heute erledigte) gleichmäßig auf die restlichen Lerntage verteilt
    const target = Math.ceil((remaining + doneToday) / daysLeft);
    let want = Math.max(0, target - doneToday);
    const ordered = [...open.filter((t) => t.level === 0), ...open.filter((t) => t.level === 1)];
    for (const t of ordered) {
      if (!want || !free) break;
      res.items.push({ examId: e.id, topicId: t.id, done: false, review: t.level === 1 });
      want--;
      free--;
    }
  }

  // Freie Plätze: Lernziele ohne Termin (schwächste und am längsten nicht gelernte zuerst), höchstens 2
  if (free) {
    const cands = [];
    for (const g of goals) {
      for (const t of g.topics || []) {
        if (t.level < 2 && !studiedOn(t, today)) cands.push({ g, t, last: (t.studied || []).slice(-1)[0] || '' });
      }
    }
    cands.sort((a, b) => a.t.level - b.t.level || a.last.localeCompare(b.last));
    for (const c of cands.slice(0, Math.min(2, free))) {
      res.items.push({ examId: c.g.id, topicId: c.t.id, done: false, review: c.t.level === 1, goal: true });
      free--;
    }
  }
  res.open = res.items.filter((i) => !i.done).length;
  return res;
}
