// iPad: Seitenleiste, zweispaltige Ansichten, breiter Wochenplan, nichts ragt über den Rand.
const { openApp, onboard, seed } = require('./lib.cjs');

exports.run = async ({ server, check }) => {
  const errors = [];
  for (const device of ['ipad', 'ipad-land', 'ipad-pro']) {
    const app = await openApp(server, { device });
    const { p } = app;
    await onboard(app);
    await seed(app);
    const routes = ['/', '/calendar', '/tasks', '/learn', '/grades', '/subjects', '/timetable', '/absences', '/settings'];
    const sid = await app.S(async () => (await import('./js/store.js')).all('subject').find((s) => s.data.name === 'Mathe').id);
    routes.push(`/grades/${sid}`, `/subject/${sid}`);
    let worst = 0;
    for (const r of routes) {
      await app.go(r, 500);
      worst = Math.max(worst, await app.overflowX());
    }
    check(`${device}: kein waagerechtes Scrollen auf allen Seiten`, worst <= 0, worst);
    await app.go('/');
    const cols = await p.evaluate(() => getComputedStyle(document.querySelector('.cols')).gridTemplateColumns.split(' ').length);
    if (device === 'ipad-land') check(`${device}: Heute zweispaltig`, cols === 2, cols);
    await app.shot(`60-${device}-heute`);
    await app.go('/calendar');
    const cell = await p.locator('.tt-cell.filled').first().boundingBox();
    check(`${device}: Wochenplan-Zellen breit genug`, cell && cell.width >= 80, JSON.stringify(cell));
    await app.shot(`61-${device}-kalender`);
    await app.go(`/grades/${sid}`);
    await app.shot(`62-${device}-noten`);
    errors.push(...app.errors);
    await app.close();
  }
  return errors;
};
