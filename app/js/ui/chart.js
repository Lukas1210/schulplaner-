// Notenverlauf (SVG): Linie = Schnitt nach jeder Note, Punkte = einzelne Noten, waagerechte Linie = Grenze fürs Ziel.
// Note 1 steht oben (besser = höher). Antippen/Zeigen zeigt die Werte; alle Werte stehen zusätzlich als Chips darunter.
import { html, esc, raw } from './dom.js';
import { fmtShort } from '../logic/dates.js';
import { fmtAvg, labelFor } from '../logic/grades.js';

const H = 210;
const PAD = { l: 28, r: 46, t: 14, b: 26 };

/**
 * points: [{ date, value, avg, label, kind }] (nach Datum sortiert)
 * target: Zielnote (z. B. 2) oder null – gezeichnet bei target + 0,5 (ab da wird es die schlechtere Note)
 * width: tatsächliche Breite in Pixeln (keine Verzerrung von Schrift und Punkten)
 */
export function gradeChart(points, { target = null, tendency = 0.25, width = 340, title = 'Notenverlauf' } = {}) {
  if (points.length < 2) return '';
  const W = Math.max(260, Math.round(width));
  const vals = points.flatMap((p) => [p.value, p.avg]);
  if (target) vals.push(target + 0.5);
  const lo = Math.max(0.5, Math.floor(Math.min(...vals)));
  const hi = Math.min(6, Math.max(lo + 2, Math.ceil(Math.max(...vals))));
  const x0 = PAD.l, x1 = W - PAD.r, y0 = PAD.t, y1 = H - PAD.b;
  const n = points.length;
  const x = (i) => x0 + (i / (n - 1)) * (x1 - x0);
  const y = (v) => y0 + ((v - lo) / (hi - lo)) * (y1 - y0);
  const ticks = [];
  for (let v = Math.ceil(lo); v <= hi; v++) ticks.push(v);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.avg).toFixed(1)}`).join(' ');
  const last = points[n - 1];
  const step = (x1 - x0) / (n - 1);
  const hitW = Math.max(24, step);
  const tY = target ? y(target + 0.5) : null;
  const lastY = y(last.avg);
  const desc = `${title}: ${n} Noten vom ${fmtShort(points[0].date)} bis ${fmtShort(last.date)}, Schnitt zuletzt ${fmtAvg(last.avg)}.`;
  const svg = `
    <svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}">
      ${ticks.map((v) => `<line class="grid" x1="${x0}" x2="${x1}" y1="${y(v)}" y2="${y(v)}"/><text x="${x0 - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
      ${target ? `<line class="target" x1="${x0}" x2="${x1}" y1="${tY}" y2="${tY}"/><text class="target-label" x="${x1 + 6}" y="${tY + 4}">Ziel ${target}</text>` : ''}
      <path class="line" d="${path}"/>
      ${points.map((p, i) => `<circle class="pt" cx="${x(i)}" cy="${y(p.value)}" r="4.5"/>`).join('')}
      <circle cx="${x(n - 1)}" cy="${lastY}" r="4.5" fill="var(--chart)" stroke="var(--bg-elev)" stroke-width="2"/>
      <text x="${x(n - 1) + 8}" y="${lastY + (tY != null && Math.abs(lastY - tY) < 14 ? (lastY < tY ? -6 : 14) : 4)}" style="fill:var(--text);font-weight:700">${fmtAvg(last.avg)}</text>
      <text x="${x0}" y="${H - 6}">${fmtShort(points[0].date)}</text>
      <text x="${x1}" y="${H - 6}" text-anchor="end">${fmtShort(last.date)}</text>
      <line class="xhair" x1="0" x2="0" y1="${y0}" y2="${y1}" visibility="hidden"/>
      ${points.map((p, i) => `<rect class="hit" data-i="${i}" x="${x(i) - hitW / 2}" y="0" width="${hitW}" height="${H}" fill="transparent"/>`).join('')}
    </svg>`;
  const data = JSON.stringify(points.map((p, i) => ({ x: x(i), date: p.date, label: p.label || labelFor(p.value, tendency), kind: p.kind || '', avg: fmtAvg(p.avg) })));
  return html`<div class="chart-box" data-chart="${data}" data-w="${W}">${raw(svg)}
    <div class="chart-tip" hidden></div>
    <div class="chart-legend"><span><i></i>Schnitt</span><span><i class="dot"></i>einzelne Note</span>${target ? html`<span><i class="target"></i>ab hier wird es eine ${target + 1}</span>` : ''}</div>
  </div>`;
}

/** Tooltip: Antippen oder Zeigen auf eine Stelle im Verlauf. */
export function wireChart(root) {
  const show = (e) => {
    const box = e.target.closest?.('.chart-box');
    if (!box) return;
    const hit = e.target.closest('.hit');
    const tip = box.querySelector('.chart-tip');
    const xh = box.querySelector('.xhair');
    if (!hit) { tip.hidden = true; xh.setAttribute('visibility', 'hidden'); return; }
    const pts = JSON.parse(box.dataset.chart);
    const p = pts[+hit.dataset.i];
    tip.textContent = '';
    const b = document.createElement('b');
    b.textContent = p.label;
    const s1 = document.createElement('span');
    s1.textContent = `${p.kind ? `${p.kind} · ` : ''}${fmtShort(p.date)}`;
    const s2 = document.createElement('span');
    s2.textContent = `Schnitt danach ${p.avg}`;
    tip.append(b, s1, s2);
    tip.hidden = false;
    const w = +box.dataset.w;
    tip.style.left = `${Math.min(w - 70, Math.max(70, p.x))}px`;
    xh.setAttribute('x1', p.x);
    xh.setAttribute('x2', p.x);
    xh.setAttribute('visibility', 'visible');
  };
  const hide = (e) => {
    const box = e.target.closest?.('.chart-box');
    if (!box || box.contains(e.relatedTarget)) return;
    box.querySelector('.chart-tip').hidden = true;
    box.querySelector('.xhair').setAttribute('visibility', 'hidden');
  };
  root.addEventListener('pointermove', show);
  root.addEventListener('pointerdown', show);
  root.addEventListener('pointerout', hide);
  return () => {
    root.removeEventListener('pointermove', show);
    root.removeEventListener('pointerdown', show);
    root.removeEventListener('pointerout', hide);
  };
}

/** Mini-Verlauf (Schnitt) für Listen: gedämpft, letzter Punkt in der Akzentfarbe. 1 = oben. */
export function sparkline(avgs) {
  if (avgs.length < 2) return '';
  const w = 56, h = 26, p = 3;
  const lo = Math.min(...avgs), hi = Math.max(...avgs);
  const span = Math.max(0.5, hi - lo);
  const x = (i) => p + (i / (avgs.length - 1)) * (w - 2 * p);
  const y = (v) => p + ((v - lo) / span) * (h - 2 * p);
  const d = avgs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = avgs.length - 1;
  return raw(`<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--text3)" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(last)}" cy="${y(avgs[last])}" r="3" fill="var(--chart)" stroke="var(--bg-elev)" stroke-width="1.5"/></svg>`);
}
