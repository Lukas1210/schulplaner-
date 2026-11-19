// Karteikarten abfragen: umdrehen, „Gewusst“ / „Nicht gewusst“ – nach dem 5-Fächer-System.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, get, update } from '../store.js';
import { back } from '../router.js';
import { topbar, emptyState } from '../ui/components.js';
import { isDue, review, shuffle } from '../logic/cards.js';
import { today } from '../logic/dates.js';
import { confetti, burstAt } from '../ui/fx.js';

export const live = false; // Die Abfrage soll beim Speichern einer Antwort nicht neu starten
let s = null;

function startSession(id, query) {
  const t = today();
  const pool = all('card').filter((c) => (id === 'due' ? true : c.data.deckId === id));
  const list = id !== 'due' && query.all ? pool : pool.filter((c) => isDue(c.data, t));
  s = { id, query, queue: shuffle(list.map((c) => c.id)), pos: 0, flipped: false, right: 0, wrong: 0, tries: {}, wrongIds: new Set(), reverse: s?.reverse || false, total: list.length };
}

function paint(el) {
  const title = s.id === 'due' ? 'Fällige Karten' : get(s.id)?.data.name || 'Abfrage';
  const head = topbar({ title, back: true, backLabel: 'Fertig', fallback: '/learn', alwaysTitle: true, right: html`<button class="icon-btn" data-act="reverse" aria-label="Richtung umdrehen" aria-pressed="${s.reverse ? 'true' : 'false'}" style="${s.reverse ? 'background:var(--accent-soft)' : ''}">${icon('repeat')}</button>` });
  if (!s.total) {
    el.innerHTML = String(html`${head}<div class="page">${emptyState({ icon: 'check', title: 'Nichts fällig', text: 'Alle Karten sind auf dem neuesten Stand. Schau morgen wieder rein – oder übe alle Karten des Stapels.' })}</div>`);
    return;
  }
  if (s.pos >= s.queue.length) {
    const pct = Math.round((s.right / Math.max(1, s.right + s.wrong)) * 100);
    el.innerHTML = String(html`${head}<div class="page"><div class="quiz" style="justify-content:center">
      ${emptyState({ icon: pct >= 80 ? 'sparkles' : 'check', title: pct >= 80 ? 'Super gemacht!' : 'Runde geschafft', text: `${s.right} von ${s.right + s.wrong} Antworten richtig (${pct} %). ${s.wrongIds.size ? `${s.wrongIds.size} ${s.wrongIds.size === 1 ? 'Karte kommt' : 'Karten kommen'} morgen wieder.` : 'Alle Karten sind ein Fach weitergewandert.'}` })}
      <div class="list">${s.wrongIds.size ? html`<button class="btn block primary" data-act="again">Falsche nochmal üben</button>` : ''}<button class="btn block" data-act="done">Fertig</button></div>
    </div></div>`);
    return;
  }
  const card = get(s.queue[s.pos]);
  if (!card) { s.pos++; paint(el); return; }
  const front = s.reverse ? card.data.back : card.data.front;
  const backText = s.reverse ? card.data.front : card.data.back;
  const done = s.right + s.wrong;
  el.innerHTML = String(html`${head}<div class="page"><div class="quiz">
    <div class="quiz-top"><div class="progress"><div style="width:${(s.pos / s.queue.length) * 100}%"></div></div><span class="muted num" style="font-size:14px">${Math.min(s.pos + 1, s.queue.length)} / ${s.queue.length}</span></div>
    <div class="flashcard ${s.flipped ? 'flipped' : ''}" data-act="flip" role="button" tabindex="0" aria-label="${s.flipped ? `Antwort: ${backText}` : `Frage: ${front}. Tippen zum Umdrehen`}">
      <div class="fc-inner">
        <div class="fc-side fc-front"><div class="kicker">Fach ${card.data.box || 1}</div><div class="fc-text">${front}</div><div class="fc-hint">Tippen zum Umdrehen</div></div>
        <div class="fc-side fc-back"><div class="kicker">Antwort</div><div class="fc-text">${backText}</div></div>
      </div>
    </div>
    ${s.flipped ? html`<div class="quiz-actions"><button class="btn no" data-ans="0">${icon('close')} Nicht gewusst</button><button class="btn yes" data-ans="1">${icon('check')} Gewusst</button></div>`
      : html`<div class="quiz-actions" style="grid-template-columns:1fr"><button class="btn primary" data-act="flip">Umdrehen</button></div>`}
    <p class="muted center" style="font-size:13px;margin-top:10px">${done ? `${s.right} richtig · ${s.wrong} falsch` : 'Erst überlegen, dann umdrehen.'}</p>
  </div></div>`);
}

async function answer(el, correct, btn) {
  const id = s.queue[s.pos];
  const card = get(id);
  if (!card) return;
  if (correct) { s.right++; if (btn) burstAt(btn, 8); } else {
    s.wrong++;
    s.wrongIds.add(id);
    s.tries[id] = (s.tries[id] || 0) + 1;
    if (s.tries[id] < 2) s.queue.push(id); // am Ende der Runde noch einmal
  }
  // Wird eine Karte in derselben Runde wiederholt, zählt für das Fach die erste Antwort
  if (!correct || !s.wrongIds.has(id)) await update(id, review(card.data, correct, today()));
  s.pos++;
  s.flipped = false;
  if (s.pos >= s.queue.length && s.wrong === 0 && s.right >= 5) confetti(50);
  paint(el);
}

export function render(el, { id }, query = {}) {
  startSession(id, query);
  paint(el);
  const onClick = (e) => {
    const ans = e.target.closest('[data-ans]');
    if (ans) { answer(el, ans.dataset.ans === '1', ans); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    switch (a.dataset.act) {
      case 'flip': if (!s.flipped) { s.flipped = true; paint(el); } break;
      case 'reverse': s.reverse = !s.reverse; s.flipped = false; paint(el); break;
      case 'again': {
        const ids = [...s.wrongIds];
        s = { ...s, queue: shuffle(ids), pos: 0, flipped: false, right: 0, wrong: 0, tries: {}, wrongIds: new Set(), total: ids.length };
        paint(el);
        break;
      }
      case 'done': back('/learn'); break;
    }
  };
  const onKey = (e) => {
    if (e.target.closest?.('input, textarea')) return;
    if (!s || s.pos >= s.queue.length) return;
    if ((e.key === ' ' || e.key === 'Enter') && !s.flipped) { e.preventDefault(); s.flipped = true; paint(el); }
    else if (s.flipped && (e.key === 'ArrowRight' || e.key === 'j')) answer(el, true);
    else if (s.flipped && (e.key === 'ArrowLeft' || e.key === 'n')) answer(el, false);
  };
  el.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  return () => { el.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); };
}
