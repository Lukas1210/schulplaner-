// Hash-Router mit Tabs, Seitenübergängen und Scroll-Gedächtnis.
import { subscribe } from './store.js';
import { debounce } from './ui/dom.js';

const routes = [];
let current = null; // { route, params, query, cleanup, key, mod }
const scrollMemory = new Map();
const historyStack = [];
let scroller, viewEl;
const changeListeners = new Set();

/**
 * Route anmelden.
 * tab: welcher Tab (iPhone) leuchtet, side: welcher Eintrag der Seitenleiste (iPad), fab: "+" zeigen, root: Tab-Wurzel.
 */
export function route(pattern, loader, { tab = null, side = null, fab = true, root = false } = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }).replace(/\//g, '\\/') + '\\/?$');
  routes.push({ pattern, re, keys, loader, tab, side: side || tab, fab, root });
}

function parseHash() {
  const h = decodeURI(location.hash.replace(/^#/, '')) || '/';
  const [path, qs] = h.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  for (const r of routes) {
    const m = r.re.exec(path);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return { route: r, params, query, path, key: h };
    }
  }
  return null;
}

export function go(path, { replace = false } = {}) {
  const target = '#' + path;
  if (replace) location.replace(target);
  else location.hash = path;
}

export function back(fallback = '/') {
  if (historyStack.length > 1) history.back();
  else go(fallback, { replace: true });
}

/** Wird bei jedem Seitenwechsel aufgerufen (für Tab-Leiste und Seitenleiste). */
export function onRouteChange(fn) { changeListeners.add(fn); return () => changeListeners.delete(fn); }

function bindTopbar() {
  const onScroll = () => {
    const bar = viewEl.querySelector('.topbar');
    if (bar) bar.classList.toggle('scrolled', scroller.scrollTop > +(bar.dataset.threshold || 30));
  };
  onScroll();
  scroller.onscroll = onScroll;
}

async function render(r, mode) {
  if (current && current.key !== r.key) scrollMemory.set(current.key, scroller.scrollTop);
  if (current?.cleanup) { try { current.cleanup(); } catch (e) { console.error(e); } current.cleanup = null; }
  const state = { ...r, mod: null, cleanup: null };
  current = state;
  const mod = await r.route.loader();
  if (current !== state) return; // inzwischen weiter navigiert
  state.mod = mod;
  viewEl.className = '';
  viewEl.innerHTML = '';
  viewEl.dataset.route = r.route.pattern;
  changeListeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
  const result = await mod.render(viewEl, r.params, r.query, { refresh: false, alive: () => current === state });
  // Überholt (z. B. schneller Tab-Wechsel): Ereignisse dieser Darstellung sofort wieder lösen
  if (current !== state) { if (typeof result === 'function') result(); return; }
  state.cleanup = typeof result === 'function' ? result : null;
  bindTopbar();
  scroller.scrollTop = mode === 'pop' ? scrollMemory.get(r.key) || 0 : 0;
  void viewEl.offsetWidth;
  viewEl.classList.add(mode === 'push' ? 'enter-push' : mode === 'pop' ? 'enter-pop' : 'enter-tab');
}

let refreshing = false;
let refreshAgain = false;

/** Aktuelle Ansicht nach Datenänderung neu zeichnen (Scrollposition bleibt). */
export async function refresh() {
  if (!current || !current.mod || current.mod.live === false) return;
  // Nicht beim Tippen stören – nach dem Verlassen des Feldes wird nachgeholt
  const ae = document.activeElement;
  const typing = ae?.closest?.('#view') && (ae.tagName === 'TEXTAREA' || (ae.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'].includes(ae.type)));
  if (typing) { ae.addEventListener('blur', () => setTimeout(refresh, 50), { once: true }); return; }
  if (refreshing) { refreshAgain = true; return; }
  refreshing = true;
  try {
    const state = current;
    const y = scroller.scrollTop;
    if (state.cleanup) { try { state.cleanup(); } catch (e) { console.error(e); } state.cleanup = null; }
    viewEl.innerHTML = '';
    const result = await state.mod.render(viewEl, state.params, state.query, { refresh: true, alive: () => current === state });
    if (current !== state) { if (typeof result === 'function') result(); return; }
    state.cleanup = typeof result === 'function' ? result : null;
    bindTopbar();
    scroller.scrollTop = y;
  } finally {
    refreshing = false;
    if (refreshAgain) { refreshAgain = false; refresh(); }
  }
}

export const currentRoute = () => current;

export function startRouter() {
  scroller = document.getElementById('scroller');
  viewEl = document.getElementById('view');

  const onHash = () => {
    const r = parseHash();
    if (!r) { go('/', { replace: true }); return; }
    if (current && current.key === r.key) return; // gleiche Seite (z. B. doppeltes hashchange beim Start)
    let mode;
    if (historyStack.length > 1 && historyStack[historyStack.length - 2] === r.key) {
      historyStack.pop();
      mode = 'pop';
    } else if (r.route.root) {
      historyStack.length = 0;
      historyStack.push(r.key);
      mode = 'tab';
    } else {
      historyStack.push(r.key);
      mode = current ? 'push' : 'tab';
    }
    render(r, mode);
  };
  window.addEventListener('hashchange', onHash);

  viewEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="back"]');
    if (b) { e.preventDefault(); back(b.dataset.fallback || '/'); }
  });

  const debouncedRefresh = debounce(() => refresh(), 120);
  subscribe((evt) => {
    if (evt.types.includes('device')) return;
    debouncedRefresh();
  });

  onHash();
}
