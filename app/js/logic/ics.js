// Kalender-Dateien (.ics) für den iPhone-Kalender – mit Erinnerung. Rein, ohne DOM.
// Ereignis: { uid, title, date, endDate?, start?: 'HH:MM', end?: 'HH:MM', description?, location?, alarm?: { daysBefore, at: 'HH:MM' } }
import { parseDate, addDays, pad, timeToMin } from './dates.js';

const icsDate = (iso) => iso.replace(/-/g, '');
const icsDateTime = (iso, time) => `${icsDate(iso)}T${time.replace(':', '')}00`;

export function icsEscape(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** Zeilen nach RFC 5545 auf 75 Bytes falten (UTF-8-sicher). */
export function foldLine(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
      limit = 75;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

/** Minuten zwischen Erinnerung und Beginn (für TRIGGER). */
export function alarmMinutes(ev) {
  if (!ev.alarm) return null;
  const startMin = ev.start ? timeToMin(ev.start) : 0;
  const at = timeToMin(ev.alarm.at || '18:00');
  return (ev.alarm.daysBefore || 0) * 1440 + startMin - at;
}

export function buildICS(events, { prodId = '-//Schulplaner//DE', name = '' } = {}) {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${prodId}`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  if (name) lines.push(`X-WR-CALNAME:${icsEscape(name)}`);
  for (const ev of events) {
    lines.push('BEGIN:VEVENT', `UID:${ev.uid}`, `DTSTAMP:${stamp}`);
    if (ev.start) {
      const end = ev.end || ev.start;
      lines.push(`DTSTART:${icsDateTime(ev.date, ev.start)}`, `DTEND:${icsDateTime(ev.endDate || ev.date, end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(ev.date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(ev.endDate || ev.date, 1))}`);
    }
    lines.push(`SUMMARY:${icsEscape(ev.title)}`);
    if (ev.location) lines.push(`LOCATION:${icsEscape(ev.location)}`);
    if (ev.description) lines.push(`DESCRIPTION:${icsEscape(ev.description)}`);
    const m = alarmMinutes(ev);
    if (m != null) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(ev.title)}`, m <= 0 ? `TRIGGER:PT${-m}M` : `TRIGGER:-PT${m}M`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** Erinnerungs-Einstellung → { daysBefore, at } oder null. */
export function alarmFor(setting) {
  switch (setting) {
    case 'eve': return { daysBefore: 1, at: '18:00' };
    case '2d': return { daysBefore: 2, at: '18:00' };
    case '1w': return { daysBefore: 7, at: '18:00' };
    default: return null;
  }
}

export const REMINDER_OPTIONS = [
  { key: 'eve', label: 'Am Vortag um 18 Uhr' },
  { key: '2d', label: '2 Tage vorher um 18 Uhr' },
  { key: '1w', label: '1 Woche vorher um 18 Uhr' },
  { key: 'none', label: 'Keine Erinnerung' },
];

export function icsFileName(title) {
  const base = String(title || 'termin').toLowerCase().replace(/[^a-z0-9äöüß]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'termin';
  return `${base}.ics`;
}

/** Hilfsfunktion für Tests: Datum des Weckers. */
export function alarmDate(ev) {
  const m = alarmMinutes(ev);
  if (m == null) return null;
  const d = parseDate(ev.date);
  const start = ev.start ? timeToMin(ev.start) : 0;
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, start - m);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
}
