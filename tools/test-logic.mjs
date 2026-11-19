// Unit-Tests für die reine Logik (ohne Browser): Noten, Stundenplan, Lernplan, Karteikarten, Ferien, .ics.
// Aufruf: node tools/test-logic.mjs
process.env.TZ = 'Europe/Berlin';

const D = await import('../app/js/logic/dates.js');
const G = await import('../app/js/logic/grades.js');
const T = await import('../app/js/logic/timetable.js');
const P = await import('../app/js/logic/plan.js');
const C = await import('../app/js/logic/cards.js');
const H = await import('../app/js/logic/holidays.js');
const I = await import('../app/js/logic/ics.js');

let failed = 0, passed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra !== '' ? ` (${extra})` : ''}`);
  if (ok) passed++; else failed++;
};
const eq = (name, a, b) => check(name, JSON.stringify(a) === JSON.stringify(b), `erwartet ${JSON.stringify(b)}, bekommen ${JSON.stringify(a)}`);
const near = (name, a, b, eps = 1e-6) => check(name, a != null && Math.abs(a - b) < eps, `erwartet ${b}, bekommen ${a}`);

// ---------- Datum ----------
console.log('\nDatum');
eq('Wochentag Do 19.11.2026', D.isoDow('2026-11-19'), 4);
eq('Montag der Woche', D.mondayOf('2026-11-19'), '2026-11-16');
eq('KW 47', D.isoWeek('2026-11-19'), 47);
eq('KW 53 im Jahr 2026', D.isoWeek('2026-12-31'), 53);
eq('KW 1 2021 (4.1.)', D.isoWeek('2021-01-04'), 1);
eq('fmtDay', D.fmtDay('2026-11-20'), 'Fr, 20.11.');
eq('fmtLong', D.fmtLong('2026-11-20'), 'Freitag, 20. November');
eq('relDay morgen', D.relDay('2026-11-20', '2026-11-19'), 'morgen');
eq('relDay in 5 Tagen', D.relDay('2026-11-24', '2026-11-19'), 'in 5 Tagen');
eq('dueLabel Wochentag', D.dueLabel('2026-11-23', '2026-11-19'), 'Montag');
eq('daysBetween über Zeitumstellung', D.daysBetween('2026-10-24', '2026-10-26'), 2);
eq('addDays Monatswechsel', D.addDays('2026-11-30', 1), '2026-12-01');
const sy = D.schoolYear({}, '2026-11-19');
eq('Schuljahr Standard', [sy.start, sy.half, sy.end, sy.label], ['2026-08-01', '2027-02-01', '2027-07-31', '2026/27']);
const sy2 = D.schoolYear({ yearStart: '2026-09-08', halfStart: '2027-02-15' }, '2026-11-19');
eq('Schuljahr eigene Daten', [sy2.start, sy2.half], ['2026-09-08', '2027-02-15']);
eq('Sommerferien vor Schulstart gehören zum alten Jahr', D.schoolYear({ yearStart: '2026-09-08' }, '2026-08-20').start, '2025-08-01');
eq('Alte Einstellung im nächsten Jahr ignoriert', D.schoolYear({ yearStart: '2025-09-10' }, '2026-11-19').start, '2026-08-01');
eq('Halbjahr', [D.halfOf('2027-01-31', sy), D.halfOf('2027-02-01', sy)], [1, 2]);

// ---------- Noten ----------
console.log('\nNoten');
eq('parse 2', G.parseGrade('2'), { value: 2, label: '2' });
eq('parse 2+ (0,25)', G.parseGrade('2+'), { value: 1.75, label: '2+' });
eq('parse 2- (0,3)', G.parseGrade('2-', 0.3), { value: 2.3, label: '2−' });
eq('parse 2− mit echtem Minus', G.parseGrade('2−').value, 2.25);
eq('parse 1+ (0,33)', G.parseGrade('1+', 1 / 3).value, 0.667);
eq('parse 2-3', G.parseGrade('2-3'), { value: 2.5, label: '2–3' });
eq('parse 2 – 3 mit Leerzeichen', G.parseGrade('2 – 3').value, 2.5);
eq('parse 1,7', G.parseGrade('1,7'), { value: 1.7, label: '1,7' });
eq('parse 2.25 → Label 2−', G.parseGrade('2.25').label, '2−');
eq('parse 6- ungültig', G.parseGrade('6-'), null);
eq('parse 7 ungültig', G.parseGrade('7'), null);
eq('parse 3-5 ungültig', G.parseGrade('3-5'), null);
eq('parse leer', G.parseGrade(''), null);
eq('Skala 0,25 Anfang', G.scale(0.25).slice(0, 4).map((x) => x.label), ['1+', '1', '1−', '2+']);
eq('Skala Länge', G.scale().length, 17);
eq('fmtAvg', G.fmtAvg(2.3333), '2,33');
// Beispiel aus der Planung: schriftlich 2−, 3+, 2 · mündlich 2, 1− (0,25) → Ø 1,98
const ex = [
  { value: 2.25, cat: 'written' }, { value: 2.75, cat: 'written' }, { value: 2, cat: 'written' },
  { value: 2, cat: 'oral' }, { value: 1.25, cat: 'oral' },
];
const sa = G.subjectAverage(ex, 50);
near('Fach-Ø 50:50', sa.avg, 1.979166667);
near('Teil-Ø schriftlich', sa.written.avg, 2.333333333);
eq('nicht vorläufig', sa.provisional, false);
near('Fach-Ø 2:1', G.subjectAverage(ex, 200 / 3).avg, (2.333333333 * 2 + 1.625) / 3);
near('Alle gleich', G.subjectAverage(ex, null).avg, (2.25 + 2.75 + 2 + 2 + 1.25) / 5);
const prov = G.subjectAverage([{ value: 3, cat: 'oral' }], 50);
eq('nur mündlich → vorläufig', [prov.avg, prov.provisional], [3, true]);
near('Einzelgewicht ×2', G.subjectAverage([{ value: 1, cat: 'oral', weight: 2 }, { value: 4, cat: 'oral' }], 50).avg, 2);
eq('ohne Noten', G.subjectAverage([], 50).avg, null);
near('Gesamtschnitt', G.overallAverage([{ avg: 2 }, { avg: 3 }, { avg: null }]).avg, 2.5);
near('Gesamtschnitt Hauptfach doppelt', G.overallAverage([{ avg: 2, main: true }, { avg: 3.5 }], { mainDouble: true }).avg, 2.5);
eq('Prognose 2,3', G.reportGrade(2.3), { grade: 2, alt: null, exact: false });
eq('Prognose 2,45 wackelt', G.reportGrade(2.45), { grade: 2, alt: 3, exact: false });
eq('Prognose 2,55 wackelt', G.reportGrade(2.55), { grade: 3, alt: 2, exact: false });
eq('Prognose genau 2,5', G.reportLabel(G.reportGrade(2.5)), '2–3');
eq('Prognose 0,8 → 1', G.reportGrade(0.8).grade, 1);
eq('Prognose 1,05 wackelt nicht', G.reportGrade(1.05).alt, null);
// Zielnoten-Rechner (Beispiel aus der Planung): schriftlich 3 und 2, mündlich 3+ und 2− → Ø 2,50, Ziel 2 → mindestens 2−
const zg = [{ value: 3, cat: 'written' }, { value: 2, cat: 'written' }, { value: 2.75, cat: 'oral' }, { value: 2.25, cat: 'oral' }];
near('Ausgangs-Ø 2,50', G.subjectAverage(zg, 50).avg, 2.5);
const need = G.requiredGrade({ grades: zg, written: 50, cat: 'written', target: 2, tendency: 0.25 });
eq('Zielnote 2 → mindestens 2−', [need.status, need.label], ['need', '2−']);
check('Ergebnis liegt unter 2,5', need.result < 2.5, need.result);
eq('schon sicher', G.requiredGrade({ grades: [{ value: 1, cat: 'written' }, { value: 1, cat: 'oral' }, { value: 1, cat: 'oral' }], written: 50, cat: 'oral', target: 3 }).status, 'safe');
const imp = G.requiredGrade({ grades: [{ value: 5, cat: 'written' }, { value: 5, cat: 'written' }, { value: 5, cat: 'oral' }], written: 50, cat: 'written', target: 2 });
eq('nicht erreichbar', imp.status, 'impossible');
check('bestenfalls-Wert vorhanden', imp.best > 2.5, imp.best);
eq('ohne Noten: Ziel 2 → 2−', G.requiredGrade({ grades: [], written: 50, cat: 'written', target: 2 }).label, '2−');
const ra = G.runningAverages([{ value: 2, cat: 'written', date: '2026-10-01' }, { value: 1, cat: 'oral', date: '2026-09-20' }], 50);
eq('Verlauf sortiert', ra.map((r) => r.date), ['2026-09-20', '2026-10-01']);
near('Verlauf Ø', ra[1].avg, 1.5);
eq('Tönung', [G.gradeTone(1.5), G.gradeTone(3), G.gradeTone(4.2), G.gradeTone(5)], ['good', 'ok', 'weak', 'bad']);

// ---------- Stundenplan ----------
console.log('\nStundenplan');
eq('Standard-Stundenzeiten', [T.DEFAULT_PERIODS[0], T.DEFAULT_PERIODS[2]], [{ start: '08:00', end: '08:45' }, { start: '09:55', end: '10:40' }]);
const s = { days: 5, abWeeks: true, abRef: '2026-11-16' };
eq('A-Woche', T.weekType('2026-11-19', s), 'A');
eq('B-Woche', T.weekType('2026-11-23', s), 'B');
eq('A-Woche vor zwei Wochen', T.weekType('2026-11-04', s), 'A');
eq('Referenz für B', T.weekType('2026-11-19', { ...s, abRef: T.refForWeek('2026-11-19', 'B') }), 'B');
eq('ohne A/B', T.weekType('2026-11-19', { abWeeks: false }), null);
const lessons = [
  { subjectId: 'm', day: 1, period: 1 }, { subjectId: 'm', day: 1, period: 2 },
  { subjectId: 'm', day: 5, period: 1 },
  { subjectId: 'd', day: 2, period: 3 },
  { subjectId: 'e', day: 3, period: 1, week: 'A' },
  { subjectId: 'e', day: 4, period: 2, week: 'B' },
];
const free = new Set(['2026-11-20']);
const ctx = { settings: s, lessons, isFree: (d) => free.has(d) };
eq('nächste Mathe-Stunde (Fr frei → Mo)', T.nextLessonDate('m', '2026-11-19', ctx), '2026-11-23');
eq('übernächste Mathe-Stunde', T.nextLessonDate('m', '2026-11-19', ctx, { skip: 1 }), '2026-11-27');
eq('Englisch nur in A-Wochen (Mi)', T.nextLessonDate('e', '2026-11-19', ctx), '2026-11-26');
eq('Fach ohne Stunden', T.nextLessonDate('x', '2026-11-19', ctx), null);
eq('Doppelstunde als Block', T.blocks(T.lessonsOn(lessons, '2026-11-16', s), T.DEFAULT_PERIODS).map((b) => [b.subjectId, b.from, b.to, b.start, b.end]), [['m', 1, 2, 480, 575]]);
const nn = T.nowAndNext('2026-11-16', 8 * 60 + 10, ctx);
eq('jetzt Mathe-Doppelstunde', [nn.current?.subjectId, nn.next?.subjectId, nn.nextDate], ['m', 'd', '2026-11-17']);
eq('Schultage bis Freitag (Fr frei)', T.schoolDaysBetween('2026-11-16', '2026-11-21', ctx), 4);
eq('3 Schultage nach Do (Fr frei)', T.addSchoolDays('2026-11-19', 3, ctx), '2026-11-25');
eq('Stunden im Zeitraum Mo–Di', T.lessonsInRange('2026-11-16', '2026-11-17', ctx).length, 3);
eq('Wochenstunden Englisch (A/B halb)', T.hoursPerWeek(lessons, 'e'), 1);

// ---------- Lernplan ----------
console.log('\nLernplan');
const topic = (id, level, studied = []) => ({ id, text: id, level, studied });
const today = '2026-11-19';
const examA = { id: 'A', date: '2026-11-23', topics: [topic('a1', 0), topic('a2', 0), topic('a3', 0), topic('a4', 1), topic('a5', 1)] };
let plan = P.todayPlan({ exams: [examA], today, cap: 5 });
eq('4 Tage, 8 Einheiten → 2 Themen, rote zuerst', plan.items.map((i) => i.topicId), ['a1', 'a2']);
const examB = { ...examA, topics: [topic('a1', 1, [today]), topic('a2', 0), topic('a3', 0), topic('a4', 1), topic('a5', 1)] };
plan = P.todayPlan({ exams: [examB], today, cap: 5 });
eq('heute gelerntes zählt mit', plan.items.map((i) => [i.topicId, i.done]), [['a1', true], ['a2', false]]);
plan = P.todayPlan({ exams: [{ ...examA, date: '2026-11-20' }], today, cap: 3 });
eq('Vortag: Generalprobe + Limit 3', [plan.rehearsals, plan.items.length], [['A'], 3]);
plan = P.todayPlan({ exams: [{ id: 'X', date: today, topics: [topic('x', 0)] }, { id: 'Y', date: '2026-11-25', topics: [] }], today });
eq('Test heute und Test ohne Stoff', [plan.examsToday, plan.missing, plan.items.length], [['X'], ['Y'], 0]);
plan = P.todayPlan({ exams: [{ id: 'G', date: null, topics: [topic('g1', 1, ['2026-11-01']), topic('g2', 0), topic('g3', 2)] }], today, cap: 5 });
eq('Lernziele ohne Datum füllen auf (max. 2, schwächste zuerst)', plan.items.map((i) => i.topicId), ['g2', 'g1']);
plan = P.todayPlan({ exams: [{ id: 'F', date: '2026-12-31', topics: [topic('f', 0)] }], today });
eq('Test außerhalb von 4 Wochen ignoriert', plan.items.length, 0);
eq('Fortschritt', P.examProgress(examA), { red: 3, yellow: 2, green: 0, total: 5, pct: 0.2 });

// ---------- Karteikarten ----------
console.log('\nKarteikarten');
eq('richtig: Fach 1 → 2, in 2 Tagen', C.review({ box: 1 }, true, today), { box: 2, due: '2026-11-21', last: today });
eq('richtig in Fach 5 bleibt 5 (16 Tage)', C.review({ box: 5 }, true, today).due, '2026-12-05');
eq('falsch → Fach 1, morgen', C.review({ box: 4 }, false, today), { box: 1, due: '2026-11-20', last: today });
eq('fällig', [C.isDue({ due: today }, today), C.isDue({ due: '2026-11-20' }, today), C.isDue({}, today)], [true, false, true]);
eq('Import', C.parseImport('house – Haus\ndog - Hund\n\ncat\tKatze\nnichts\nVerb ; Tätigkeitswort'), [
  { front: 'house', back: 'Haus' }, { front: 'dog', back: 'Hund' }, { front: 'cat', back: 'Katze' }, { front: 'Verb', back: 'Tätigkeitswort' },
]);
eq('Fächer zählen', C.boxCounts([{ box: 1 }, { box: 1 }, { box: 3 }, {}]), [0, 3, 0, 1, 0, 0]);
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
eq('Mischen behält alle', C.shuffle([1, 2, 3, 4], rnd).sort(), [1, 2, 3, 4]);

// ---------- Ferien ----------
console.log('\nFerien');
const apiSchool = [
  { id: '1', startDate: '2026-12-23', endDate: '2027-01-09', type: 'School', name: [{ language: 'DE', text: 'Weihnachtsferien' }], nationwide: false, subdivisions: [{ code: 'DE-BY', shortName: 'BY' }] },
  { id: '2', startDate: '2026-11-18', endDate: '2026-11-18', type: 'School', name: [{ language: 'DE', text: 'Buß- und Bettag' }], nationwide: false, subdivisions: [{ code: 'DE-BY', shortName: 'BY' }] },
  { id: '3', startDate: '2026-10-26', endDate: '2026-10-30', type: 'School', name: [{ language: 'DE', text: 'Herbstferien' }], nationwide: false, subdivisions: [{ code: 'DE-NW', shortName: 'NW' }] },
];
const apiPublic = [
  { id: '4', startDate: '2026-12-25', endDate: '2026-12-25', type: 'Public', name: [{ language: 'EN', text: 'Christmas' }, { language: 'DE', text: '1. Weihnachtstag' }], nationwide: true },
  { id: '5', startDate: '2026-11-01', endDate: '2026-11-01', type: 'Public', name: [{ language: 'DE', text: 'Allerheiligen' }], nationwide: false, subdivisions: [{ code: 'DE-BY' }] },
];
const hol = [...H.normalizeHolidays(apiSchool, 'school', 'BY'), ...H.normalizeHolidays(apiPublic, 'public', 'BY')];
eq('fremdes Bundesland gefiltert', hol.length, 4);
eq('deutscher Name', hol.find((h) => h.start === '2026-12-25').name, '1. Weihnachtstag');
eq('holidayOn Ferien', H.holidayOn(hol, '2027-01-05')?.name, 'Weihnachtsferien');
eq('holidayOn Schultag', H.holidayOn(hol, '2026-11-19'), null);
const cn = H.currentOrNextHoliday(hol, '2026-11-19');
eq('nächste Ferien', [cn.current, cn.next?.name], [null, 'Weihnachtsferien']);
eq('kaputte Einträge ignoriert', H.normalizeHolidays([{ foo: 1 }, null, { startDate: 'x' }], 'school', 'BY'), []);
eq('Bundesland-Name', H.stateName('NW'), 'Nordrhein-Westfalen');
check('API-Adresse', H.holidayUrls('BY', '2026-08-01', '2027-12-31').school.includes('subdivisionCode=DE-BY'));

// ---------- .ics ----------
console.log('\n.ics');
const ics = I.buildICS([{ uid: 'u1@schulplaner', title: 'Mathe-Klassenarbeit, Analysis; Teil 1', date: '2026-11-24', start: '08:00', end: '09:35', description: 'Themen:\n- Ableitungen', alarm: I.alarmFor('eve') }]);
check('VEVENT mit Zeit', ics.includes('DTSTART:20261124T080000') && ics.includes('DTEND:20261124T093500'));
check('Escaping', ics.includes('SUMMARY:Mathe-Klassenarbeit\\, Analysis\\; Teil 1'));
check('Erinnerung Vortag 18 Uhr', ics.includes('TRIGGER:-PT840M'), ics.match(/TRIGGER:[^\r]*/)?.[0]);
check('CRLF-Zeilenenden', ics.includes('\r\n') && !/[^\r]\n/.test(ics));
eq('Weckzeit', I.alarmDate({ date: '2026-11-24', start: '08:00', alarm: { daysBefore: 1, at: '18:00' } }), '2026-11-23 18:00');
const allDay = I.buildICS([{ uid: 'u2', title: 'Wandertag', date: '2026-11-25', alarm: I.alarmFor('2d') }]);
check('ganztägig', allDay.includes('DTSTART;VALUE=DATE:20261125') && allDay.includes('DTEND;VALUE=DATE:20261126'));
check('ganztägig 2 Tage vorher (23.11. 18 Uhr)', allDay.includes('TRIGGER:-PT1800M'), allDay.match(/TRIGGER:[^\r]*/)?.[0]);
const long = I.foldLine(`DESCRIPTION:${'ä'.repeat(60)}`);
check('Falten nach 75 Bytes', long.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75) && long.split('\r\n').length > 1);
eq('Dateiname', I.icsFileName('Mathe: Klassenarbeit!'), 'mathe-klassenarbeit.ics');

console.log(`\n${failed ? '✗' : '✓'} ${passed} bestanden, ${failed} fehlgeschlagen`);
process.exit(failed ? 1 : 0);
