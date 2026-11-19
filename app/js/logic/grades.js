// Notenlogik für Noten 1–6 mit Tendenzen (+ und −). Rein, ohne DOM.
// Eine Note ist hier { value, cat: 'written' | 'oral', weight, date }.

export const TENDENCIES = [
  { value: 0.25, label: '0,25', hint: '2− = 2,25' },
  { value: 0.3, label: '0,3', hint: '2− = 2,3' },
  { value: 1 / 3, label: '0,33', hint: '2− = 2,33' },
];

export const CATS = {
  written: { key: 'written', label: 'Schriftlich', long: 'Schriftlich (Arbeiten)' },
  oral: { key: 'oral', label: 'Mündlich', long: 'Mündlich & Sonstiges' },
};

/** Notenarten mit Standard-Kategorie (pro Note änderbar). */
export const GRADE_KINDS = [
  { key: 'ka', label: 'Klassenarbeit', short: 'KA', cat: 'written' },
  { key: 'test', label: 'Test', short: 'Test', cat: 'oral' },
  { key: 'oral', label: 'Mündlich / Mitarbeit', short: 'Mdl.', cat: 'oral' },
  { key: 'abfrage', label: 'Abfrage', short: 'Abfr.', cat: 'oral' },
  { key: 'referat', label: 'Referat', short: 'Ref.', cat: 'oral' },
  { key: 'ha', label: 'Hausaufgabe', short: 'HA', cat: 'oral' },
  { key: 'projekt', label: 'Projekt', short: 'Proj.', cat: 'oral' },
  { key: 'other', label: 'Sonstiges', short: 'Sonst.', cat: 'oral' },
];
export const gradeKind = (key) => GRADE_KINDS.find((k) => k.key === key) || GRADE_KINDS[GRADE_KINDS.length - 1];

/** Gewichtung schriftlich : mündlich. written = Anteil schriftlich in %, null = alle Noten gleich. */
export const WEIGHT_PRESETS = [
  { key: '50', label: 'Halb und halb', sub: '50 : 50', written: 50 },
  { key: '2:1', label: 'Schriftlich doppelt', sub: '2 : 1', written: 200 / 3 },
  { key: '1:2', label: 'Mündlich doppelt', sub: '1 : 2', written: 100 / 3 },
  { key: '60', label: 'Mehr schriftlich', sub: '60 : 40', written: 60 },
  { key: '40', label: 'Mehr mündlich', sub: '40 : 60', written: 40 },
  { key: 'flat', label: 'Alle Noten gleich', sub: 'ein Topf', written: null },
];

export function weightLabel(written) {
  if (written == null) return 'Alle Noten gleich';
  const p = WEIGHT_PRESETS.find((x) => x.written != null && Math.abs(x.written - written) < 0.01);
  return p ? `${p.label} (${p.sub})` : `${fmt(written, 0)} % schriftlich`;
}

const round = (v) => Math.round(v * 1000) / 1000;
const fmt = (v, d) => Number(v).toFixed(d).replace('.', ',');
const MINUS = '−';

/** Alle Noten mit Tendenz, von gut nach schlecht: 1+ 1 1− 2+ … 5− 6+ 6. */
export function scale(t = 0.25) {
  const out = [];
  for (let n = 1; n <= 6; n++) {
    out.push({ label: `${n}+`, value: round(n - t) });
    out.push({ label: String(n), value: n });
    if (n < 6) out.push({ label: `${n}${MINUS}`, value: round(n + t) });
  }
  return out;
}

/**
 * Eingabe lesen: „2“, „2+“, „2-“, „2−“, „2-3“ (= 2,5), „1,7“ oder „1.7“.
 * Liefert { value, label } oder null.
 */
export function parseGrade(input, t = 0.25) {
  const s = String(input ?? '').trim().replace(/[−–—]/g, '-').replace(/\s+/g, '').replace(',', '.');
  if (!s) return null;
  let m;
  if ((m = /^([1-6])$/.exec(s))) return { value: +m[1], label: m[1] };
  if ((m = /^([1-6])\+$/.exec(s))) return { value: round(+m[1] - t), label: `${m[1]}+` };
  if ((m = /^([1-5])-$/.exec(s))) return { value: round(+m[1] + t), label: `${m[1]}${MINUS}` };
  if ((m = /^([1-5])-([2-6])$/.exec(s)) && +m[2] === +m[1] + 1) return { value: +m[1] + 0.5, label: `${m[1]}–${m[2]}` };
  if ((m = /^([0-6])\.(\d{1,2})$/.exec(s))) {
    const v = round(parseFloat(s));
    if (v >= 0.6 && v <= 6) return { value: v, label: labelFor(v, t) };
  }
  return null;
}

/** Passende Anzeige zu einem Wert (2,25 → „2−“, 2,5 → „2–3“, sonst Dezimalzahl). */
export function labelFor(value, t = 0.25) {
  if (value == null) return '–';
  const hit = scale(t).find((x) => Math.abs(x.value - value) < 0.002);
  if (hit) return hit.label;
  if (Math.abs(value * 2 - Math.round(value * 2)) < 0.002 && value % 1) return `${Math.floor(value)}–${Math.floor(value) + 1}`;
  const oneDecimal = Math.abs(value * 10 - Math.round(value * 10)) < 0.002;
  return fmt(value, oneDecimal ? 1 : 2);
}

