// Ferien & unterrichtsfreie Tage, Kalender-Export (.ics), Fehltage mit Entschuldigung und „Stoff nachholen“.
const fs = require('fs');
const { openApp, onboard, seed } = require('./lib.cjs');

exports.run = async ({ server, check }) => {
  const app = await openApp(server);
  const { p } = app;
  await onboard(app);
  await seed(app);
  await app.go('/');
  check('Ferien-Countdown auf Heute', (await app.text('.hero-chips')).includes('Weihnachtsferien'));
  // Monat: Ferientage markiert
  await app.go('/calendar');
  await p.click('[data-mode="month"]');
  await p.click('[data-act="next"]');
  await p.waitForTimeout(300);
  check('Dezember: Ferientage hervorgehoben', (await app.count('.cal-day.free:not(.other)')) >= 9, await app.count('.cal-day.free:not(.other)'));
  await p.click('[data-day="2026-12-23"]');
  check('Tagesliste nennt die Ferien', (await app.text('#view')).includes('Weihnachtsferien'));
  await p.click('[data-mode="list"]');
  check('Liste zeigt Tests und Termine', (await app.text('#view')).includes('Wandertag') && (await app.text('#view')).includes('Klassenarbeit'));
  // Unterrichtsfrei am Freitag → „nächste Stunde“ springt auf Montag
  await p.click('#fab');
  await p.click('.action-row:has-text("Unterrichtsfrei")');
  await p.fill('#ef-date', '2026-11-20');
  await p.click('.sheet.show [data-act="save"]');
  await app.sheetClosed();
  await app.go('/tasks');
  check('Nächste Mathe-Stunde überspringt den freien Freitag', (await app.text('[data-qa="due"]')).includes('Mo, 23.11.'), await app.text('[data-qa="due"]'));
  await app.go('/calendar');
  await p.click('[data-mode="week"]');
  await p.waitForTimeout(200);
  const freeLabels = await p.locator('.tt-free-label').allInnerTexts();
  check('Freier Tag in der Woche als „frei“', freeLabels.some((x) => x.includes('Unterrichtsfrei')), freeLabels.join(' / '));
  // .ics für die Mathe-Arbeit (ohne Login → Datei)
  const exam = await app.S(async () => (await import('./js/store.js')).all('exam').find((e) => e.data.title === 'Quadratische Funktionen').id);
  await app.go(`/exam/${exam}`);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }), p.click('[data-act="ics"]')]);
  const text = fs.readFileSync(await dl.path(), 'utf8');
  check('.ics-Datei mit Termin', /DTSTART:20261123T080000/.test(text) && text.includes('SUMMARY:Klassenarbeit Mathe: Quadratische Funktionen'), text.match(/DTSTART[^\r]*/)?.[0]);
  check('… mit Erinnerung am Vortag 18 Uhr', text.includes('TRIGGER:-PT840M'));
  check('… und dem Lernstoff', text.includes('Scheitelpunktform'));
  // Fehltag heute → Hinweis auf Heute, Stunden aus dem Stundenplan
  await app.go('/absences');
  await p.click('#fab');
  check('Frist wird angezeigt', (await app.text('#af-info')).includes('Frist'));
  await p.click('.sheet.show [data-act="save"]');
  await app.sheetClosed();
  await p.waitForTimeout(300);
  check('Fehlstunden aus dem Stundenplan (Do: 6)', (await app.text('.stat-grid')).includes('6'), await app.text('.stat-grid'));
  check('Entschuldigung offen', await p.isVisible('[data-submit]'));
  await app.go('/');
  check('Heute erinnert an die Entschuldigung', (await app.text('#view')).includes('Entschuldigung'));
  await app.go('/absences');
  await p.click('[data-catchup]');
  await p.waitForTimeout(400);
  const catchUp = await app.S(async () => (await import('./js/store.js')).all('task').filter((t) => t.data.text.startsWith('Stoff vom')).length);
  check('„Stoff nachholen“ legt Aufgaben je Fach an', catchUp >= 4, catchUp);
  await p.click('[data-submit]');
  await p.waitForTimeout(300);
  check('Als abgegeben markiert', !(await p.isVisible('[data-submit]')));
  await app.shot('50-fehltage');
  // Ferien-API nicht erreichbar → App läuft weiter
  const errors = [...app.errors];
  await app.close();
  const off = await openApp(server, { holidays: false });
  await onboard(off);
  check('Ohne Ferien-API startet die App trotzdem', await off.p.isVisible('.hero'));
  errors.push(...off.errors.filter((e) => !/openholidays|ERR_FAILED/i.test(e)));
  await off.close();
  return errors;
};
