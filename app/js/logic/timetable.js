// Stundenplan-Logik (rein, ohne DOM): Stundenzeiten, A/B-Wochen, nächste Stunde eines Fachs, Schultage.
// Eine Stunde (lesson) ist { subjectId, day: 1–6, period: 1–n, room, week: 'all' | 'A' | 'B' }.
// ctx = { settings, lessons, isFree(iso) } – isFree meldet Ferien, Feiertage und unterrichtsfreie Tage.
import { addDays, daysBetween, isoDow, mondayOf, timeToMin, minToTime } from './dates.js';

/** Stundenzeiten erzeugen: Beginn, Länge, kleine Pause und große Pausen nach bestimmten Stunden. */
export function generatePeriods({ start = '08:00', length = 45, gap = 5, breaks = { 2: 20, 4: 15, 6: 45 }, count = 10 } = {}) {
  const out = [];
  let t = timeToMin(start);
  for (let i = 1; i <= count; i++) {
    out.push({ start: minToTime(t), end: minToTime(t + length) });
    t += length + (breaks[i] ?? gap);
  }
  return out;
}

export const DEFAULT_PERIODS = generatePeriods();
export const periodsOf = (s) => (Array.isArray(s?.periods) && s.periods.length ? s.periods : DEFAULT_PERIODS);

/** 'A', 'B' oder null (ohne A/B-Wochen). abRef = Montag einer A-Woche. */
export function weekType(iso, s) {
  if (!s?.abWeeks || !s.abRef) return null;
  const n = Math.round(daysBetween(mondayOf(s.abRef), mondayOf(iso)) / 7);
  return ((n % 2) + 2) % 2 === 0 ? 'A' : 'B';
}

/** Neue Referenz, damit die Woche von `iso` den Typ `type` bekommt. */
export const refForWeek = (iso, type) => (type === 'A' ? mondayOf(iso) : addDays(mondayOf(iso), -7));

/** Gilt eine Stunde in dieser Woche? */
export const lessonInWeek = (l, wt) => !wt || !l.week || l.week === 'all' || l.week === wt;

/** Stunden eines Tages (ohne Rücksicht auf Ferien), nach Stunde sortiert. */
export function lessonsOn(lessons, iso, s) {
  const dow = isoDow(iso);
  const wt = weekType(iso, s);
  return lessons.filter((l) => l.day === dow && lessonInWeek(l, wt)).sort((a, b) => a.period - b.period);
}

/** Beginn/Ende einer Stunde (Minuten seit Mitternacht). */
export function periodTimes(period, periods) {
  const p = periods[period - 1];
  if (!p) return null;
  return { start: timeToMin(p.start), end: timeToMin(p.end) };
}

export const schoolDays = (s) => (s?.days === 6 ? 6 : 5);

export function isSchoolDay(iso, ctx) {
  return isoDow(iso) <= schoolDays(ctx.settings) && !ctx.isFree?.(iso);
}

/**
 * Datum der nächsten Stunde eines Fachs nach `from` (ohne `from` selbst).
 * skip = 1 → übernächste Stunde. Liefert null, wenn das Fach nicht im Stundenplan steht.
 */
export function nextLessonDate(subjectId, from, ctx, { skip = 0, maxDays = 84 } = {}) {
  const own = ctx.lessons.filter((l) => l.subjectId === subjectId);
  if (!own.length) return null;
  let found = 0;
  for (let i = 1; i <= maxDays; i++) {
    const d = addDays(from, i);
    if (!isSchoolDay(d, ctx)) continue;
    if (lessonsOn(own, d, ctx.settings).length) {
      if (found === skip) return d;
      found++;
    }
  }
  return null;
}

/** Zusammenhängende Stunden desselben Fachs (Doppelstunden) zu Blöcken zusammenfassen. */
export function blocks(dayLessons, periods) {
  const out = [];
  for (const l of dayLessons) {
    const last = out[out.length - 1];
    if (last && last.subjectId === l.subjectId && last.to === l.period - 1 && (last.room || '') === (l.room || '')) {
      last.to = l.period;
      last.lessons.push(l);
    } else {
      out.push({ subjectId: l.subjectId, room: l.room || '', from: l.period, to: l.period, lessons: [l] });
    }
  }
  for (const b of out) {
    const a = periodTimes(b.from, periods), z = periodTimes(b.to, periods);
    b.start = a?.start ?? null;
    b.end = z?.end ?? null;
  }
  return out;
}

/**
 * Laufende und nächste Stunde. Liefert { day, current, next, nextDate }, wobei current/next Blöcke sind.
 * Ist heute nichts mehr, wird der erste Block des nächsten Schultags geliefert (nextDate).
 */
export function nowAndNext(iso, minutes, ctx) {
  const periods = periodsOf(ctx.settings);
  const res = { current: null, next: null, nextDate: null, schoolDay: isSchoolDay(iso, ctx) };
  if (res.schoolDay) {
    const day = blocks(lessonsOn(ctx.lessons, iso, ctx.settings), periods);
    res.current = day.find((b) => b.start != null && b.start <= minutes && minutes < b.end) || null;
    res.next = day.find((b) => b.start != null && b.start > minutes) || null;
    if (res.next) res.nextDate = iso;
  }
  if (!res.next) {
    for (let i = 1; i <= 30; i++) {
      const d = addDays(iso, i);
      if (!isSchoolDay(d, ctx)) continue;
      const day = blocks(lessonsOn(ctx.lessons, d, ctx.settings), periods);
      if (day.length) { res.next = day[0]; res.nextDate = d; break; }
    }
  }
  return res;
}

/** Anzahl Schultage d mit from ≤ d < to. */
export function schoolDaysBetween(from, to, ctx) {
  let n = 0;
  for (let d = from; d < to; d = addDays(d, 1)) if (isSchoolDay(d, ctx)) n++;
  return n;
}

/** n-ter Schultag nach `from` (from selbst zählt nicht). */
export function addSchoolDays(from, n, ctx) {
  let d = from, k = 0, guard = 0;
  while (k < n && guard++ < 400) {
    d = addDays(d, 1);
    if (isSchoolDay(d, ctx)) k++;
  }
  return d;
}

/** Verpasste Stunden in einem Zeitraum (für Fehltage): [{ date, lesson }]. */
export function lessonsInRange(from, to, ctx) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!isSchoolDay(d, ctx)) continue;
    for (const l of lessonsOn(ctx.lessons, d, ctx.settings)) out.push({ date: d, lesson: l });
  }
  return out;
}

/** Wochenstunden je Fach (A/B-Wochen zählen halb). */
export function hoursPerWeek(lessons, subjectId) {
  return lessons.filter((l) => l.subjectId === subjectId).reduce((n, l) => n + (l.week === 'A' || l.week === 'B' ? 0.5 : 1), 0);
}
