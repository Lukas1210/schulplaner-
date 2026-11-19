// Erscheinungsbild: automatisch (wie das Gerät), hell oder dunkel – plus Farbwelt. Pro Gerät gespeichert.
const KEY = 'sp-theme';
const PALETTE_KEY = 'sp-palette';
export const DEFAULT_PALETTE = 'salbei';

/** Farbwelten: Name, Hintergrund (für die Statusleiste) und Vorschau-Farben. Werte passend zu css/palettes.css. */
export const PALETTES = {
  salbei: { name: 'Salbei & Creme', light: { bg: '#F5F1E8', swatch: ['#7FA287', '#C8714F'] }, dark: { bg: '#111613', swatch: ['#93BC9A', '#E39A7A'] } },
  mint: { name: 'Mint & Tinte', light: { bg: '#F2F7F6', swatch: ['#1E3A5F', '#3FBFA0'] }, dark: { bg: '#0B1220', swatch: ['#5FD4B5', '#8FB4E8'] } },
  heft: { name: 'Heft-Look', light: { bg: '#FBFBF8', swatch: ['#2D5BA8', '#D0473C'] }, dark: { bg: '#10131A', swatch: ['#7EA6EA', '#F07A6E'] } },
  violett: { name: 'Violett & Orange', light: { bg: '#F6F4FB', swatch: ['#6B3FD1', '#F08A2E'] }, dark: { bg: '#100D1A', swatch: ['#A98BFF', '#FFA552'] } },
};

const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function getThemePref() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function getPalette() {
  try {
    const v = localStorage.getItem(PALETTE_KEY);
    return PALETTES[v] ? v : DEFAULT_PALETTE;
  } catch {
    return DEFAULT_PALETTE;
  }
}

export function effectiveTheme() {
  const p = getThemePref();
  if (p !== 'system') return p;
  return mq && mq.matches ? 'dark' : 'light';
}

export function applyTheme() {
  const p = getThemePref();
  const root = document.documentElement;
  if (p === 'system') delete root.dataset.theme;
  else root.dataset.theme = p;
  const pal = getPalette();
  root.dataset.palette = pal;
  const bgs = PALETTES[pal];
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const media = m.getAttribute('media') || '';
    const mode = p !== 'system' ? p : media.includes('dark') ? 'dark' : media.includes('light') ? 'light' : effectiveTheme();
    m.setAttribute('content', bgs[mode].bg);
  });
  window.dispatchEvent(new CustomEvent('themechange', { detail: effectiveTheme() }));
}

export function setThemePref(v) {
  try {
    if (v === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, v);
  } catch {}
  applyTheme();
}

export function setPalette(v) {
  try {
    if (!PALETTES[v] || v === DEFAULT_PALETTE) localStorage.removeItem(PALETTE_KEY);
    else localStorage.setItem(PALETTE_KEY, v);
  } catch {}
  applyTheme();
}

if (mq) {
  const onChange = () => { if (getThemePref() === 'system') applyTheme(); };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
}
