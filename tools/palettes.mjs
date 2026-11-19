// Farbwelten definieren, Kontraste prüfen (Text ≥ 4,5 : 1, Grafik ≥ 3 : 1) und app/css/palettes.css erzeugen.
// Aufruf: node tools/palettes.mjs        (bricht mit Fehler ab, wenn ein Kontrast nicht reicht)
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUBJECT_COLORS } from '../app/js/logic/colors.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'app');

// ---------- Farbmathematik ----------
function parse(c) {
  c = c.trim();
  let m;
  if ((m = /^#([0-9a-f]{6})$/i.exec(c))) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  if ((m = /^rgba?\(([^)]+)\)$/i.exec(c))) {
    const p = m[1].split(',').map((x) => parseFloat(x));
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  throw new Error(`Unbekannte Farbe: ${c}`);
}
const blend = (fg, bg) => {
  const f = parse(fg), b = parse(bg);
  return [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3]));
};
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
/** Kontrast von fg (evtl. transparent) auf bg (deckend, oder transparent über base). */
function contrast(fg, bg, base) {
  const b = base ? blend(bg, base) : parse(bg).slice(0, 3);
  const bgHex = `rgb(${b.join(',')})`;
  const f = blend(fg, bgHex);
  const l1 = lum(f), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ---------- Neutrale Werte aus Textfarbe ----------
const rgbOf = (hex) => parse(hex).slice(0, 3).join(', ');
const neutral = (text, dark) => ({
  text2: `rgba(${rgbOf(text)}, ${dark ? 0.68 : 0.68})`,
  text3: `rgba(${rgbOf(text)}, ${dark ? 0.5 : 0.52})`,
  fill: `rgba(${rgbOf(text)}, ${dark ? 0.08 : 0.06})`,
  fill2: `rgba(${rgbOf(text)}, ${dark ? 0.13 : 0.1})`,
  fill3: `rgba(${rgbOf(text)}, ${dark ? 0.24 : 0.2})`,
  separator: `rgba(${rgbOf(text)}, ${dark ? 0.11 : 0.11})`,
  cardBorder: `rgba(${rgbOf(text)}, ${dark ? 0.08 : 0.07})`,
  grid: `rgba(${rgbOf(text)}, ${dark ? 0.1 : 0.09})`,
});

// ---------- Farbwelten ----------
const P = {
  salbei: {
    name: 'Salbei & Creme',
    light: {
      bg: '#F5F1E8', elev: '#FFFDF8', elev2: '#FAF6EE', sheet: '#F3EEE3', bar: 'rgba(255, 253, 248, 0.82)', seg: '#FFFDF8', text: '#1F2A23',
      accent: '#7FA287', accentSoft: 'rgba(127, 162, 135, 0.2)', ink: '#3E6B4A', primary: '#3E6B4A', primaryFg: '#FFFFFF',
      accent2: '#C8714F', accent2Ink: '#9C4E2E', accent2Soft: 'rgba(200, 113, 79, 0.15)',
      danger: '#B3372B', dangerSoft: 'rgba(179, 55, 43, 0.12)', ok: '#2A6F3F', okSoft: 'rgba(47, 122, 69, 0.13)',
      warn: '#D99A1C', warnInk: '#8A5A00', warnSoft: 'rgba(217, 154, 28, 0.17)',
      ampRed: '#C8483B', ampYellow: '#A67805', ampGreen: '#3F8F55',
      chart: '#3E6B4A', chartSoft: 'rgba(127, 162, 135, 0.22)',
      glow: 'radial-gradient(120% 80% at 90% -20%, rgba(127, 162, 135, 0.32), transparent 62%)',
      shadow: '0 1px 2px rgba(31, 42, 35, 0.05), 0 10px 26px -18px rgba(31, 42, 35, 0.28)',
      pattern: 'none', overlay: 'rgba(20, 26, 22, 0.36)',
    },
    dark: {
      bg: '#111613', elev: '#1A211C', elev2: '#212A24', sheet: '#161C18', bar: 'rgba(26, 33, 28, 0.8)', seg: '#2E3931', text: '#ECEFE9',
      accent: '#93BC9A', accentSoft: 'rgba(147, 188, 154, 0.17)', ink: '#A9CFAF', primary: '#93BC9A', primaryFg: '#0F1711',
      accent2: '#E39A7A', accent2Ink: '#EBAA8D', accent2Soft: 'rgba(227, 154, 122, 0.16)',
      danger: '#FF8576', dangerSoft: 'rgba(255, 133, 118, 0.14)', ok: '#7BD394', okSoft: 'rgba(123, 211, 148, 0.14)',
      warn: '#E3B13F', warnInk: '#F2C66A', warnSoft: 'rgba(227, 177, 63, 0.16)',
      ampRed: '#FF7A6B', ampYellow: '#E8B93A', ampGreen: '#6CC786',
      chart: '#A9CFAF', chartSoft: 'rgba(147, 188, 154, 0.2)',
      glow: 'radial-gradient(120% 80% at 90% -20%, rgba(147, 188, 154, 0.16), transparent 62%)',
      shadow: 'none', pattern: 'none', overlay: 'rgba(0, 0, 0, 0.6)',
    },
  },
  mint: {
    name: 'Mint & Tinte',
    light: {
      bg: '#F2F7F6', elev: '#FFFFFF', elev2: '#F7FBFA', sheet: '#EEF4F3', bar: 'rgba(255, 255, 255, 0.82)', seg: '#FFFFFF', text: '#0F1E33',
      accent: '#3FBFA0', accentSoft: 'rgba(63, 191, 160, 0.17)', ink: '#1E3A5F', primary: '#1E3A5F', primaryFg: '#FFFFFF',
      accent2: '#E07A5F', accent2Ink: '#AD4A31', accent2Soft: 'rgba(224, 122, 95, 0.15)',
      danger: '#B8352A', dangerSoft: 'rgba(184, 53, 42, 0.11)', ok: '#1D7458', okSoft: 'rgba(29, 116, 88, 0.12)',
      warn: '#D99A1C', warnInk: '#865700', warnSoft: 'rgba(217, 154, 28, 0.17)',
      ampRed: '#D2483B', ampYellow: '#A67805', ampGreen: '#2A9473',
      chart: '#1E3A5F', chartSoft: 'rgba(63, 191, 160, 0.22)',
      glow: 'radial-gradient(120% 80% at 90% -20%, rgba(63, 191, 160, 0.28), transparent 62%)',
      shadow: '0 1px 2px rgba(15, 30, 51, 0.05), 0 10px 26px -18px rgba(15, 30, 51, 0.3)',
      pattern: 'none', overlay: 'rgba(10, 18, 32, 0.38)',
    },
    dark: {
      bg: '#0B1220', elev: '#131C2E', elev2: '#1A2539', sheet: '#0F1727', bar: 'rgba(19, 28, 46, 0.8)', seg: '#26324A', text: '#E8EEF6',
      accent: '#5FD4B5', accentSoft: 'rgba(95, 212, 181, 0.16)', ink: '#7FE0C6', primary: '#5FD4B5', primaryFg: '#06201A',
      accent2: '#F2A07E', accent2Ink: '#F5AF92', accent2Soft: 'rgba(242, 160, 126, 0.16)',
      danger: '#FF8A7D', dangerSoft: 'rgba(255, 138, 125, 0.14)', ok: '#6FDDB0', okSoft: 'rgba(111, 221, 176, 0.14)',
      warn: '#E8B93A', warnInk: '#F3CA6B', warnSoft: 'rgba(232, 185, 58, 0.16)',
      ampRed: '#FF7A6B', ampYellow: '#E8B93A', ampGreen: '#55D3A8',
      chart: '#7FE0C6', chartSoft: 'rgba(95, 212, 181, 0.2)',
      glow: 'radial-gradient(120% 80% at 90% -20%, rgba(95, 212, 181, 0.16), transparent 62%)',
      shadow: 'none', pattern: 'none', overlay: 'rgba(0, 0, 0, 0.6)',
    },
  },
  heft: {
    name: 'Heft-Look',
    light: {
      bg: '#FBFBF8', elev: '#FFFFFF', elev2: '#F7F7F3', sheet: '#F5F5F0', bar: 'rgba(255, 255, 255, 0.84)', seg: '#FFFFFF', text: '#1C2433',
      accent: '#5B84C9', accentSoft: 'rgba(45, 91, 168, 0.12)', ink: '#2D5BA8', primary: '#2D5BA8', primaryFg: '#FFFFFF',
      accent2: '#D0473C', accent2Ink: '#B23A30', accent2Soft: 'rgba(208, 71, 60, 0.12)',
      danger: '#B3372B', dangerSoft: 'rgba(179, 55, 43, 0.11)', ok: '#276E40', okSoft: 'rgba(43, 122, 71, 0.12)',
      warn: '#D99A1C', warnInk: '#865700', warnSoft: 'rgba(217, 154, 28, 0.17)',
      ampRed: '#D0473C', ampYellow: '#A67805', ampGreen: '#3A8F55',
      chart: '#2D5BA8', chartSoft: 'rgba(45, 91, 168, 0.14)',
      glow: 'none',
      shadow: '0 1px 2px rgba(28, 36, 51, 0.05), 0 8px 22px -16px rgba(28, 36, 51, 0.25)',
      pattern: 'linear-gradient(90deg, transparent 9px, rgba(208, 71, 60, 0.42) 9px, rgba(208, 71, 60, 0.42) 10.5px, transparent 10.5px), repeating-linear-gradient(180deg, transparent 0 31px, rgba(45, 91, 168, 0.13) 31px 32px)',
      overlay: 'rgba(20, 24, 34, 0.36)',
    },
    dark: {
      bg: '#10131A', elev: '#181D27', elev2: '#1F2532', sheet: '#141821', bar: 'rgba(24, 29, 39, 0.82)', seg: '#2A3142', text: '#E9ECF2',
      accent: '#7EA6EA', accentSoft: 'rgba(126, 166, 234, 0.15)', ink: '#93B5EE', primary: '#7EA6EA', primaryFg: '#0B1426',
      accent2: '#F07A6E', accent2Ink: '#F49186', accent2Soft: 'rgba(240, 122, 110, 0.15)',
      danger: '#FF8A7D', dangerSoft: 'rgba(255, 138, 125, 0.14)', ok: '#78D192', okSoft: 'rgba(120, 209, 146, 0.14)',
      warn: '#E8B93A', warnInk: '#F3CA6B', warnSoft: 'rgba(232, 185, 58, 0.16)',
      ampRed: '#FF7A6B', ampYellow: '#E8B93A', ampGreen: '#6CC786',
      chart: '#93B5EE', chartSoft: 'rgba(126, 166, 234, 0.18)',
      glow: 'none', shadow: 'none',
      pattern: 'linear-gradient(90deg, transparent 9px, rgba(240, 122, 110, 0.35) 9px, rgba(240, 122, 110, 0.35) 10.5px, transparent 10.5px), repeating-linear-gradient(180deg, transparent 0 31px, rgba(126, 166, 234, 0.08) 31px 32px)',
      overlay: 'rgba(0, 0, 0, 0.6)',
    },
  },
  violett: {
    name: 'Violett & Orange',
    light: {
      bg: '#F6F4FB', elev: '#FFFFFF', elev2: '#F9F7FD', sheet: '#F2EFF9', bar: 'rgba(255, 255, 255, 0.82)', seg: '#FFFFFF', text: '#1D1530',
      accent: '#8C66F0', accentSoft: 'rgba(140, 102, 240, 0.14)', ink: '#6B3FD1', primary: '#6B3FD1', primaryFg: '#FFFFFF',
      accent2: '#F08A2E', accent2Ink: '#A85500', accent2Soft: 'rgba(240, 138, 46, 0.16)',
      danger: '#B8352A', dangerSoft: 'rgba(184, 53, 42, 0.11)', ok: '#227A4A', okSoft: 'rgba(34, 122, 74, 0.12)',
      warn: '#D99A1C', warnInk: '#865700', warnSoft: 'rgba(217, 154, 28, 0.17)',
      ampRed: '#D2483B', ampYellow: '#A67805', ampGreen: '#2F9157',
      chart: '#6B3FD1', chartSoft: 'rgba(140, 102, 240, 0.18)',
      glow: 'radial-gradient(120% 80% at 90% -20%, rgba(240, 138, 46, 0.22), transparent 60%)',
      shadow: '0 1px 2px rgba(29, 21, 48, 0.05), 0 10px 26px -18px rgba(29, 21, 48, 0.3)',
      pattern: 'none', overlay: 'rgba(20, 14, 34, 0.38)',
    },
    dark: {
      bg: '#100D1A', elev: '#1A1628', elev2: '#221D33', sheet: '#151121', bar: 'rgba(26, 22, 40, 0.8)', seg: '#2E2745', text: '#EEEAF7',
      accent: '#A98BFF', accentSoft: 'rgba(169, 139, 255, 0.17)', ink: '#BBA4FF', primary: '#A98BFF', primaryFg: '#140A2E',
      accent2: '#FFA552', accent2Ink: '#FFB370', accent2Soft: 'rgba(255, 165, 82, 0.16)',
      danger: '#FF8A7D', dangerSoft: 'rgba(255, 138, 125, 0.14)', ok: '#74D69B', okSoft: 'rgba(116, 214, 155, 0.14)',
      warn: '#E8B93A', warnInk: '#F3CA6B', warnSoft: 'rgba(232, 185, 58, 0.16)',
      ampRed: '#FF7A6B', ampYellow: '#E8B93A', ampGreen: '#6CC786',
      chart: '#BBA4FF', chartSoft: 'rgba(169, 139, 255, 0.2)',
      glow: 'radial-gradient(120% 80% at 90% -20%, rgba(255, 165, 82, 0.13), transparent 60%)',
      shadow: 'none', pattern: 'none', overlay: 'rgba(0, 0, 0, 0.6)',
    },
  },
};


// ---------- Prüfen ----------
const problems = [];
const need = (label, value, min) => { if (!(value >= min)) problems.push(`${label}: ${value.toFixed(2)} < ${min}`); };
for (const [key, p] of Object.entries(P)) {
  for (const mode of ['light', 'dark']) {
    const c = { ...neutral(p[mode].text, mode === 'dark'), ...p[mode] };
    p[mode] = c;
    const L = `${key}/${mode}`;
    for (const surf of ['bg', 'elev', 'elev2', 'sheet']) {
      need(`${L} Text auf ${surf}`, contrast(c.text, c[surf]), 7);
      need(`${L} Text2 auf ${surf}`, contrast(c.text2, c[surf]), 4.5);
      need(`${L} Text3 auf ${surf}`, contrast(c.text3, c[surf]), 3);
      for (const t of ['ink', 'accent2Ink', 'danger', 'ok', 'warnInk']) need(`${L} ${t} auf ${surf}`, contrast(c[t], c[surf]), 4.5);
      for (const g of ['ampRed', 'ampYellow', 'ampGreen', 'chart']) need(`${L} ${g} auf ${surf}`, contrast(c[g], c[surf]), 3);
    }
    need(`${L} Knopfschrift`, contrast(c.primaryFg, c.primary), 4.5);
    for (const soft of ['accentSoft', 'accent2Soft', 'dangerSoft', 'okSoft', 'warnSoft']) need(`${L} Text auf ${soft}`, contrast(c.text, c[soft], c.elev), 7);
    need(`${L} ink auf accentSoft`, contrast(c.ink, c.accentSoft, c.elev), 4.5);
    need(`${L} accent2Ink auf accent2Soft`, contrast(c.accent2Ink, c.accent2Soft, c.elev), 4.5);
    need(`${L} danger auf dangerSoft`, contrast(c.danger, c.dangerSoft, c.elev), 4.5);
    need(`${L} ok auf okSoft`, contrast(c.ok, c.okSoft, c.elev), 4.5);
    need(`${L} warnInk auf warnSoft`, contrast(c.warnInk, c.warnSoft, c.elev), 4.5);
  }
}
for (const col of SUBJECT_COLORS) need(`Fachfarbe ${col} mit weißer Schrift`, contrast('#FFFFFF', col), 4.5);

if (problems.length) {
  console.error('Kontrast reicht nicht:\n  ' + problems.join('\n  '));
  process.exit(1);
}

// ---------- CSS erzeugen ----------
const block = (c) => `
  --bg: ${c.bg};
  --bg-elev: ${c.elev};
  --bg-elev2: ${c.elev2};
  --sheet-bg: ${c.sheet};
  --bar-bg: ${c.bar};
  --seg-active: ${c.seg};
  --text: ${c.text};
  --text2: ${c.text2};
  --text3: ${c.text3};
  --fill: ${c.fill};
  --fill2: ${c.fill2};
  --fill3: ${c.fill3};
  --separator: ${c.separator};
  --card-border: ${c.cardBorder};
  --card-shadow: ${c.shadow};
  --overlay: ${c.overlay};
  --accent: ${c.accent};
  --accent-soft: ${c.accentSoft};
  --accent-ink: ${c.ink};
  --primary-bg: ${c.primary};
  --primary-fg: ${c.primaryFg};
  --accent2: ${c.accent2};
  --accent2-ink: ${c.accent2Ink};
  --accent2-soft: ${c.accent2Soft};
  --danger: ${c.danger};
  --danger-soft: ${c.dangerSoft};
  --ok: ${c.ok};
  --ok-soft: ${c.okSoft};
  --warn: ${c.warn};
  --warn-ink: ${c.warnInk};
  --warn-soft: ${c.warnSoft};
  --amp-red: ${c.ampRed};
  --amp-yellow: ${c.ampYellow};
  --amp-green: ${c.ampGreen};
  --chart: ${c.chart};
  --chart-soft: ${c.chartSoft};
  --grid: ${c.grid};
  --glow: ${c.glow};
  --bg-pattern: ${c.pattern};`;

let css = `/* Farbwelten – erzeugt mit tools/palettes.mjs (nicht von Hand bearbeiten). Kontraste sind geprüft. */\n`;
const [firstKey] = Object.keys(P);
css += `\n:root {${block(P[firstKey].light)}\n  color-scheme: light;\n}\n`;
for (const [key, p] of Object.entries(P)) {
  css += `\n/* ${p.name} */\n:root[data-palette="${key}"] {${block(p.light)}\n  color-scheme: light;\n}\n`;
  css += `@media (prefers-color-scheme: dark) {\n  :root[data-palette="${key}"]:not([data-theme="light"]) {${block(p.dark).replace(/\n/g, '\n  ')}\n    color-scheme: dark;\n  }\n}\n`;
  css += `:root[data-palette="${key}"][data-theme="dark"] {${block(p.dark)}\n  color-scheme: dark;\n}\n`;
}
writeFileSync(`${root}/css/palettes.css`, css);
console.log(`✓ ${Object.keys(P).length} Farbwelten geprüft, ${SUBJECT_COLORS.length} Fachfarben geprüft → app/css/palettes.css`);
