// Datums-Helfer (rein, ohne DOM). Datum = 'YYYY-MM-DD', Uhrzeit = 'HH:MM', Wochentag 1 = Montag … 7 = Sonntag.

export const pad = (n) => String(n).padStart(2, '0');

export function parseDate(s) {
  if (!s) return null;
  if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

export function isoDate(d = new Date()) {
  const dt = d instanceof Date ? d : parseDate(d);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export const today = () => isoDate(new Date());

export function addDays(iso, n) {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

/** Tage von a bis b (b − a). */
export function daysBetween(a, b) {
  const da = parseDate(a), db = parseDate(b);
  return Math.round((Date.UTC(db.getFullYear(), db.getMonth(), db.getDate()) - Date.UTC(da.getFullYear(), da.getMonth(), da.getDate())) / 86400000);
}

export const isoDow = (iso) => ((parseDate(iso).getDay() + 6) % 7) + 1;
export const mondayOf = (iso) => addDays(iso, 1 - isoDow(iso));
export const firstOfMonth = (iso) => `${iso.slice(0, 7)}-01`;

export function addMonths(iso, n) {
  const d = parseDate(firstOfMonth(iso));
  d.setMonth(d.getMonth() + n);
  return isoDate(d);
}

/** Kalenderwoche nach ISO 8601. */
export function isoWeek(iso) {
  const d = parseDate(iso);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
}

export function timeToMin(t) {
  if (!t) return null;
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
}
export const minToTime = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
export const nowMin = (d = new Date()) => d.getHours() * 60 + d.getMinutes();

// ---------- Formatierung (fest auf Deutsch, unabhängig von der Systemsprache) ----------
export const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const MONTHS_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];

const parts = (iso) => {
  const d = parseDate(iso);
  return d ? { d: d.getDate(), m: d.getMonth(), y: d.getFullYear(), dow: ((d.getDay() + 6) % 7) + 1 } : null;
};

/** 20.11. */
export function fmtShort(iso) { const p = parts(iso); return p ? `${p.d}.${p.m + 1}.` : ''; }
/** Fr, 20.11. */
export function fmtDay(iso) { const p = parts(iso); return p ? `${WEEKDAYS_SHORT[p.dow - 1]}, ${p.d}.${p.m + 1}.` : ''; }
/** Freitag, 20. November */
export function fmtLong(iso) { const p = parts(iso); return p ? `${WEEKDAYS[p.dow - 1]}, ${p.d}. ${MONTHS[p.m]}` : ''; }
/** 20. November 2026 */
export function fmtFull(iso) { const p = parts(iso); return p ? `${p.d}. ${MONTHS[p.m]} ${p.y}` : ''; }
/** 20. Nov. */
export function fmtDayMonth(iso) { const p = parts(iso); return p ? `${p.d}. ${MONTHS_SHORT[p.m]}` : ''; }
/** November 2026 */
export function fmtMonthYear(iso) { const p = parts(iso); return p ? `${MONTHS[p.m]} ${p.y}` : ''; }

/** 20.11.–23.11. bzw. 23.12.2026–9.1.2027 */
export function fmtRange(a, b) {
  if (!b || a === b) return fmtShort(a);
  const pa = parts(a), pb = parts(b);
  if (pa.y !== pb.y) return `${pa.d}.${pa.m + 1}.${pa.y} – ${pb.d}.${pb.m + 1}.${pb.y}`;
  return `${fmtShort(a)} – ${fmtShort(b)}`;
}

/** heute, morgen, übermorgen, in 5 Tagen, gestern, vor 3 Tagen */
export function relDay(iso, ref) {
  const n = daysBetween(ref, iso);
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  if (n === 2) return 'übermorgen';
  if (n === -1) return 'gestern';
  if (n === -2) return 'vorgestern';
  return n > 0 ? `in ${n} Tagen` : `vor ${-n} Tagen`;
}

/** Fälligkeit kurz: heute, morgen, Freitag (diese Woche), sonst „Fr, 20.11.“ */
export function dueLabel(iso, ref) {
  const n = daysBetween(ref, iso);
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  if (n > 1 && n < 7) return WEEKDAYS[isoDow(iso) - 1];
  return fmtDay(iso);
}

// ---------- Schuljahr & Halbjahre ----------
/**
 * Schuljahr, in dem `ref` liegt. Ohne Einstellungen beginnt es am 1. August, das 2. Halbjahr am 1. Februar.
 * Gespeicherte Daten gelten nur, solange sie zu diesem Schuljahr passen.
 */
export function schoolYear(s = {}, ref = today()) {
  const r = parseDate(ref);
  let y = r.getMonth() >= 7 ? r.getFullYear() : r.getFullYear() - 1;
  let start = `${y}-08-01`;
  if (s.yearStart) {
    const n = daysBetween(s.yearStart, ref);
    if (n >= 0 && n < 365) { start = s.yearStart; y = parseDate(start).getFullYear(); }
    else if (n < 0 && n > -60) {
      // Sommerferien vor dem eingetragenen Start: noch das alte Schuljahr
      y = parseDate(s.yearStart).getFullYear() - 1;
      start = `${y}-08-01`;
    }
  }
  const end = addDays(`${y + 1}-08-01`, -1);
  let half = `${y + 1}-02-01`;
  if (s.halfStart && s.halfStart > start && s.halfStart <= end) half = s.halfStart;
  return { start, half, end, label: `${y}/${String(y + 1).slice(2)}` };
}

/** 1 oder 2 – in welchem Halbjahr liegt das Datum? */
export const halfOf = (iso, year) => (iso < year.half ? 1 : 2);

export function fmtNumber(n, digits = 0) {
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
