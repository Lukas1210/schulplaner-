// Karteikarten mit dem Leitner-System (5 Fächer). Rein, ohne DOM.
// Karte: { front, back, box: 1–5, due: 'YYYY-MM-DD' | null, last }
import { addDays } from './dates.js';

/** Abstand in Tagen bis zur nächsten Abfrage, nach Fach (Index = Fach). */
export const INTERVALS = [0, 1, 2, 4, 8, 16];

export const isDue = (card, day) => !card.due || card.due <= day;

/** Antwort verbuchen: richtig → ein Fach weiter, falsch → zurück in Fach 1. */
export function review(card, correct, day) {
  const box = correct ? Math.min(5, (card.box || 1) + 1) : 1;
  return { box, due: addDays(day, INTERVALS[box]), last: day };
}

export function boxCounts(cards) {
  const c = [0, 0, 0, 0, 0, 0];
  for (const k of cards) c[Math.min(5, Math.max(1, k.box || 1))]++;
  return c;
}

const SEPARATORS = ['\t', ' – ', ' — ', ' - ', ';', ' = ', ' : '];

/** Text mit einer Karte pro Zeile lesen („Vorderseite – Rückseite“). */
export function parseImport(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const sep = SEPARATORS.find((s) => line.includes(s));
    if (!sep) continue;
    const i = line.indexOf(sep);
    const front = line.slice(0, i).trim();
    const back = line.slice(i + sep.length).trim();
    if (front && back) out.push({ front, back });
  }
  return out;
}

/** Mischen (Fisher-Yates) mit optionalem Zufallsgenerator für Tests. */
export function shuffle(list, rnd = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
