// Kleine Effekte: Funken beim Abhaken, Konfetti bei guten Noten.
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Funken und ein Ring von einem Punkt aus. */
export function sparkBurst(x, y, n = 10) {
  if (reduced()) return;
  n = Math.min(n, 14);
  const ring = document.createElement('div');
  ring.className = 'fx-ring';
  ring.style.cssText = `left:${x - 14}px;top:${y - 14}px;width:28px;height:28px;`;
  document.body.appendChild(ring);
  ring.animate([{ transform: 'scale(.4)', opacity: 0.9 }, { transform: 'scale(2.4)', opacity: 0 }], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => ring.remove();
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'fx-spark';
    const len = 7 + Math.random() * 8;
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const dist = 26 + Math.random() * 34;
    const deg = (ang * 180) / Math.PI + 90;
    el.style.cssText = `left:${x - 1.5}px;top:${y - len / 2}px;height:${len}px;`;
    document.body.appendChild(el);
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
    el.animate(
      [
        { transform: `translate(0,0) rotate(${deg}deg) scaleY(.3)`, opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) rotate(${deg}deg) scaleY(1)`, opacity: 0.9, offset: 0.55 },
        { transform: `translate(${dx * 1.2}px,${dy * 1.2}px) rotate(${deg}deg) scaleY(.2)`, opacity: 0 },
      ],
      { duration: 560 + Math.random() * 200, easing: 'cubic-bezier(.2,.8,.2,1)' },
    ).onfinish = () => el.remove();
  }
}

/** Funken an der Mitte eines Elements. */
export function burstAt(el, n) {
  if (!el?.getBoundingClientRect) return;
  const r = el.getBoundingClientRect();
  sparkBurst(r.left + r.width / 2, r.top + r.height / 2, n);
}

/** Konfetti von oben. */
export function confetti(n = 60) {
  if (reduced()) return;
  const w = window.innerWidth, h = window.innerHeight;
  const cs = getComputedStyle(document.documentElement);
  const v = (name, f) => cs.getPropertyValue(name).trim() || f;
  const colors = [v('--accent', '#7FA287'), v('--accent2', '#C8714F'), v('--amp-yellow', '#E0A100'), v('--amp-green', '#4C9A5B'), v('--text', '#222')];
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'fx-confetti';
    const cw = 5 + Math.random() * 5, ch = 8 + Math.random() * 8;
    el.style.cssText = `left:${Math.random() * w}px;width:${cw}px;height:${ch}px;background:${colors[i % colors.length]};`;
    document.body.appendChild(el);
    const drift = (Math.random() - 0.5) * 160;
    const spin = (Math.random() - 0.5) * 900;
    el.animate(
      [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 0 },
        { opacity: 1, offset: 0.08 },
        { transform: `translate(${drift}px,${h + 60}px) rotate(${spin}deg)`, opacity: 0.85 },
      ],
      { duration: 2000 + Math.random() * 1500, delay: Math.random() * 600, easing: 'cubic-bezier(.25,.1,.5,1)', fill: 'backwards' },
    ).onfinish = () => el.remove();
  }
}
