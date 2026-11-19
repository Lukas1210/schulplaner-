// Screenshot-Rundgang für das README: iPhone hell/dunkel und iPad, als Collage in docs/.
// Aufruf: node tools/e2e/run.cjs tour
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { openApp, onboard, seed, SHOTS } = require('./lib.cjs');

const DOCS = path.resolve(__dirname, '..', '..', 'docs');

async function shots(server, { scheme, device = 'phone', list }) {
  const app = await openApp(server, { scheme, device, dpr: 2 });
  await onboard(app);
  await seed(app);
  const ids = await app.S(async () => {
    const S = await import('./js/store.js');
    return { mathe: S.all('subject').find((s) => s.data.name === 'Mathe').id, exam: S.all('exam').find((e) => e.data.title === 'Quadratische Funktionen').id };
  });
  const out = [];
  for (const [name, route] of list(ids)) {
    await app.go(route, 900);
    await app.calm();
    const file = path.join(SHOTS, `tour-${scheme}-${device}-${name}.png`);
    await app.p.screenshot({ path: file });
    out.push(file);
  }
  const errors = [...app.errors];
  await app.close();
  return { out, errors };
}

async function collage(files, { cols, w, h, gap = 28, pad = 40, bg = '#EDE7DA', radius = 54, file }) {
  const browser = await chromium.launch();
  const rows = Math.ceil(files.length / cols);
  const W = pad * 2 + cols * w + (cols - 1) * gap;
  const H = pad * 2 + rows * h + (rows - 1) * gap;
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const imgs = files.map((f) => `<img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" style="width:${w}px;height:${h}px;border-radius:${radius}px;box-shadow:0 18px 40px -18px rgba(0,0,0,.35)">`).join('');
  await page.setContent(`<html><body style="margin:0;background:${bg};padding:${pad}px;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:${gap}px">${imgs}</body></html>`, { waitUntil: 'load' });
  fs.mkdirSync(DOCS, { recursive: true });
  await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
  await browser.close();
}

exports.run = async ({ server, check }) => {
  const phoneList = (ids) => [
    ['heute', '/'], ['kalender', '/calendar'], ['aufgaben', '/tasks'], ['lernen', '/learn'], ['test', `/exam/${ids.exam}`], ['noten', `/grades/${ids.mathe}`],
  ];
  const light = await shots(server, { scheme: 'light', list: phoneList });
  const dark = await shots(server, { scheme: 'dark', list: (ids) => [['heute', '/'], ['noten', `/grades/${ids.mathe}`]] });
  const pad = await shots(server, { scheme: 'light', device: 'ipad-land', list: (ids) => [['heute', '/'], ['kalender', '/calendar']] });
  await collage([...light.out.slice(0, 4), ...dark.out.slice(0, 1), light.out[5]], { cols: 6, w: 393, h: 852, radius: 46, file: path.join(DOCS, 'screenshots.jpg') });
  await collage(pad.out, { cols: 2, w: 1180, h: 820, radius: 28, file: path.join(DOCS, 'ipad.jpg') });
  check('Collage iPhone erstellt', fs.existsSync(path.join(DOCS, 'screenshots.jpg')));
  check('Collage iPad erstellt', fs.existsSync(path.join(DOCS, 'ipad.jpg')));
  return [...light.errors, ...dark.errors, ...pad.errors];
};
