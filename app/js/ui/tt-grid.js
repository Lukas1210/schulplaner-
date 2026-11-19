// Stundenplan-Raster (Tage × Stunden) mit Blöcken über mehrere Stunden.
import { html } from './dom.js';

/**
 * days: [{ key, title, sub, today, free: { name } | null }]
 * periods: [{ start, end }]
 * cells(day) → [{ from, to, content, cls, attrs }]  (sortiert, ohne Überschneidung)
 * empty(day, period) → { content, cls, attrs } | null
 */
export function ttGrid({ days, periods, cells, empty, rows = periods.length, label = 'Stundenplan' }) {
  const cols = `38px repeat(${days.length}, minmax(0, 1fr))`;
  const out = [];
  out.push(html`<div style="grid-column:1;grid-row:1"></div>`);
  days.forEach((d, i) => out.push(html`<div class="tt-head ${d.today ? 'today' : ''}" style="grid-column:${i + 2};grid-row:1">${d.title}${d.sub ? html`<small>${d.sub}</small>` : ''}</div>`));
  for (let p = 1; p <= rows; p++) {
    const per = periods[p - 1];
    out.push(html`<div class="tt-time" style="grid-column:1;grid-row:${p + 1}"><b>${p}</b>${per ? per.start : ''}</div>`);
  }
  days.forEach((d, i) => {
    const col = i + 2;
    if (d.free) {
      out.push(html`<div class="tt-free-label" style="grid-column:${col};grid-row:2 / span ${rows}">${d.free.name}</div>`);
      return;
    }
    const list = cells(d) || [];
    const covered = new Set();
    for (const c of list) {
      if (c.from > rows) continue;
      const to = Math.min(c.to, rows);
      for (let p = c.from; p <= to; p++) covered.add(p);
      out.push(html`<button class="tt-cell ${c.cls || ''}" style="grid-column:${col};grid-row:${c.from + 1} / span ${to - c.from + 1};${c.style || ''}" ${c.attrs || ''}>${c.content}</button>`);
    }
    for (let p = 1; p <= rows; p++) {
      if (covered.has(p)) continue;
      const e = empty ? empty(d, p) : null;
      if (e) out.push(html`<button class="tt-cell ${e.cls || 'empty-cell'}" style="grid-column:${col};grid-row:${p + 1}" ${e.attrs || ''}>${e.content || ''}</button>`);
      else out.push(html`<div style="grid-column:${col};grid-row:${p + 1}"></div>`);
    }
  });
  return html`<div class="tt-wrap"><div class="tt" role="grid" aria-label="${label}" style="grid-template-columns:${cols};grid-auto-rows:minmax(46px, auto)">${out}</div></div>`;
}
