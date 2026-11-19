// Sheets (iPhone: von unten, iPad: als Fenster in der Mitte), Auswahllisten, Dialoge und Toasts.
import { html, esc, nextFrame } from './dom.js';
import { icon, iconStr } from './icons.js';

let zBase = 100;
const openSheets = [];
export const isWide = () => !!window.matchMedia?.('(min-width: 768px)').matches;

/**
 * Öffnet ein Sheet.
 * @returns {{el: HTMLElement, body: HTMLElement, close: Function, closed: Promise}}
 */
export function openSheet({ title = '', left = '', right = '', body = '', full = false, className = '', beforeClose, onClose } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  const sheet = document.createElement('div');
  sheet.className = `sheet ${full ? 'full' : ''} ${className}`;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  if (title) sheet.setAttribute('aria-label', String(title));
  zBase += 2;
  backdrop.style.zIndex = zBase;
  sheet.style.zIndex = zBase + 1;
  sheet.innerHTML = String(html`
    <div class="sheet-handle"></div>
    <div class="sheet-head">
      <div class="l">${left}</div>
      <div class="title">${title}</div>
      <div class="r">${right}</div>
    </div>
    <div class="sheet-body"></div>`);
  const bodyEl = sheet.querySelector('.sheet-body');
  if (body instanceof Node) bodyEl.appendChild(body);
  else bodyEl.innerHTML = String(body);
  document.body.append(backdrop, sheet);

  let resolveClosed;
  const closed = new Promise((r) => (resolveClosed = r));
  let isClosed = false;

  async function close(result, force = false) {
    if (isClosed) return;
    if (!force && beforeClose && (await beforeClose()) === false) {
      sheet.style.transform = '';
      return;
    }
    isClosed = true;
    sheet.classList.remove('show');
    backdrop.classList.remove('show');
    sheet.style.transform = '';
    const idx = openSheets.indexOf(api);
    if (idx >= 0) openSheets.splice(idx, 1);
    setTimeout(() => { sheet.remove(); backdrop.remove(); }, 380);
    onClose && onClose(result);
    resolveClosed(result);
  }

  backdrop.addEventListener('click', () => close());

  // Wischen am Griff schließt das Sheet (nur auf dem iPhone)
  const head = sheet.querySelector('.sheet-head');
  const handle = sheet.querySelector('.sheet-handle');
  let startY = 0, dy = 0, dragging = false, startT = 0;
  const down = (e) => {
    if (isWide() || e.target.closest('button, input, a, select')) return;
    dragging = true; startY = e.clientY; dy = 0; startT = performance.now();
    sheet.classList.add('dragging');
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!dragging) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const up = () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('dragging');
    const v = dy / Math.max(1, performance.now() - startT);
    if (dy > 140 || v > 0.6) close();
    else sheet.style.transform = '';
  };
  for (const t of [head, handle]) {
    t.addEventListener('pointerdown', down);
    t.addEventListener('pointermove', move);
    t.addEventListener('pointerup', up);
    t.addEventListener('pointercancel', up);
  }
  sheet.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  const api = { el: sheet, body: bodyEl, head, close, closed };
  openSheets.push(api);
  nextFrame().then(() => {
    backdrop.classList.add('show');
    sheet.classList.add('show');
  });
  return api;
}

export function closeAllSheets() {
  [...openSheets].forEach((s) => s.close(undefined, true));
}
export const hasOpenSheet = () => openSheets.length > 0;

/**
 * Aktionsmenü mit Kacheln (grid) oder Zeilen (list). Liefert den gewählten Wert.
 * items: [{ label, value, icon?, color?, sub?, danger?, selected?, badge? }]
 */
export function actionSheet({ title = '', items = [], layout = 'list', footer = '' }) {
  return new Promise((resolve) => {
    let chosen;
    const badge = (it) => (it.badge ? html`<span class="subj-badge sm" style="--c:${it.color}">${it.badge}</span>` : it.icon ? html`<span class="ico-tile" style="--c:${it.color || 'var(--accent-ink)'}">${icon(it.icon)}</span>` : '');
    const body = layout === 'grid'
      ? html`<div class="action-grid">${items.map((it, i) => html`<button class="action-item" data-i="${i}">${badge(it)}<span>${it.label}</span></button>`)}</div>`
      : html`<div class="action-list">${items.map((it, i) => html`<button class="action-row ${it.danger ? 'danger' : ''} ${it.selected ? 'selected' : ''}" data-i="${i}">${badge(it)}<span class="grow"><span class="ar-label">${it.label}</span>${it.sub ? html`<span class="ar-sub">${it.sub}</span>` : ''}</span>${it.selected ? html`<span class="ar-check">${icon('check')}</span>` : ''}</button>`)}</div>${footer}`;
    const s = openSheet({ title, body, className: 'action-sheet', onClose: () => resolve(chosen) });
    s.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const it = items[+b.dataset.i];
      if (it.onSelect) it.onSelect();
      chosen = it.value;
      s.close();
    });
  });
}

/** iOS-Dialog. Liefert true/false. */
export function confirmDialog({ title, message = '', ok = 'OK', cancel = 'Abbrechen', danger = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'dialog-wrap';
    wrap.style.zIndex = 500;
    const bd = document.createElement('div');
    bd.className = 'backdrop';
    bd.style.zIndex = 499;
    wrap.innerHTML = String(html`
      <div class="dialog" role="alertdialog" aria-label="${title}">
        <div class="d-body"><h3>${title}</h3>${message ? html`<p>${message}</p>` : ''}</div>
        <div class="d-actions">
          ${cancel ? html`<button data-v="0">${cancel}</button>` : ''}
          <button data-v="1" class="${danger ? 'danger' : 'strong'}">${ok}</button>
        </div>
      </div>`);
    document.body.append(bd, wrap);
    const dlg = wrap.querySelector('.dialog');
    nextFrame().then(() => { bd.classList.add('show'); dlg.classList.add('show'); });
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      dlg.classList.remove('show');
      bd.classList.remove('show');
      setTimeout(() => { wrap.remove(); bd.remove(); }, 250);
      resolve(b.dataset.v === '1');
    });
  });
}

/** Kurze Meldung oben. */
export function toast(message, { actionLabel, onAction, duration = 2600, icon: ico } = {}) {
  let host = document.getElementById('toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    document.body.appendChild(host);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  const lead = ico ? `<span class="t-ico">${iconStr(ico)}</span>` : '';
  t.innerHTML = `${lead}<span>${esc(message)}</span>${actionLabel ? `<button>${esc(actionLabel)}</button>` : ''}`;
  host.appendChild(t);
  const hide = () => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 400);
  };
  if (actionLabel) t.querySelector('button').addEventListener('click', () => { hide(); onAction && onAction(); });
  nextFrame().then(() => t.classList.add('show'));
  if (duration) setTimeout(hide, duration);
  return hide;
}
