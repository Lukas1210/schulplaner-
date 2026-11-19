// Fach anlegen oder bearbeiten: Name, Kürzel, Farbe, Lehrkraft, Raum, Hauptfach, Gewichtung, Zielnote.
import { html } from '../ui/dom.js';
import { save, update, removeMany, all, get } from '../store.js';
import { confirmDialog, toast } from '../ui/sheet.js';
import { SUBJECT_COLORS, shortFor, nextColor, subjects } from '../model.js';
import { WEIGHT_PRESETS } from '../logic/grades.js';
import { formSheet, val, checked, toggleCell } from './kit.js';

export function openSubjectForm(id = null) {
  return new Promise((resolve) => {
    const it = id ? get(id) : null;
    const d = it?.data || { name: '', short: '', color: nextColor(), teacher: '', room: '', main: false, written: 50, target: null };
    let color = d.color;
    let written = d.written === undefined ? 50 : d.written;
    let shortTouched = !!it;
    const presetKey = () => {
      const p = WEIGHT_PRESETS.find((x) => (x.written == null ? written == null : written != null && Math.abs(x.written - written) < 0.01));
      return p ? p.key : 'custom';
    };

    const body = html`
      <div class="form">
        <div class="group">
          <div class="cell"><label for="sf-name">Name</label><input id="sf-name" value="${d.name}" placeholder="z. B. Mathe" autocomplete="off" data-enter="save"></div>
          <div class="cell"><label for="sf-short">Kürzel</label><input id="sf-short" value="${d.short}" placeholder="M" maxlength="4" autocomplete="off" data-enter="save"></div>
        </div>
        <div>
          <div class="group-label">Farbe</div>
          <div class="group" style="padding:12px 16px">
            <div class="color-row" id="sf-colors">${SUBJECT_COLORS.map((c) => html`<button type="button" class="color-sw ${c === color ? 'active' : ''}" style="--c:${c}" data-color="${c}" aria-label="Farbe ${c}"></button>`)}</div>
          </div>
        </div>
        <div class="group">
          <div class="cell"><label for="sf-teacher">Lehrkraft</label><input id="sf-teacher" value="${d.teacher || ''}" placeholder="optional" autocomplete="off"></div>
          <div class="cell"><label for="sf-room">Raum</label><input id="sf-room" value="${d.room || ''}" placeholder="optional" autocomplete="off"></div>
          ${toggleCell('sf-main', 'Hauptfach', d.main, 'Zählt auf Wunsch doppelt im Gesamtschnitt')}
        </div>
        <div>
          <div class="group-label">Gewichtung der Noten</div>
          <div class="group">
            <label class="cell" for="sf-weight"><span class="label">Schriftlich : Mündlich</span>
              <select id="sf-weight">
                ${WEIGHT_PRESETS.map((p) => html`<option value="${p.key}" ${presetKey() === p.key ? 'selected' : ''}>${p.label} (${p.sub})</option>`)}
                <option value="custom" ${presetKey() === 'custom' ? 'selected' : ''}>Eigene Prozente</option>
              </select>
            </label>
            <div class="cell ${presetKey() === 'custom' ? '' : 'hidden'}" id="sf-custom-row"><label for="sf-custom">Schriftlich in %</label><input id="sf-custom" type="number" inputmode="numeric" min="0" max="100" value="${written != null ? Math.round(written) : 50}" class="right"></div>
          </div>
          <div class="group-foot">Frag im Zweifel deine Lehrkraft, wie Arbeiten und mündliche Noten zählen.</div>
        </div>
        <div class="group">
          <label class="cell" for="sf-target"><span class="label">Zielnote</span>
            <select id="sf-target">
              <option value="">Keine</option>
              ${[1, 2, 3, 4].map((n) => html`<option value="${n}" ${d.target === n ? 'selected' : ''}>${n}</option>`)}
            </select>
          </label>
        </div>
      </div>`;

    const sheet = formSheet({
      title: it ? 'Fach bearbeiten' : 'Neues Fach',
      body,
      focus: it ? null : '#sf-name',
      onSave: async () => {
        const name = val(sheet.body, '#sf-name');
        if (!name) { toast('Bitte einen Namen eingeben', { icon: 'info' }); return false; }
        const short = val(sheet.body, '#sf-short') || shortFor(name);
        const sel = sheet.body.querySelector('#sf-weight').value;
        const w = sel === 'custom' ? Math.max(0, Math.min(100, Number(val(sheet.body, '#sf-custom')) || 0)) : WEIGHT_PRESETS.find((p) => p.key === sel).written;
        const target = val(sheet.body, '#sf-target');
        const data = {
          ...d,
          name,
          short: short.slice(0, 4),
          color,
          teacher: val(sheet.body, '#sf-teacher'),
          room: val(sheet.body, '#sf-room'),
          main: checked(sheet.body, '#sf-main'),
          written: w,
          target: target ? Number(target) : null,
          order: d.order ?? subjects().length,
        };
        const saved = it ? await update(it.id, data) : await save('subject', data);
        resolve(saved);
      },
      onDelete: it ? async () => {
        const used = ['lesson', 'task', 'exam', 'grade', 'deck'].reduce((n, t) => n + all(t).filter((x) => x.data.subjectId === it.id).length, 0);
        const ok = await confirmDialog({
          title: `${d.name} löschen?`,
          message: used ? 'Stunden, Hausaufgaben, Tests, Noten und Karteikarten dieses Fachs werden ebenfalls gelöscht. Tipp: Statt zu löschen kannst du ein Fach am Schuljahresende archivieren.' : '',
          ok: 'Löschen',
          danger: true,
        });
        if (!ok) return false;
        const ids = ['lesson', 'task', 'exam', 'grade', 'deck'].flatMap((t) => all(t).filter((x) => x.data.subjectId === it.id).map((x) => x.id));
        const deckIds = new Set(all('deck').filter((x) => x.data.subjectId === it.id).map((x) => x.id));
        ids.push(...all('card').filter((c) => deckIds.has(c.data.deckId)).map((c) => c.id));
        await removeMany([...ids, it.id]);
        resolve(null);
      } : null,
    });
    sheet.closed.then((r) => { if (r !== true) resolve(undefined); });

    const nameEl = sheet.body.querySelector('#sf-name');
    const shortEl = sheet.body.querySelector('#sf-short');
    shortEl.addEventListener('input', () => { shortTouched = true; });
    nameEl.addEventListener('input', () => { if (!shortTouched) shortEl.value = shortFor(nameEl.value); });
    sheet.body.querySelector('#sf-colors').addEventListener('click', (e) => {
      const b = e.target.closest('[data-color]');
      if (!b) return;
      color = b.dataset.color;
      sheet.body.querySelectorAll('.color-sw').forEach((x) => x.classList.toggle('active', x === b));
      sheet.markDirty();
    });
    sheet.body.querySelector('#sf-weight').addEventListener('change', (e) => {
      sheet.body.querySelector('#sf-custom-row').classList.toggle('hidden', e.target.value !== 'custom');
      if (e.target.value !== 'custom') written = WEIGHT_PRESETS.find((p) => p.key === e.target.value).written;
    });
  });
}
