// Stundenplan: malen, Zelle bearbeiten, A/B-Wochen, Stundenzeiten – und „Jetzt“ auf Heute.
const { openApp, onboard } = require('./lib.cjs');

exports.run = async ({ server, check }) => {
  const app = await openApp(server);
  const { p } = app;
  await onboard(app, { later: false });
  check('Onboarding führt zum Stundenplan', (await p.evaluate(() => location.hash)) === '#/timetable');
  const sid = (name) => app.S(async (n) => (await import('./js/store.js')).all('subject').find((s) => s.data.name === n).id, name);
  const mathe = await sid('Mathe');
  const deutsch = await sid('Deutsch');
  // Malen: Mathe auf Mo 1, Mo 2, Do 2, Fr 1
  await p.click(`[data-paint="${mathe}"]`);
  for (const c of ['1:1', '1:2', '4:2', '5:1']) await p.click(`[data-cell="${c}"]`);
  await p.waitForTimeout(400);
  let lessons = await app.S(async () => (await import('./js/store.js')).all('lesson').map((l) => `${l.data.day}:${l.data.period}`).sort());
  check('Vier Mathe-Stunden gemalt', JSON.stringify(lessons) === JSON.stringify(['1:1', '1:2', '4:2', '5:1']), lessons.join(','));
  await p.click('[data-cell="5:1"]');
  await p.waitForTimeout(300);
  check('Gleiches Fach nochmal tippen entfernt die Stunde', (await app.S(async () => (await import('./js/store.js')).all('lesson').length)) === 3);
  await p.click(`[data-paint="${mathe}"]`); // Malen aus
  // Zelle per Sheet: Deutsch am Do 3. Stunde, Raum 112
  await p.click('[data-cell="4:3"]');
  await p.waitForSelector('.action-sheet.show');
  await p.click('.action-sheet .action-row:has-text("Deutsch")');
  await p.waitForTimeout(300);
  await p.fill('#tc-room', '112');
  await p.click('.sheet.show [data-act="save"]');
  await app.sheetClosed();
  await p.waitForTimeout(300);
  const dl = await app.S(async (id) => (await import('./js/store.js')).all('lesson').find((l) => l.data.subjectId === id)?.data, deutsch);
  check('Deutsch mit Raum gespeichert', dl && dl.day === 4 && dl.period === 3 && dl.room === '112', JSON.stringify(dl));
  await app.shot('10-stundenplan');
  // A/B-Wochen: B-Woche bearbeiten und Mo 1 durch Deutsch ersetzen
  await p.click('label[for="tt-ab"]');
  await p.waitForTimeout(400);
  await p.click('[data-week="B"]');
  await p.click(`[data-paint="${deutsch}"]`);
  await p.click('[data-cell="1:1"]');
  await p.waitForTimeout(400);
  const ab = await app.S(async () => (await import('./js/store.js')).all('lesson').filter((l) => l.data.day === 1 && l.data.period === 1).map((l) => l.data.week).sort());
  check('Mo 1: Mathe nur A-Woche, Deutsch nur B-Woche', JSON.stringify(ab) === JSON.stringify(['A', 'B']), ab.join(','));
  check('Hinweis zur aktuellen Woche', (await app.text('#view')).includes('Diese Woche ist eine A-Woche'));
  // Stundenzeiten: 8 Stunden à 45 Minuten ab 7:55
  await p.click('[data-act="times"]');
  await p.fill('#pg-start', '07:55');
  await p.selectOption('#pg-count', '8');
  await p.click('[data-gen]');
  await p.click('.sheet.show [data-act="save"]');
  await app.sheetClosed();
  const per = await app.S(async () => (await import('./js/store.js')).settings().periods);
  check('Stundenzeiten neu berechnet', per.length === 8 && per[0].start === '07:55' && per[0].end === '08:40', JSON.stringify(per.slice(0, 2)));
  // Heute: Do 9:00 → 2. Stunde (08:45–09:30) Mathe läuft
  await app.go('/');
  check('Heute zeigt die laufende Stunde', (await app.text('.now-card')).includes('Mathe') && (await app.text('.now-card')).toUpperCase().includes('JETZT'));
  check('… und was danach kommt', (await app.text('.now-card')).includes('Deutsch'));
  // Kalender-Woche zeigt den Stundenplan
  await app.go('/calendar');
  check('Kalender-Woche zeigt Stunden', (await app.count('.tt-cell.filled')) >= 3);
  check('Laufende Stunde hervorgehoben', (await app.count('.tt-cell.now')) === 1);
  await app.shot('11-kalender-woche');
  const errors = [...app.errors];
  await app.close();
  return errors;
};
