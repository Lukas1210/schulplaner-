// Tests mit Lernstoff und Ampel, Heute dran, Karteikarten-Abfrage.
const { openApp, onboard, seed } = require('./lib.cjs');

exports.run = async ({ server, check }) => {
  const app = await openApp(server);
  const { p } = app;
  await onboard(app);
  await seed(app);
  // Neuer Test über das „+“-Menü
  await app.go('/learn');
  await p.click('#fab');
  await p.click('.action-row:has-text("Test")');
  await p.waitForSelector('.action-sheet.show');
  await p.click('.action-sheet .action-row:has-text("Geschichte")');
  await p.waitForTimeout(300);
  await p.selectOption('#xf-kind', 'test');
  await p.fill('#xf-title', 'Weimarer Republik');
  check('Datum = nächste Geschichtsstunde (Fr, 20.11.)', (await p.inputValue('#xf-date')) === '2026-11-20', await p.inputValue('#xf-date'));
  check('Stunde passend vorausgewählt (2.)', (await p.inputValue('#xf-period')) === '2', await p.inputValue('#xf-period'));
  await p.fill('#xf-topics', 'Verfassung\nInflation 1923\n- Hitlerputsch');
  await p.click('.sheet.show [data-act="save"]');
  await app.sheetClosed();
  const ex = await app.S(async () => (await import('./js/store.js')).all('exam').find((e) => e.data.title === 'Weimarer Republik'));
  check('Test mit 3 Themen gespeichert', ex && ex.data.topics.length === 3 && ex.data.topics[2].text === 'Hitlerputsch', JSON.stringify(ex?.data.topics?.map((t) => t.text)));
  await app.go(`/exam/${ex.id}`);
  check('Test-Seite zeigt Countdown', (await app.text('.fact-row')).includes('1 Tag'));
  check('Vortag: Generalprobe-Hinweis', (await app.text('#view')).includes('Heute dran'));
  // Ampel antippen schaltet weiter
  await p.locator('[data-cycle]').first().click();
  await p.waitForTimeout(300);
  check('Ampel: rot → gelb', (await app.S(async (id) => (await import('./js/store.js')).get(id).data.topics[0].level, ex.id)) === 1);
  // Thema lernen → „Sitzt“
  await p.locator('[data-learn]').nth(1).click();
  await p.click('.amp-pick [data-level="2"]');
  await p.waitForTimeout(400);
  const t1 = await app.S(async (id) => (await import('./js/store.js')).get(id).data.topics[1], ex.id);
  check('Thema sitzt und zählt als heute gelernt', t1.level === 2 && t1.studied.includes('2026-11-19'), JSON.stringify(t1));
  // Thema per Einfügen mehrerer Zeilen
  await p.fill('#topic-text', 'Ruhrbesetzung');
  await p.press('#topic-text', 'Enter');
  await p.waitForTimeout(300);
  check('Weiteres Thema ergänzt', (await app.S(async (id) => (await import('./js/store.js')).get(id).data.topics.length, ex.id)) === 4);
  await app.shot('30-test-seite');
  // Heute dran auf Heute und Lernen
  await app.go('/');
  const rows = await app.count('.topic');
  check('Heute dran zeigt Themen', rows >= 3, rows);
  await app.go('/learn');
  check('Lernen zeigt Generalprobe für morgen', (await app.text('#view')).includes('Generalprobe'));
  check('Lernziel ohne Termin sichtbar', (await app.text('#view')).includes('Unregelmäßige Verben'));
  await app.shot('31-lernen');
  // Karteikarten: fällige abfragen
  await p.click('[data-go="/quiz/due"]');
  await p.waitForTimeout(500);
  check('Abfrage startet mit 4 fälligen Karten', (await app.text('.quiz-top')).includes('/ 4'));
  for (let i = 0; i < 4; i++) {
    await p.click('.quiz-actions [data-act="flip"]');
    await p.waitForTimeout(150);
    await p.click(`[data-ans="${i === 0 ? 0 : 1}"]`);
    await p.waitForTimeout(150);
  }
  // die falsche Karte kommt am Ende noch einmal
  check('Falsche Karte kommt am Ende nochmal', (await app.count('.flashcard')) === 1);
  await p.click('.quiz-actions [data-act="flip"]');
  await p.click('[data-ans="1"]');
  await p.waitForTimeout(300);
  check('Abschluss-Bildschirm', (await app.text('#view')).includes('richtig'));
  const boxes = await app.S(async () => (await import('./js/store.js')).all('card').map((c) => c.data.box).sort().join(''));
  check('Leitner: 3 Karten in Fach 2, eine bleibt in Fach 1', boxes.startsWith('1222'), boxes);
  // Stapel: Import
  const deck = await app.S(async () => (await import('./js/store.js')).all('deck')[0].id);
  await app.go(`/deck/${deck}`);
  await p.click('[data-act="import"]');
  await p.fill('#if-text', 'to deny – leugnen\nto doubt; zweifeln\nkaputt');
  check('Import erkennt 2 Karten', (await app.text('#if-count')).includes('2 Karten'));
  await p.click('.sheet.show [data-act="save"]');
  await app.sheetClosed();
  await p.waitForTimeout(300);
  check('Stapel hat jetzt 8 Karten', (await app.count('.card-line')) === 8);
  const errors = [...app.errors];
  await app.close();
  return errors;
};
