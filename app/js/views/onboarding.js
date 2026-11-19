// Erster Start: Willkommen → Über dich → Fächer → Plus/Minus → Stundenplan. Oder: mit bestehendem Konto anmelden.
import { html } from '../ui/dom.js';
import { saveSettings, setDevice, saveMany, all, settings } from '../store.js';
import { isConfigured, login } from '../sync.js';
import { toast } from '../ui/sheet.js';
import { SUBJECT_PRESETS } from '../model.js';
import { STATES } from '../logic/holidays.js';
import { TENDENCIES } from '../logic/grades.js';
import { refreshHolidays } from '../holidays.js';
import { icon } from '../ui/icons.js';

export function runOnboarding() {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'onb';
    document.body.appendChild(root);
    const data = { name: '', klasse: '', state: '', picked: new Set(['Deutsch', 'Mathe', 'Englisch']), custom: [], tendency: 0.25, goTimetable: false };

    const dots = (n) => html`<div class="dots" aria-hidden="true">${[0, 1, 2, 3].map((i) => html`<span class="${i === n ? 'on' : ''}"></span>`)}</div>`;

    const finish = async () => {
      await setDevice({ onboarded: true });
      root.style.transition = 'opacity .4s ease';
      root.style.opacity = '0';
      setTimeout(() => {
        root.remove();
        resolve();
        if (data.goTimetable) location.hash = '/timetable';
      }, 400);
    };

    const saveAll = async () => {
      await saveSettings({ name: data.name, klasse: data.klasse, state: data.state, tendency: data.tendency });
      const existing = new Set(all('subject').map((s) => s.data.name.toLowerCase()));
      const list = [];
      let order = all('subject').length;
      for (const p of SUBJECT_PRESETS) {
        if (data.picked.has(p.name) && !existing.has(p.name.toLowerCase())) list.push({ type: 'subject', data: { name: p.name, short: p.short, color: p.color, main: !!p.main, written: 50, teacher: '', room: '', target: null, order: order++ } });
      }
      const colors = ['#1F6F78', '#8E3F7A', '#6B7A1F', '#7A5235', '#4B4FA6'];
      data.custom.forEach((name, i) => {
        if (!existing.has(name.toLowerCase())) list.push({ type: 'subject', data: { name, short: name.slice(0, 3), color: colors[i % colors.length], main: false, written: 50, teacher: '', room: '', target: null, order: order++ } });
      });
      await saveMany(list);
      refreshHolidays().catch(() => {});
    };

    function welcome() {
      root.innerHTML = String(html`
        <div class="step">
          <img class="logo" src="assets/icons/icon-512.png" alt="">
          <h1>Schulplaner</h1>
          <p class="lead">Stundenplan, Hausaufgaben, Tests und Noten an einem Ort – mit Lernplan, Karteikarten und Ferien-Countdown.</p>
          <div class="actions">
            <button class="btn primary block" data-go="profile">Loslegen</button>
            ${isConfigured() ? html`<button class="btn ghost block" data-go="connect">Ich habe schon ein Konto</button>` : ''}
          </div>
        </div>`);
    }

    function profile() {
      root.innerHTML = String(html`
        <div class="step">
          ${dots(0)}
          <h1>Über dich</h1>
          <p class="lead">Das Bundesland brauche ich für die Ferien und Feiertage.</p>
          <div class="form">
            <div class="group">
              <div class="cell"><label for="o-name">Name</label><input id="o-name" value="${data.name}" placeholder="optional" autocomplete="given-name"></div>
              <div class="cell"><label for="o-klasse">Klasse</label><input id="o-klasse" value="${data.klasse}" placeholder="z. B. 9b" autocomplete="off"></div>
              <label class="cell" for="o-state"><span class="label">Bundesland</span>
                <select id="o-state"><option value="">Bitte wählen</option>${STATES.map((s) => html`<option value="${s.code}" ${data.state === s.code ? 'selected' : ''}>${s.name}</option>`)}</select>
              </label>
            </div>
          </div>
          <div class="actions"><button class="btn primary block" data-go="subjects">Weiter</button></div>
        </div>`);
    }

    function subjectsStep() {
      const chip = (name, on) => html`<button class="chip ${on ? 'active' : ''}" data-subj="${name}" aria-pressed="${on ? 'true' : 'false'}">${on ? icon('check') : ''}${name}</button>`;
      root.innerHTML = String(html`
        <div class="step">
          ${dots(1)}
          <h1>Deine Fächer</h1>
          <p class="lead">Tippe alle an, die du hast. Farben, Lehrkräfte und Räume kannst du später anpassen.</p>
          <div class="chips wrap" id="o-subjects">
            ${SUBJECT_PRESETS.map((p) => chip(p.name, data.picked.has(p.name)))}
            ${data.custom.map((n) => chip(n, true))}
          </div>
          <div class="form" style="margin-top:16px">
            <div class="group"><div class="cell"><input id="o-custom" placeholder="Anderes Fach, z. B. NwT" autocomplete="off"><button class="text-btn small" data-act="add-custom">Hinzufügen</button></div></div>
          </div>
          <div class="actions"><button class="btn primary block" data-go="tendency">Weiter</button></div>
        </div>`);
    }

    function tendencyStep() {
      root.innerHTML = String(html`
        <div class="step">
          ${dots(2)}
          <h1>Plus und Minus</h1>
          <p class="lead">Wie viel zählt bei deiner Schule ein Plus oder Minus? Das brauche ich für den Notenschnitt.</p>
          <div class="form">
            <div class="action-list">
              ${TENDENCIES.map((t) => html`<button class="action-row ${Math.abs(data.tendency - t.value) < 0.01 ? 'selected' : ''}" data-tend="${t.value}"><span class="grow"><span class="ar-label">${t.label}</span><span class="ar-sub">${t.hint}</span></span>${Math.abs(data.tendency - t.value) < 0.01 ? html`<span class="ar-check">${icon('check')}</span>` : ''}</button>`)}
            </div>
            <div class="group-foot">Weißt du es nicht? Lass 0,25 stehen – du kannst es jederzeit in den Einstellungen ändern.</div>
          </div>
          <div class="actions"><button class="btn primary block" data-go="timetable">Weiter</button></div>
        </div>`);
    }

    function timetableStep() {
      root.innerHTML = String(html`
        <div class="step">
          ${dots(3)}
          <h1>Stundenplan</h1>
          <p class="lead">Mit Stundenplan weiß die App, wann deine nächste Stunde ist – und setzt bei Hausaufgaben das Datum von selbst.</p>
          <div class="actions">
            <button class="btn primary block" data-go="done-tt">Jetzt eintragen</button>
            <button class="btn ghost block" data-go="done">Später</button>
          </div>
        </div>`);
    }

    function connect() {
      root.innerHTML = String(html`
        <div class="step">
          <h1>Anmelden</h1>
          <p class="lead">Melde dich mit deinem Konto an. Deine Fächer, Noten und Aufgaben werden dann geladen.</p>
          <form class="form" id="o-login">
            <div class="group">
              <div class="cell"><label for="o-email">E-Mail</label><input id="o-email" type="email" autocomplete="username" autocapitalize="off" required></div>
              <div class="cell"><label for="o-pw">Passwort</label><input id="o-pw" type="password" autocomplete="current-password" required></div>
            </div>
            <button class="btn primary block" type="submit">Anmelden</button>
          </form>
          <div class="actions"><button class="btn ghost block" data-go="welcome">Zurück</button></div>
        </div>`);
    }

    const readProfile = () => {
      data.name = root.querySelector('#o-name')?.value.trim() ?? data.name;
      data.klasse = root.querySelector('#o-klasse')?.value.trim() ?? data.klasse;
      data.state = root.querySelector('#o-state')?.value ?? data.state;
    };
    const addCustom = () => {
      const inp = root.querySelector('#o-custom');
      const name = inp.value.trim();
      if (!name) return;
      if (!data.custom.includes(name) && !SUBJECT_PRESETS.some((p) => p.name.toLowerCase() === name.toLowerCase())) data.custom.push(name);
      else data.picked.add(SUBJECT_PRESETS.find((p) => p.name.toLowerCase() === name.toLowerCase())?.name);
      subjectsStep();
      root.querySelector('#o-custom').focus();
    };

    root.addEventListener('click', async (e) => {
      const s = e.target.closest('[data-subj]');
      if (s) {
        const n = s.dataset.subj;
        if (data.custom.includes(n)) data.custom = data.custom.filter((x) => x !== n);
        else if (data.picked.has(n)) data.picked.delete(n);
        else data.picked.add(n);
        subjectsStep();
        return;
      }
      const t = e.target.closest('[data-tend]');
      if (t) { data.tendency = Number(t.dataset.tend); tendencyStep(); return; }
      if (e.target.closest('[data-act="add-custom"]')) { addCustom(); return; }
      const g = e.target.closest('[data-go]');
      if (!g) return;
      const to = g.dataset.go;
      if (to === 'subjects') readProfile();
      if (to === 'welcome') welcome();
      else if (to === 'profile') profile();
      else if (to === 'subjects') subjectsStep();
      else if (to === 'tendency') tendencyStep();
      else if (to === 'timetable') timetableStep();
      else if (to === 'connect') connect();
      else if (to === 'done' || to === 'done-tt') {
        g.disabled = true;
        data.goTimetable = to === 'done-tt';
        await saveAll();
        finish();
      }
    });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.id === 'o-custom') { e.preventDefault(); addCustom(); }
    });
    root.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = root.querySelector('#o-login button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Melde an …';
      try {
        await login(root.querySelector('#o-email').value, root.querySelector('#o-pw').value);
        // Wurden Daten geladen? Dann ist die Einrichtung schon erledigt.
        if (all('subject').length || settings().state) { toast('Willkommen zurück!', { icon: 'check' }); finish(); }
        else profile();
      } catch (err) {
        toast(err.message || 'Anmeldung fehlgeschlagen', { icon: 'info', duration: 4000 });
        btn.disabled = false;
        btn.textContent = 'Anmelden';
      }
    });

    welcome();
  });
}
