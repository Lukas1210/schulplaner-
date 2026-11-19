// Grundlagen: Onboarding, Navigation, Einstellungen, Farbwelten, Offline, iPad-Layout.
const { openApp, onboard } = require('./lib.cjs');

exports.run = async ({ server, check }) => {
  const app = await openApp(server);
  const { p } = app;
  check('Onboarding startet', await p.isVisible('.onb [data-go="profile"]'));
  await app.shot('01-onboarding');
  await onboard(app);
  check('Heute erscheint nach dem Onboarding', await p.isVisible('.hero h1'));
  check('Begrüßung mit Namen', (await app.text('.hero h1')).includes('Mia'));
  check('Datum auf Deutsch', (await app.text('.hero .date')) === 'Donnerstag, 19. November');
  const subjects = await app.S(async () => (await import('./js/store.js')).all('subject').map((s) => s.data.name));
  check('Fächer angelegt', ['Deutsch', 'Mathe', 'Englisch', 'Biologie', 'Geschichte'].every((n) => subjects.includes(n)), subjects.join(','));
  const st = await app.S(async () => (await import('./js/store.js')).settings());
  check('Einstellungen gespeichert', st.state === 'BY' && st.klasse === '9b' && st.tendency === 0.25);
  await p.waitForTimeout(500);
  check('Ferien wurden geladen', app.ctx.holidayRequests >= 2, app.ctx.holidayRequests);
  check('Stundenplan-Hinweis auf Heute', await p.isVisible('.now-card >> text=Stundenplan eintragen'));
  await app.shot('02-heute-leer');

  // Tabs
  for (const [tab, route] of [['calendar', '/calendar'], ['tasks', '/tasks'], ['learn', '/learn'], ['grades', '/grades'], ['today', '/']]) {
    await p.click(`#tabbar [data-tab="${tab}"]`);
    await p.waitForTimeout(350);
    const h = await p.evaluate(() => location.hash || '#/');
    check(`Tab ${tab}`, h === `#${route}`, h);
  }
  check('Tab „Heute“ ist markiert', await p.locator('#tabbar .tab.active').getAttribute('data-tab') === 'today');

  // Mehr-Menü → Einstellungen
  await p.click('[data-act="more"]');
  await p.click('.action-row:has-text("Einstellungen")');
  await p.waitForTimeout(500);
  check('Einstellungen geöffnet', (await app.text('.large-title')) === 'Einstellungen');
  check('Ferien-Status zeigt Einträge', (await app.text('#view')).includes('Einträge'));
  await p.click('[data-palette="heft"]');
  check('Farbwelt Heft-Look aktiv', await p.evaluate(() => document.documentElement.dataset.palette === 'heft'));
  await p.click('[data-palette="salbei"]');
  await p.click('[data-theme="dark"]');
  check('Dunkelmodus erzwungen', await p.evaluate(() => document.documentElement.dataset.theme === 'dark'));
  await app.shot('03-einstellungen-dunkel');
  await p.click('[data-theme="system"]');
  await p.selectOption('#st-tend', '0.3');
  await p.waitForTimeout(200);
  check('Plus/Minus-Wert geändert', (await app.S(async () => (await import('./js/store.js')).settings().tendency)) === 0.3);

  // Fächer
  await app.go('/subjects');
  check('Fächerliste zeigt 5 Fächer', (await app.count('.subj-row')) === 5);
  await p.click('#fab');
  await p.fill('#sf-name', 'Informatik');
  check('Kürzel wird vorgeschlagen', (await p.inputValue('#sf-short')) === 'Inf');
  await p.click('.sheet [data-act="save"]');
  await app.sheetClosed();
  await p.waitForTimeout(400);
  check('Neues Fach in der Liste', (await app.count('.subj-row')) === 6);
  await p.click('.subj-row:has-text("Mathe") [data-open]');
  await p.waitForTimeout(400);
  check('Fach-Seite Mathe', (await app.text('.detail-head h1')) === 'Mathe');

  // Offline: Service Worker hat alles zwischengespeichert
  await app.go('/');
  await p.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready, null, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(1500);
  await app.ctx.setOffline(true);
  await p.reload();
  await p.waitForSelector('#view .hero', { timeout: 8000 }).catch(() => {});
  check('Startet offline', await p.isVisible('#view .hero'));
  await app.ctx.setOffline(false);
  const errors = [...app.errors];
  await app.close();

  // iPad: Seitenleiste statt Tab-Leiste, nichts ragt über den Rand
  for (const device of ['ipad', 'ipad-land']) {
    const pad = await openApp(server, { device });
    await onboard(pad);
    check(`${device}: Seitenleiste sichtbar`, await pad.p.isVisible('#sidebar'));
    check(`${device}: Tab-Leiste ausgeblendet`, !(await pad.p.isVisible('#tabbar')));
    check(`${device}: kein waagerechtes Scrollen`, (await pad.overflowX()) <= 0, await pad.overflowX());
    await pad.p.click('#sidebar [data-side="settings"]');
    await pad.p.waitForTimeout(400);
    check(`${device}: Seitenleiste markiert Einstellungen`, await pad.p.locator('#sidebar .side-item.active').getAttribute('data-side') === 'settings');
    await pad.shot(`04-${device}-einstellungen`);
    await pad.p.click('#sidebar [data-side="subjects"]');
    await pad.p.waitForTimeout(300);
    await pad.p.click('#fab');
    await pad.p.waitForTimeout(450);
    const box = await pad.p.locator('.sheet.show').boundingBox();
    const vw = pad.p.viewportSize().width;
    check(`${device}: Sheet als Fenster in der Mitte`, box && box.width <= 640 && box.x > 250 && box.x + box.width < vw, JSON.stringify(box));
    errors.push(...pad.errors);
    await pad.close();
  }
  return errors;
};
