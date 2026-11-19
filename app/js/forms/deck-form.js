// Kartenstapel und Karteikarten: anlegen, bearbeiten, mehrere auf einmal importieren.
import { html } from '../ui/dom.js';
import { save, update, removeMany, get, all, saveMany } from '../store.js';
import { toast, confirmDialog } from '../ui/sheet.js';
import { go } from '../router.js';
import { today } from '../logic/dates.js';
import { parseImport } from '../logic/cards.js';
import { formSheet, subjectCell, wireSubjectPicker, val } from './kit.js';

export function openDeckForm({ id = null, subjectId = null } = {}) {
  const it = id ? get(id) : null;
  const d = it?.data || { name: '', subjectId };
  const sheet = formSheet({
    title: it ? 'Stapel bearbeiten' : 'Neuer Kartenstapel',
    focus: it ? null : '#df-name',
    body: html`<div class="form">
      <div class="group">
        <div class="cell"><label for="df-name">Name</label><input id="df-name" value="${d.name}" placeholder="z. B. Unit 4 Vokabeln" autocomplete="off" data-enter="save"></div>
        ${subjectCell(d.subjectId)}
      </div>
      ${it ? '' : html`<div><div class="group-label">Karten (optional)</div><div class="group"><div class="cell col"><textarea id="df-import" rows="6" placeholder="Eine Karte pro Zeile:&#10;house – Haus&#10;to achieve – erreichen"></textarea></div></div><div class="group-foot">Vorder- und Rückseite mit „–“, „;“ oder Tab trennen. Du kannst auch später Karten hinzufügen.</div></div>`}
    </div>`,
    onSave: async (sh) => {
      const name = val(sh.body, '#df-name');
      if (!name) { toast('Bitte einen Namen eingeben', { icon: 'info' }); return false; }
      const data = { ...d, name, subjectId: sh.body.querySelector('[data-pick="subject"]').dataset.value || null };
      if (it) { await update(it.id, data); return; }
      const deck = await save('deck', data);
      const pairs = parseImport(sh.body.querySelector('#df-import')?.value || '');
      if (pairs.length) await saveMany(pairs.map((p) => ({ type: 'card', data: { deckId: deck.id, front: p.front, back: p.back, box: 1, due: today(), last: null } })));
      toast(pairs.length ? `Stapel mit ${pairs.length} Karten angelegt` : 'Stapel angelegt', { icon: 'check' });
      go(`/deck/${deck.id}`);
    },
    onDelete: it ? async () => {
      const cards = all('card').filter((c) => c.data.deckId === it.id);
      const ok = await confirmDialog({ title: `„${d.name}“ löschen?`, message: cards.length ? `${cards.length} Karten werden ebenfalls gelöscht.` : '', ok: 'Löschen', danger: true });
      if (!ok) return false;
      await removeMany([...cards.map((c) => c.id), it.id]);
      go('/learn', { replace: true });
    } : null,
  });
  wireSubjectPicker(sheet, { allowNone: true });
  return sheet;
}

/** Eine Karte anlegen/bearbeiten. Beim Anlegen bleibt das Sheet für die nächste Karte offen. */
export function openCardForm({ deckId, id = null }) {
  const it = id ? get(id) : null;
  const d = it?.data || { front: '', back: '' };
  let added = 0;
  const sheet = formSheet({
    title: it ? 'Karte bearbeiten' : 'Neue Karte',
    saveLabel: it ? 'Sichern' : 'Fertig',
    focus: '#cf-front',
    body: html`<div class="form">
      <div class="group">
        <div class="cell col"><label for="cf-front">Vorderseite</label><textarea id="cf-front" rows="2" placeholder="z. B. to achieve">${d.front}</textarea></div>
        <div class="cell col"><label for="cf-back">Rückseite</label><textarea id="cf-back" rows="2" placeholder="z. B. erreichen">${d.back}</textarea></div>
      </div>
      ${it ? '' : html`<button class="btn block ghost" type="button" data-next>Hinzufügen und nächste Karte</button><p class="muted center" id="cf-count" style="font-size:13px;margin-top:8px"></p>`}
    </div>`,
    onSave: async (sh) => {
      const front = val(sh.body, '#cf-front');
      const back = val(sh.body, '#cf-back');
      if (it) {
        if (!front || !back) { toast('Beide Seiten ausfüllen', { icon: 'info' }); return false; }
        await update(it.id, { front, back });
        return;
      }
      if (front && back) { await save('card', { deckId, front, back, box: 1, due: today(), last: null }); added++; }
      if (added) toast(`${added} ${added === 1 ? 'Karte' : 'Karten'} hinzugefügt`, { icon: 'check' });
    },
    onDelete: it ? async () => { await removeMany([it.id]); } : null,
  });
  sheet.body.querySelector('[data-next]')?.addEventListener('click', async () => {
    const front = val(sheet.body, '#cf-front');
    const back = val(sheet.body, '#cf-back');
    if (!front || !back) { toast('Beide Seiten ausfüllen', { icon: 'info' }); return; }
    await save('card', { deckId, front, back, box: 1, due: today(), last: null });
    added++;
    sheet.body.querySelector('#cf-front').value = '';
    sheet.body.querySelector('#cf-back').value = '';
    sheet.body.querySelector('#cf-count').textContent = `${added} ${added === 1 ? 'Karte' : 'Karten'} hinzugefügt`;
    sheet.body.querySelector('#cf-front').focus();
  });
  return sheet;
}

/** Viele Karten auf einmal aus einer Liste übernehmen. */
export function openImportForm({ deckId }) {
  const sheet = formSheet({
    title: 'Karten importieren',
    saveLabel: 'Importieren',
    focus: '#if-text',
    body: html`<div class="form">
      <div class="group"><div class="cell col"><textarea id="if-text" rows="10" placeholder="Eine Karte pro Zeile:&#10;house – Haus&#10;dog; Hund&#10;cat	Katze"></textarea></div></div>
      <p class="muted" id="if-count" style="font-size:14px;margin:0 4px">Vorder- und Rückseite mit „–“, „;“, „=“ oder Tab trennen (z. B. aus einer Tabelle kopiert).</p>
    </div>`,
    onSave: async (sh) => {
      const pairs = parseImport(val(sh.body, '#if-text'));
      if (!pairs.length) { toast('Keine Karten erkannt', { icon: 'info' }); return false; }
      await saveMany(pairs.map((p) => ({ type: 'card', data: { deckId, front: p.front, back: p.back, box: 1, due: today(), last: null } })));
      toast(`${pairs.length} Karten importiert`, { icon: 'check' });
    },
  });
  sheet.body.querySelector('#if-text').addEventListener('input', (e) => {
    const n = parseImport(e.target.value).length;
    sheet.body.querySelector('#if-count').textContent = n ? `${n} ${n === 1 ? 'Karte' : 'Karten'} erkannt` : 'Noch keine Karte erkannt';
  });
  return sheet;
}
