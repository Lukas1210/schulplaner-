// Kartenstapel: Fächer-Übersicht (Leitner), üben, Karten bearbeiten und importieren.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { all, get } from '../store.js';
import { go } from '../router.js';
import { topbar, subjBadge, emptyState } from '../ui/components.js';
import { subjectById } from '../model.js';
import { isDue, boxCounts, INTERVALS } from '../logic/cards.js';
import { today } from '../logic/dates.js';

export const live = true;

export async function onFab() {
  const id = location.hash.split('/')[2];
  (await import('../forms/deck-form.js')).openCardForm({ deckId: id });
}

export function render(el, { id }) {
  const deck = get(id);
  if (!deck || deck.type !== 'deck') {
    el.innerHTML = String(html`${topbar({ back: true })}<div class="page">${emptyState({ icon: 'cards', title: 'Stapel nicht gefunden' })}</div>`);
    return;
  }
  const t = today();
  const s = subjectById(deck.data.subjectId);
  const cards = all('card').filter((c) => c.data.deckId === id).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const due = cards.filter((c) => isDue(c.data, t)).length;
  const counts = boxCounts(cards.map((c) => c.data));

  el.innerHTML = String(html`
    ${topbar({ title: deck.data.name, back: true, fallback: '/learn', right: html`<button class="text-btn" data-act="edit">Bearbeiten</button>` })}
    <div class="page">
      <div class="detail-head">${s ? subjBadge(s, { size: 'lg' }) : html`<span class="ico-tile lg">${icon('cards')}</span>`}<div class="grow"><h1>${deck.data.name}</h1><div class="dh-sub">${s ? `${s.data.name} · ` : ''}${cards.length} ${cards.length === 1 ? 'Karte' : 'Karten'}</div></div></div>
      ${cards.length ? html`
        <div class="section" style="margin-top:16px">
          <div class="boxes">${[1, 2, 3, 4, 5].map((b) => html`<div><b>${counts[b]}</b><small>Fach ${b}</small></div>`)}</div>
          <p class="muted" style="font-size:13px;margin:8px 4px 0">Richtig beantwortet wandert eine Karte ein Fach weiter (Abfrage nach ${INTERVALS.slice(1).join(', ')} Tagen), falsch zurück in Fach 1.</p>
        </div>
        <div class="section list">
          <button class="btn block primary" data-go="/quiz/${id}" ${due ? '' : 'disabled'}>${icon('play')} ${due ? `${due} fällige ${due === 1 ? 'Karte' : 'Karten'} üben` : 'Heute nichts fällig'}</button>
          <button class="btn block ghost" data-go="/quiz/${id}?all=1">${icon('shuffle')} Alle ${cards.length} üben</button>
        </div>` : ''}
      <div class="section">
        <div class="section-head"><h2 class="section-title small">Karten</h2><div class="row" style="gap:4px"><button class="section-link" data-act="import">Importieren</button><span class="faint">·</span><button class="section-link" data-act="add">${icon('plus')} Karte</button></div></div>
        ${cards.length ? html`<div class="todo-group">${cards.map((c) => html`<button class="card-line" data-card="${c.id}"><span class="cl-front">${c.data.front}</span><span class="cl-back">${c.data.back}</span><span class="cl-box">F${c.data.box || 1}</span></button>`)}</div>`
          : emptyState({ icon: 'cards', title: 'Noch keine Karten', text: 'Füge Karten einzeln hinzu oder importiere eine ganze Liste.', action: html`<button class="btn primary" data-act="add">${icon('plus')} Karte hinzufügen</button>`, small: true })}
      </div>
    </div>`);

  const onClick = async (e) => {
    const g = e.target.closest('[data-go]');
    if (g && !g.disabled) { go(g.dataset.go); return; }
    const c = e.target.closest('[data-card]');
    if (c) { (await import('../forms/deck-form.js')).openCardForm({ deckId: id, id: c.dataset.card }); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const forms = await import('../forms/deck-form.js');
    if (a.dataset.act === 'edit') forms.openDeckForm({ id });
    if (a.dataset.act === 'add') forms.openCardForm({ deckId: id });
    if (a.dataset.act === 'import') forms.openImportForm({ deckId: id });
  };
  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
}
