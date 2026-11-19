// Fachliche Konstanten und Abfragen auf den Datenbestand.
import { all, get, settings } from './store.js';
import { SUBJECT_COLORS } from './logic/colors.js';
import { holidayList } from './holidays.js';
import { holidayOn } from './logic/holidays.js';
import { today } from './logic/dates.js';

export const APP_VERSION = '1.0.0';
export { SUBJECT_COLORS };

/** Fächer-Vorlagen fürs Onboarding (Kürzel, Farbe, Hauptfach). */
export const SUBJECT_PRESETS = [
  { name: 'Deutsch', short: 'D', color: '#C0392B', main: true },
  { name: 'Mathe', short: 'M', color: '#2F5DA8', main: true },
  { name: 'Englisch', short: 'E', color: '#4E7D5B', main: true },
  { name: 'Französisch', short: 'F', color: '#7048A8', main: true },
  { name: 'Latein', short: 'L', color: '#7A5235', main: true },
  { name: 'Spanisch', short: 'Spa', color: '#B4532A', main: true },
  { name: 'Biologie', short: 'Bio', color: '#6B7A1F' },
  { name: 'Chemie', short: 'Ch', color: '#00796B' },
  { name: 'Physik', short: 'Ph', color: '#4B4FA6' },
  { name: 'Geschichte', short: 'G', color: '#9A6A00' },
  { name: 'Erdkunde', short: 'Ek', color: '#1F6F78' },
  { name: 'Politik', short: 'Pol', color: '#5A6B7B' },
  { name: 'Wirtschaft', short: 'Wi', color: '#8E3F7A' },
  { name: 'Religion', short: 'Rel', color: '#B23A5E' },
  { name: 'Ethik', short: 'Eth', color: '#B23A5E' },
  { name: 'Kunst', short: 'Ku', color: '#8E3F7A' },
  { name: 'Musik', short: 'Mu', color: '#7048A8' },
  { name: 'Sport', short: 'Spo', color: '#B4532A' },
  { name: 'Informatik', short: 'Inf', color: '#5A6B7B' },
];

export const EXAM_KINDS = [
  { key: 'ka', label: 'Klassenarbeit', short: 'KA', gradeKind: 'ka' },
  { key: 'test', label: 'Test', short: 'Test', gradeKind: 'test' },
  { key: 'abfrage', label: 'Abfrage', short: 'Abfr.', gradeKind: 'abfrage' },
  { key: 'referat', label: 'Referat / Präsentation', short: 'Ref.', gradeKind: 'referat' },
  { key: 'abgabe', label: 'Abgabe / Projekt', short: 'Abgabe', gradeKind: 'projekt' },
  { key: 'goal', label: 'Lernziel ohne Termin', short: 'Ziel', gradeKind: null },
];
export const examKind = (key) => EXAM_KINDS.find((k) => k.key === key) || EXAM_KINDS[0];

export const EVENT_KINDS = [
  { key: 'event', label: 'Termin', icon: 'calendar' },
  { key: 'trip', label: 'Ausflug / Exkursion', icon: 'flag' },
  { key: 'parents', label: 'Elternabend / Sprechtag', icon: 'people' },
  { key: 'free', label: 'Unterrichtsfrei', icon: 'palm' },
];
export const eventKind = (key) => EVENT_KINDS.find((k) => k.key === key) || EVENT_KINDS[0];

export const ABSENCE_REASONS = [
  { key: 'sick', label: 'Krank' },
  { key: 'doctor', label: 'Arzttermin' },
  { key: 'family', label: 'Familie' },
  { key: 'school', label: 'Schulveranstaltung' },
  { key: 'other', label: 'Sonstiges' },
];
export const absenceReason = (key) => ABSENCE_REASONS.find((r) => r.key === key) || ABSENCE_REASONS[4];
export const EXCUSE = {
  open: { label: 'Entschuldigung offen', short: 'offen' },
  submitted: { label: 'Entschuldigung abgegeben', short: 'abgegeben' },
  none: { label: 'Keine Entschuldigung nötig', short: 'nicht nötig' },
};

export const LEVELS = [
  { level: 0, label: 'Kann ich noch nicht', short: 'Rot', icon: 'ampRed' },
  { level: 1, label: 'Unsicher', short: 'Gelb', icon: 'ampYellow' },
  { level: 2, label: 'Sitzt', short: 'Grün', icon: 'ampGreen' },
];

// ---------- Abfragen ----------
const byOrder = (a, b) => (a.data.order ?? 999) - (b.data.order ?? 999) || String(a.data.name).localeCompare(String(b.data.name), 'de');

export function subjects({ archived = false } = {}) {
  return all('subject').filter((s) => archived || !s.data.archived).sort(byOrder);
}
export const subjectById = (id) => (id ? get(id) : null);

export function shortFor(name) {
  const n = String(name || '').trim();
  const p = SUBJECT_PRESETS.find((x) => x.name.toLowerCase() === n.toLowerCase());
  if (p) return p.short;
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.map((w) => w[0]).join('').slice(0, 3).toUpperCase();
  return n.slice(0, 3).replace(/^./, (c) => c.toUpperCase());
}

/** Am wenigsten benutzte Fachfarbe. */
export function nextColor() {
  const used = new Map(SUBJECT_COLORS.map((c) => [c, 0]));
  for (const s of subjects({ archived: true })) if (used.has(s.data.color)) used.set(s.data.color, used.get(s.data.color) + 1);
  return [...used.entries()].sort((a, b) => a[1] - b[1])[0][0];
}

export const lessonsData = () => all('lesson').map((l) => ({ id: l.id, ...l.data }));
export const examData = (e) => ({ id: e.id, ...e.data });

/**
 * Kontext für die Stundenplan-Logik: Einstellungen, Stunden und isFree (Ferien, Feiertage, unterrichtsfreie Termine).
 * Einmal pro Darstellung bauen.
 */
export function timetableCtx() {
  const s = settings();
  const hol = holidayList();
  const free = all('event').map((e) => e.data).filter((d) => d.kind === 'free' && d.date);
  const freeInfo = (iso) => {
    const h = holidayOn(hol, iso);
    if (h) return h;
    const ev = free.find((d) => d.date <= iso && iso <= (d.endDate || d.date));
    return ev ? { start: ev.date, end: ev.endDate || ev.date, name: ev.title || 'Unterrichtsfrei', kind: 'free' } : null;
  };
  return { settings: s, lessons: lessonsData(), isFree: (iso) => !!freeInfo(iso), freeInfo, holidays: hol };
}

export const openTasks = () => all('task').filter((t) => !t.data.done);
export const upcomingExams = (from = today()) => all('exam').filter((e) => e.data.date && e.data.date >= from).sort((a, b) => a.data.date.localeCompare(b.data.date));

/** Noten eines Fachs als reine Objekte für die Notenlogik. */
export const gradesOf = (subjectId, filter = () => true) =>
  all('grade').filter((g) => g.data.subjectId === subjectId && filter(g)).map((g) => ({ id: g.id, ...g.data }));
