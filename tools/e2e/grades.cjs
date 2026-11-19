// Noten: Eingabe mit Tasten, Schnitte, Prognose, Verlauf, Zielnoten-Rechner, Note zum Test.
const { openApp, onboard, seed } = require('./lib.cjs');

exports.run = async ({ server, check }) => {
  const app = await openApp(server);
  const { p } = app;
  await onboard(app);
  await seed(app);
  await app.go('/grades');
  check('Gesamtschnitt wird angezeigt', /\d,\d\d/.test(await app.text('.avg-hero .big')), await app.text('.avg-hero .big'));
  // Erwarteter Gesamtschnitt aus der Logik
  const expected = await app.S(async () => {
    const G = await import('./js/grades-data.js');
    const L = await import('./js/logic/grades.js');
    return L.fmtAvg(G.overallStats(G.currentTerm()).avg);
  });
  check('Gesamtschnitt stimmt mit der Rechnung', (await app.text('.avg-hero .big')) === expected, expected);
  check('Mathe-Zeile mit Prognose', (await app.text('.subj-row:has-text("Mathe")')).includes('2'));
  await app.shot('40-noten');
  // Neue Note: Mathe 1−
  await p.click('#fab');
  await p.waitForSelector('.action-sheet.show');
  await p.click('.action-sheet .action-row:has-text("Mathe")');
  await p.waitForTimeout(300);
  await p.click('[data-base="1"]');
  await p.click('[data-tend="-"]');
  await p.waitForTimeout(200);
  const after = await app.text('#gf-after');
  check('„Ø danach“ wird live berechnet', /→\s*\d,\d\d/.test(after), after);
  await p.selectOption('#gf-kind', 'test');
  check('Test zählt standardmäßig mündlich', await p.locator('#gf-cat [data-cat="oral"]').evaluate((b) => b.classList.contains('active')));
  await p.click('#gf-weight [data-weight="2"]');
  await p.click('.sheet.show [data-act="save"]');
  await app.sheetClosed();
  const g = await app.S(async () => (await import('./js/store.js')).all('grade').find((x) => x.data.label === '1−')?.data);
  check('Note 1− gespeichert (×2, mündlich)', g && g.value === 1.25 && g.weight === 2 && g.cat === 'oral', JSON.stringify(g));
  // Fach-Notenseite
  const mathe = await app.S(async () => (await import('./js/store.js')).all('subject').find((s) => s.data.name === 'Mathe').id);
  await app.go(`/grades/${mathe}`);
  check('Kategorien schriftlich/mündlich', (await app.text('#view')).includes('Schriftlich') && (await app.text('#view')).includes('Mündlich'));
  check('Verlaufsdiagramm gezeichnet', (await app.count('svg.chart')) === 1);
  const box = await p.locator('svg.chart').boundingBox();
  check('Diagramm passt in die Seite', box && box.x >= 0 && box.x + box.width <= 393, JSON.stringify(box));
  await p.locator('svg.chart .hit').last().click();
  check('Antippen zeigt den Wert', await p.isVisible('.chart-tip'));
  check('Zielnoten-Rechner antwortet', /mindestens|sicher|reicht es nicht/.test(await app.text('.calc-card')), await app.text('.calc-result'));
  await p.selectOption('#zc-target', '1');
  await p.waitForTimeout(200);
  check('Rechner reagiert auf Ziel 1', /Ø/.test(await app.text('.calc-result')));
  await app.shot('41-noten-fach');
  // Note zu einem vergangenen Test: Hinweis auf Heute
  const examId = await app.S(async () => {
    const S = await import('./js/store.js');
    const sub = S.all('subject').find((s) => s.data.name === 'Deutsch').id;
    return (await S.save('exam', { subjectId: sub, kind: 'ka', title: 'Erörterung', date: '2026-11-12', period: 3, notes: '', topics: [], gradeId: null })).id;
  });
  await app.go('/');
  check('Heute fragt nach der Note', await p.isVisible(`[data-grade-for="${examId}"]`));
  await p.click(`[data-grade-for="${examId}"]`);
  await p.waitForTimeout(450);
  await p.click('[data-base="2"]');
  await p.click('.sheet.show [data-act="save"]');
  await app.sheetClosed();
  await p.waitForTimeout(300);
  const linked = await app.S(async (id) => { const S = await import('./js/store.js'); const e = S.get(id); return e.data.gradeId && S.get(e.data.gradeId)?.data.label; }, examId);
  check('Note mit dem Test verknüpft', linked === '2', linked);
  check('Hinweis verschwindet', !(await p.isVisible(`[data-grade-for="${examId}"]`)));
  const errors = [...app.errors];
  await app.close();
  return errors;
};
