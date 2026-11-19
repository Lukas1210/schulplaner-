// Tests und Termine in den iPhone-Kalender übernehmen (.ics mit Erinnerung).
import { all, settings } from './store.js';
import { subjectById, examKind, eventKind, timetableCtx } from './model.js';
import { periodsOf } from './logic/timetable.js';
import { buildICS, alarmFor, icsFileName } from './logic/ics.js';
import { today } from './logic/dates.js';
import { publishIcs } from './sync.js';
import { toast } from './ui/sheet.js';

/** Kalender-Ereignis für einen Test. */
export function examEvent(ex) {
  const d = ex.data;
  const s = subjectById(d.subjectId);
  const kind = examKind(d.kind);
  const per = d.period ? periodsOf(timetableCtx().settings)[d.period - 1] : null;
  const topics = (d.topics || []).map((t) => `• ${t.text}`).join('\n');
  return {
    uid: `${ex.id}@schulplaner`,
    title: `${kind.label}${s ? ` ${s.data.name}` : ''}${d.title ? `: ${d.title}` : ''}`,
    date: d.date,
    start: per?.start,
    end: per?.end,
    location: s?.data.room ? `Raum ${s.data.room}` : '',
    description: [topics ? `Lernstoff:\n${topics}` : '', d.notes].filter(Boolean).join('\n\n'),
    alarm: alarmFor(settings().reminder),
  };
}

/** Kalender-Ereignis für einen Termin. */
export function eventEvent(ev) {
  const d = ev.data;
  const timed = d.allDay === false && d.time;
  return {
    uid: `${ev.id}@schulplaner`,
    title: d.title || eventKind(d.kind).label,
    date: d.date,
    endDate: d.endDate || null,
    start: timed ? d.time : undefined,
    end: timed ? d.endTime || d.time : undefined,
    description: d.notes || '',
    alarm: alarmFor(settings().reminder),
  };
}

/** .ics öffnen: mit Login über einen kurzlebigen Link (Safari: „Zum Kalender hinzufügen“), sonst als Datei. */
export async function openICS(events, name) {
  if (!events.length) { toast('Nichts zu exportieren', { icon: 'info' }); return; }
  const text = buildICS(events, { name: 'Schulplaner' });
  const file = icsFileName(name);
  const url = await publishIcs(file.replace(/\.ics$/, ''), text);
  if (url) { window.location.href = url; return; }
  const blob = new File([text], file, { type: 'text/calendar' });
  if (navigator.canShare?.({ files: [blob] }) && /iPhone|iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document) {
    try { await navigator.share({ files: [blob], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = blob.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export const exportExams = (exams) => openICS(exams.filter((e) => e.data.date).map(examEvent), exams.length === 1 ? examEvent(exams[0]).title : 'Tests');
export const exportEvent = (ev) => openICS([eventEvent(ev)], ev.data.title || 'Termin');

/** Alle anstehenden Tests auf einmal. */
export function exportUpcomingExams() {
  const t = today();
  const list = all('exam').filter((e) => e.data.date && e.data.date >= t && e.data.kind !== 'goal').sort((a, b) => a.data.date.localeCompare(b.data.date));
  return openICS(list.map(examEvent), 'Anstehende Tests');
}