/** Durchschnitt mit zwei Nachkommastellen („2,33“). */
export const fmtAvg = (v, digits = 2) => (v == null || Number.isNaN(v) ? '–' : fmt(v, digits));

function weighted(list) {
  let sum = 0, w = 0;
  for (const g of list) {
    const k = g.weight ?? 1;
    sum += g.value * k;
    w += k;
  }
  return w ? sum / w : null;
}

/**
 * Fach-Schnitt aus Noten und Gewichtung (Anteil schriftlich in %, null = alle gleich).
 * Fehlt eine Kategorie noch, zählt die andere voll (provisional = true).
 */
export function subjectAverage(grades, written = 50) {
  const valid = (grades || []).filter((g) => typeof g.value === 'number' && !Number.isNaN(g.value));
  const W = valid.filter((g) => g.cat === 'written');
  const O = valid.filter((g) => g.cat !== 'written');
  const aw = weighted(W), ao = weighted(O);
  const res = {
    avg: null,
    count: valid.length,
    written: { avg: aw, count: W.length },
    oral: { avg: ao, count: O.length },
    provisional: false,
    flat: written == null,
  };
  if (!valid.length) return res;
  if (written == null) {
    res.avg = weighted(valid);
    return res;
  }
  if (aw != null && ao != null) res.avg = (aw * written + ao * (100 - written)) / 100;
  else {
    res.avg = aw ?? ao;
    res.provisional = written > 0 && written < 100;
  }
  return res;
}

/** Gesamtschnitt über Fächer: [{ avg, main }]. Hauptfächer auf Wunsch doppelt. */
export function overallAverage(list, { mainDouble = false } = {}) {
  let sum = 0, w = 0, count = 0;
  for (const s of list) {
    if (s.avg == null) continue;
    const k = mainDouble && s.main ? 2 : 1;
    sum += s.avg * k;
    w += k;
    count++;
  }
  return { avg: w ? sum / w : null, count };
}

/**
 * Voraussichtliche Zeugnisnote: Ø unter x,5 → x, ab x,5 → x+1.
 * Liegt der Ø weniger als 0,1 an einer Grenze, „wackelt“ die Note (alt = die andere Note).
 */
export function reportGrade(avg) {
  if (avg == null) return null;
  const a = Math.min(6, Math.max(1, avg));
  const grade = Math.min(6, Math.max(1, Math.floor(a + 0.5 + 1e-9)));
  const nearest = Math.round(a - 0.5) + 0.5; // nächste Grenze x,5
  const dist = Math.abs(a - nearest);
  let alt = null;
  if (dist < 0.1 && nearest > 1 && nearest < 6) alt = a < nearest ? grade + 1 : grade - 1;
  return { grade, alt, exact: dist < 0.005 && nearest > 1 && nearest < 6 };
}

/** Kurztext zur Prognose: „2“, „2–3“ (genau auf der Grenze). */
export function reportLabel(r) {
  if (!r) return '–';
  if (r.exact) return `${Math.min(r.grade, r.alt)}–${Math.max(r.grade, r.alt)}`;
  return String(r.grade);
}

/**
 * Zielnoten-Rechner: Welche Note braucht es in der nächsten Leistung (Kategorie, Gewicht),
 * damit die Zeugnisnote `target` (oder besser) herauskommt, also Ø < target + 0,5?
 * → { status: 'safe' } | { status: 'impossible', best } | { status: 'need', label, value, result }
 */
export function requiredGrade({ grades = [], written = 50, cat = 'written', weight = 1, target, tendency = 0.25 }) {
  const limit = target + 0.5;
  const options = scale(tendency).filter((x) => x.value >= 0.6);
  const after = (value) => subjectAverage([...grades, { value, cat, weight }], written).avg;
  const worst = options[options.length - 1];
  const best = options[0];
  if (after(worst.value) < limit - 1e-9) return { status: 'safe', result: after(worst.value) };
  if (after(best.value) >= limit - 1e-9) return { status: 'impossible', best: after(best.value), bestLabel: best.label };
  for (let i = options.length - 1; i >= 0; i--) {
    const r = after(options[i].value);
    if (r < limit - 1e-9) return { status: 'need', label: options[i].label, value: options[i].value, result: r };
  }
  return { status: 'impossible', best: after(best.value), bestLabel: best.label };
}

/** Verlauf: Schnitt nach jeder Note (nach Datum sortiert) für Diagramme. */
export function runningAverages(grades, written = 50) {
  const sorted = (grades || []).filter((g) => typeof g.value === 'number').slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    out.push({ date: sorted[i].date, value: sorted[i].value, avg: subjectAverage(sorted.slice(0, i + 1), written).avg, grade: sorted[i] });
  }
  return out;
}

/** Stimmung einer Note für Farben: good (bis 2,5), ok (bis 3,5), weak (bis 4,5), bad. */
export function gradeTone(v) {
  if (v == null) return 'none';
  if (v <= 2.5) return 'good';
  if (v <= 3.5) return 'ok';
  if (v <= 4.5) return 'weak';
  return 'bad';
}
