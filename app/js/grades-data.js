// Noten-Auswertung auf dem Datenbestand: Halbjahre, Fach-Schnitte, Gesamtschnitt.
import { all, settings } from './store.js';
import { subjects } from './model.js';
import { schoolYear, today, addDays } from './logic/dates.js';
import { subjectAverage, overallAverage, reportGrade } from './logic/grades.js';

/** Zeitraum: 'h1' | 'h2' | 'year' im Schuljahr von `ref`. */
export function termRange(kind, ref = today()) {
  const y = schoolYear(settings(), ref);
  if (kind === 'h1') return { kind, from: y.start, to: addDays(y.half, -1), label: '1. Halbjahr', year: y };
  if (kind === 'h2') return { kind, from: y.half, to: y.end, label: '2. Halbjahr', year: y };
  return { kind: 'year', from: y.start, to: y.end, label: `Schuljahr ${y.label}`, year: y };
}

/** Aktuelles Halbjahr. */
export function currentTerm(ref = today()) {
  const y = schoolYear(settings(), ref);
  return termRange(ref < y.half ? 'h1' : 'h2', ref);
}

export const inRange = (g, r) => !r || (g.date >= r.from && g.date <= r.to);

/** Noten eines Fachs im Zeitraum (als reine Objekte). */
export function gradesFor(subjectId, range) {
  return all('grade')
    .filter((g) => g.data.subjectId === subjectId && inRange(g.data, range))
    .map((g) => ({ id: g.id, ...g.data }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function subjectStats(subject, range) {
  const grades = gradesFor(subject.id, range);
  const written = subject.data.written === undefined ? 50 : subject.data.written;
  const res = subjectAverage(grades, written);
  return { subject, grades, res, rep: reportGrade(res.avg), written };
}

export function overallStats(range) {
  const list = subjects().map((s) => subjectStats(s, range));
  const o = overallAverage(list.map((x) => ({ avg: x.res.avg, main: !!x.subject.data.main })), { mainDouble: !!settings().mainDouble });
  return { ...o, list };
}

/** Schuljahre, in denen es Noten gibt (für frühere Jahre). */
export function gradeYears() {
  const s = settings();
  const set = new Map();
  for (const g of all('grade')) {
    if (!g.data.date) continue;
    const y = schoolYear(s, g.data.date);
    set.set(y.start, y);
  }
  return [...set.values()].sort((a, b) => b.start.localeCompare(a.start));
}

/** Gemeinsame Auswahl für Noten-Übersicht und Fach-Notenseite: Halbjahr und Schuljahr. */
export const gradeView = { kind: null, ref: null };
export function viewRange() {
  const ref = gradeView.ref || today();
  if (!gradeView.kind) gradeView.kind = currentTerm(ref).kind;
  return termRange(gradeView.kind, ref);
}
