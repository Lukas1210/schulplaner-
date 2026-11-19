// Erzeugt App-Icons und Startbilder (iPhone + iPad, hell/dunkel) aus app/assets/icons/icon.svg.
// Aufruf: node tools/make-icons.mjs   (benötigt Playwright mit Chromium)
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const svg = readFileSync(`${root}/assets/icons/icon.svg`, 'utf8');
const svgData = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

// Geräte im Hochformat (CSS-Breite × Höhe @ Pixeldichte); iPads zusätzlich im Querformat
const PHONES = [
  [440, 956, 3], [402, 874, 3], [420, 912, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3],
  [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2],
];
const PADS = [
  [1032, 1376, 2], [1024, 1366, 2], [834, 1210, 2], [834, 1194, 2], [834, 1112, 2], [820, 1180, 2], [810, 1080, 2], [768, 1024, 2], [744, 1133, 2],
];
const SCHEMES = { light: '#F5F1E8', dark: '#111613' };

const browser = await chromium.launch();
const page = await browser.newPage();

async function icon(size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;overflow:hidden"><img src="${svgData}" style="width:${size}px;height:${size}px;display:block"></body></html>`, { waitUntil: 'load' });
  writeFileSync(file, await page.screenshot({ type: 'png' }));
}

mkdirSync(`${root}/assets/icons`, { recursive: true });
mkdirSync(`${root}/assets/splash`, { recursive: true });
for (const f of readdirSync(`${root}/assets/splash`)) unlinkSync(`${root}/assets/splash/${f}`);
await icon(180, `${root}/assets/icons/apple-touch-icon.png`);
await icon(192, `${root}/assets/icons/icon-192.png`);
await icon(512, `${root}/assets/icons/icon-512.png`);
await icon(512, `${root}/assets/icons/maskable-512.png`);

const links = [];
async function splash(w, h, dpr, orientation) {
  for (const [scheme, bg] of Object.entries(SCHEMES)) {
    const [vw, vh] = orientation === 'landscape' ? [h, w] : [w, h];
    const file = `splash-${vw * dpr}x${vh * dpr}-${scheme}.png`;
    const p2 = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr });
    await p2.setContent(`<html><body style="margin:0;width:${vw}px;height:${vh}px;overflow:hidden;background:${bg};display:grid;place-items:center"><img src="${svgData}" style="width:96px;height:96px;border-radius:22px;box-shadow:0 10px 30px -10px rgba(0,0,0,.35)"></body></html>`, { waitUntil: 'load' });
    writeFileSync(`${root}/assets/splash/${file}`, await p2.screenshot({ type: 'png' }));
    await p2.close();
    links.push(`  <link rel="apple-touch-startup-image" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orientation}) and (prefers-color-scheme: ${scheme})" href="assets/splash/${file}">`);
  }
}
for (const [w, h, dpr] of PHONES) await splash(w, h, dpr, 'portrait');
for (const [w, h, dpr] of PADS) { await splash(w, h, dpr, 'portrait'); await splash(w, h, dpr, 'landscape'); }
await browser.close();

// Startbilder verkleinern (Palette mit 256 Farben), falls Python mit Pillow vorhanden ist
try {
  execFileSync('python3', ['-c', `
import sys, os
from PIL import Image
d = sys.argv[1]
for f in os.listdir(d):
    if f.endswith('.png'):
        p = os.path.join(d, f)
        Image.open(p).convert('RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(p, optimize=True)
`, `${root}/assets/splash`], { stdio: 'inherit' });
} catch { console.log('(Startbilder nicht verkleinert – Pillow fehlt)'); }

const indexPath = `${root}/index.html`;
const index = readFileSync(indexPath, 'utf8');
writeFileSync(indexPath, index.replace(/<!-- STARTUP-IMAGES:BEGIN -->[\s\S]*?<!-- STARTUP-IMAGES:END -->/, `<!-- STARTUP-IMAGES:BEGIN -->\n${links.join('\n')}\n  <!-- STARTUP-IMAGES:END -->`));
console.log(`Icons und ${links.length} Startbilder erzeugt.`);
