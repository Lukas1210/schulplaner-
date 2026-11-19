// Hausaufgaben: Schnelleingabe mit „nächste Stunde“, Formular, Abhaken, Gruppen.
const { openApp, onboard, seed } = require('./lib.cjs');

exports.run = async ({ server, check }) => {
  const app = await openApp(server);
  const { p } = app;
  await onboard(app);
  await seed(app);
  await app.go('/tasks');
  check('Schnelleingabe schlägt das Fach der laufenden Stunde vor', (await app.text('[data-qa="subject"]')).includes('Mathe'));
  check('… mit Fälligkeit nächste Stunde (Fr, 20.11.)', (await app.text('[data-qa="due"]')).includes('Fr, 20.11.'));
  await p.fill('#qa-text', 'Arbeitsheft S. 12');
  await p.press('#qa-text', 'Enter');
  await p.waitForTimeout(400);
  const t = await app.S(async () => (await import('./js/store.js')).all('task').find((x) => x.data.text === 'Arbeitsheft S. 12')?.data);
  const mathe = await app.S(async () => (await import('./js/store.js')).all('subject').find((s) => s.data.name === 'Mathe').id);
  check('Hausaufgabe mit Fach und Datum gespeichert', t && t.subjectId === mathe && t.due === '2026-11-20', JSON.stringify(t));
  const txt = (await app.text('#view')).toUpperCase();
  check('Gruppen: Überfällig, Heute, Morgen', ['ÜBERFÄLLIG', 'HEUTE', 'MORGEN'].every((g) => txt.includes(g)));
  // Formular: Englisch → nächste Englisch-Stunde (Fr 3. Stunde → Fr 20.11.)
  await p.click('#fab');
  await p.fill('#tf-text', 'Vokabeltest vorbereiten');
  await p.click('.sheet.show [data-pick="subject"]');
  await p.click('.action-sheet .action-row:has-text("Englisch")');
  await p.waitForTimeout(300);
  check('Fälligkeit springt auf die nächste Englisch-Stunde', (await p.inputValue('#tf-date')) === '2026-11-20', await p.inputValue('#tf-date'));
  await p.click('.sheet.show [data-due]:has-text("Übernächste")');
  check('Übernächste Stunde wählbar (Mo, 23.11.)', (await p.inputValue('#tf-date')) === '2026-11-23', await p.inputValue('#tf-date'));
  await p.click('.sheet.show [data-act="save"]');
  await app.sheetClosed();
  await p.waitForTimeout(500);
  // Abhaken
  const before = await app.count('.todo:not(.done)');
  await p.locator('.todo:not(.done) .check').first().click();
  await p.waitForTimeout(500);
  check('Abhaken entfernt aus „offen“', (await app.count('.todo:not(.done)')) === before - 1);
  // Filter
  await p.click('[data-filter]:has-text("Mathe")');
  await p.waitForTimeout(300);
  const subs = await p.locator('.todo-sub').allInnerTexts();
  check('Filter nach Fach', subs.length >= 1);
  await p.click('[data-filter=""]');
  await app.shot('20-aufgaben');
  // Heute: Abhaken direkt auf der Startseite
  await app.go('/');
  const n = await app.count('.todo:not(.done)');
  await p.locator('.todo:not(.done) .check').first().click();
  await p.waitForTimeout(500);
  check('Abhaken auf Heute', (await app.count('.todo:not(.done)')) === n - 1);
  const badge = await p.locator('#tabbar [data-badge="tasks"]').innerText();
  check('Badge an „Aufgaben“ zählt Fälliges', /^\d+$/.test(badge.trim()), badge);
  const errors = [...app.errors];
  await app.close();
  return errors;
};
