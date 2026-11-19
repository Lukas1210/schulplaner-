// Ferien & Feiertage (rein, ohne DOM): Bundesländer, Antworten der OpenHolidays API lesen, Abfragen.
// Ein Eintrag ist { start, end, name, kind: 'school' | 'public' }.
import { addDays } from './dates.js';

export const STATES = [
  { code: 'BW', name: 'Baden-Württemberg' },
  { code: 'BY', name: 'Bayern' },
  { code: 'BE', name: 'Berlin' },
  { code: 'BB', name: 'Brandenburg' },
  { code: 'HB', name: 'Bremen' },
  { code: 'HH', name: 'Hamburg' },
  { code: 'HE', name: 'Hessen' },
  { code: 'MV', name: 'Mecklenburg-Vorpommern' },
  { code: 'NI', name: 'Niedersachsen' },
  { code: 'NW', name: 'Nordrhein-Westfalen' },
  { code: 'RP', name: 'Rheinland-Pfalz' },
  { code: 'SL', name: 'Saarland' },
  { code: 'SN', name: 'Sachsen' },
  { code: 'ST', name: 'Sachsen-Anhalt' },
  { code: 'SH', name: 'Schleswig-Holstein' },
  { code: 'TH', name: 'Thüringen' },
];
export const stateName = (code) => STATES.find((s) => s.code === code)?.name || '';

const API = 'https://openholidaysapi.org';

/** Adressen für Schulferien und Feiertage eines Bundeslands. */
export function holidayUrls(state, from, to) {
  const q = `countryIsoCode=DE&subdivisionCode=DE-${state}&languageIsoCode=DE&validFrom=${from}&validTo=${to}`;
  return { school: `${API}/SchoolHolidays?${q}`, public: `${API}/PublicHolidays?${q}` };
}

function nameOf(entry) {
  const names = Array.isArray(entry.name) ? entry.name : [];
  const de = names.find((n) => String(n.language).toUpperCase() === 'DE') || names[0];
  return (de && de.text) || (typeof entry.name === 'string' ? entry.name : '') || 'Frei';
}

function appliesTo(entry, state) {
  if (entry.nationwide) return true;
  const subs = Array.isArray(entry.subdivisions) ? entry.subdivisions : [];
  if (!subs.length) return true; // Die API hat bereits nach Bundesland gefiltert
  const code = `DE-${state}`;
  return subs.some((s) => s && (s.code === code || String(s.code || '').startsWith(`${code}-`) || s.shortName === state));
}

/** Antwort der API in einheitliche Einträge umwandeln (unbekannte Felder werden ignoriert). */
export function normalizeHolidays(list, kind, state) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const e of list) {
    if (!e || !/^\d{4}-\d{2}-\d{2}/.test(e.startDate || '')) continue;
    if (state && !appliesTo(e, state)) continue;
    const start = e.startDate.slice(0, 10);
    const end = /^\d{4}-\d{2}-\d{2}/.test(e.endDate || '') ? e.endDate.slice(0, 10) : start;
    out.push({ start, end: end < start ? start : end, name: nameOf(e), kind });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

/** Eintrag, der dieses Datum abdeckt (Schulferien vor Feiertagen). */
export function holidayOn(list, iso) {
  let hit = null;
  for (const h of list) {
    if (h.start <= iso && iso <= h.end) {
      if (h.kind === 'school') return h;
      hit = hit || h;
    }
  }
  return hit;
}

/** Laufende Schulferien oder die nächsten (ab morgen). */
export function currentOrNextHoliday(list, iso) {
  const school = list.filter((h) => h.kind === 'school').sort((a, b) => a.start.localeCompare(b.start));
  const current = school.find((h) => h.start <= iso && iso <= h.end) || null;
  const next = school.find((h) => h.start > iso) || null;
  return { current, next };
}

/** Alle Einträge, die den Zeitraum berühren. */
export function holidaysInRange(list, from, to) {
  return list.filter((h) => h.start <= to && h.end >= from);
}

/** Zeitraum für das Laden: vom Beginn des Schuljahres bis anderthalb Jahre später. */
export function fetchRange(yearStart) {
  return { from: addDays(yearStart, -31), to: addDays(yearStart, 540) };
}
