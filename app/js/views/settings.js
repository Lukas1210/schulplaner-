// Einstellungen: Profil, Schuljahr, Ferien, Noten, Lernen, Kalender, Fehltage, Darstellung, Sync, Backup.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { settings, saveSettings, allRaw, importItems } from '../store.js';
import { wipeAll } from '../db.js';
import { topbar } from '../ui/components.js';
import { openSheet, confirmDialog, toast } from '../ui/sheet.js';
import { getStatus, onStatus, isConfigured, currentUser, login, logout, syncNow, setCredentials, config } from '../sync.js';
import { getThemePref, setThemePref, getPalette, setPalette, PALETTES, effectiveTheme } from '../theme.js';
import { holidayList, holidayStatus, refreshHolidays } from '../holidays.js';
import { STATES, stateName } from '../logic/holidays.js';
import { TENDENCIES } from '../logic/grades.js';
import { PENSUM } from '../logic/plan.js';
import { REMINDER_OPTIONS } from '../logic/ics.js';
import { schoolYear, today, fmtFull, fmtRange, fmtDay } from '../logic/dates.js';
import { APP_VERSION } from '../model.js';
import { refresh } from '../router.js';
import { selectCell, toggleCell } from '../forms/kit.js';

export const live = true;

async function exportBackup() {
  const items = allRaw().map(({ dirty, ...rest }) => rest);
  const json = JSON.stringify({ app: 'schulplaner', version: 1, exportedAt: new Date().toISOString(), items });
  const file = new File([json], `schulplaner-backup-${today()}.json`, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Schulplaner-Backup' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Backup gespeichert', { icon: 'download' });
}

async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'schulplaner' || !Array.isArray(data.items)) throw new Error('Keine Schulplaner-Backup-Datei');
    const ok = await confirmDialog({ title: 'Backup importieren?', message: `${data.items.length} Einträge vom ${fmtFull(String(data.exportedAt).slice(0, 10))} werden übernommen. Einträge mit gleicher ID werden überschrieben.`, ok: 'Importieren' });
    if (!ok) return;
    const n = await importItems(data.items);
    toast(`${n} Einträge importiert`, { icon: 'check' });
  } catch (e) {
    toast(`Import fehlgeschlagen: ${e.message}`, { icon: 'info', duration: 4000 });
  }
}

function statusPill(st) {
  const cls = st.state === 'idle' ? 'ok' : st.state === 'busy' ? 'busy' : st.state === 'error' ? 'err' : '';
  const text = st.state === 'idle' ? (st.lastSync ? `Synchronisiert ${new Date(st.lastSync).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : 'Bereit') : st.message || 'Aus';
  return html`<span class="sync-pill ${cls}"><span class="dot"></span>${text}</span>`;
}

async function syncSection() {
  if (!isConfigured()) {
    return html`
      <div class="group">
        <div class="cell"><span class="grow muted" style="font-size:15px">Sync ist noch nicht eingerichtet. Damit iPhone und iPad dieselben Daten haben, braucht es ein Supabase-Projekt (Anleitung im README).</span></div>
        <button class="cell link" data-act="creds"><span class="cell-icon gray">${icon('cloud')}</span><span class="grow">Zugangsdaten eingeben</span><span class="chev">${icon('chevron')}</span></button>
      </div>`;
  }
  const user = await currentUser();
  if (!user) {
    return html`
      <form class="group" id="login">
        <div class="cell"><label for="le">E-Mail</label><input id="le" type="email" autocomplete="username" autocapitalize="off" required></div>
        <div class="cell"><label for="lp">Passwort</label><input id="lp" type="password" autocomplete="current-password" required></div>
        <div class="cell"><button class="btn primary block small" type="submit">Anmelden</button></div>
      </form>
      <div class="group-foot">Mit demselben Konto auf iPhone und iPad anmelden. <button class="text-btn small" type="button" data-act="creds" style="padding:0">Zugangsdaten ändern</button></div>`;
  }
  return html`
    <div class="group">
      <div class="cell"><span class="cell-icon">${icon('user')}</span><span class="grow ellipsis">${user.email}</span></div>
      <div class="cell"><span class="grow" id="sync-status">${statusPill(getStatus())}</span><button class="text-btn small" data-act="sync">${icon('refresh')} Jetzt</button></div>
      <button class="cell link danger-row" data-act="logout"><span class="grow">Abmelden</span></button>
    </div>`;
}

function credsSheet() {
  const c = config();
  const s = openSheet({
    title: 'Zugangsdaten',
    left: html`<button class="text-btn" data-x="cancel">Abbrechen</button>`,
    right: html`<button class="text-btn strong" data-x="save">Sichern</button>`,
    body: html`<div class="form"><div class="group">
      <div class="cell col"><label for="cu">Project URL</label><input id="cu" value="${c.url}" placeholder="https://xyz.supabase.co" autocapitalize="off" autocomplete="off"></div>
      <div class="cell col"><label for="ck">Publishable / anon Key</label><input id="ck" value="${c.key}" autocapitalize="off" autocomplete="off"></div>
    </div><div class="group-foot">Steht in Supabase unter Project Settings → API. Gilt nur für dieses Gerät; für alle Geräte trägst du es in config.js ein.</div></div>`,
  });
  s.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-x]');
    if (!b) return;
    if (b.dataset.x === 'save') {
      await setCredentials(s.body.querySelector('#cu').value, s.body.querySelector('#ck').value);
      toast('Gespeichert', { icon: 'check' });
    }
    s.close();
  });
}

export async function render(el, _params, _query, ctx = {}) {
  const s = settings();
  const y = schoolYear(s, today());
  const hs = holidayStatus();
  const hol = holidayList().filter((h) => h.end >= today() && h.kind === 'school').slice(0, 5);
  const syncHtml = await syncSection();
  if (ctx.alive && !ctx.alive()) return; // inzwischen woanders hin navigiert
  const theme = getThemePref();
  const pal = getPalette();
  const mode = effectiveTheme();

  el.innerHTML = String(html`
    ${topbar({ title: 'Einstellungen', back: true })}
    <div class="page">
      <h1 class="large-title">Einstellungen</h1>
      <div class="form" style="margin-top:14px">
        <div>
          <div class="group-label">Über dich</div>
          <div class="group">
            <div class="cell"><label for="st-name">Name</label><input id="st-name" data-key="name" value="${s.name}" placeholder="optional"></div>
            <div class="cell"><label for="st-klasse">Klasse</label><input id="st-klasse" data-key="klasse" value="${s.klasse}" placeholder="z. B. 9b"></div>
            ${selectCell('st-state', 'Bundesland', [{ value: '', label: 'Bitte wählen' }, ...STATES.map((x) => ({ value: x.code, label: x.name }))], s.state)}
          </div>
        </div>

        <div>
          <div class="group-label">Schuljahr ${y.label}</div>
          <div class="group">
            <div class="cell"><label for="st-ys">Beginn</label><input type="date" id="st-ys" data-key="yearStart" value="${y.start}"></div>
            <div class="cell"><label for="st-hs">2. Halbjahr ab</label><input type="date" id="st-hs" data-key="halfStart" value="${y.half}"></div>
          </div>
          <div class="group-foot">Danach richten sich die Halbjahres-Schnitte und die Fehltage.</div>
        </div>

        <div>
          <div class="group-label">Ferien & Feiertage</div>
          <div class="group">
            <div class="cell"><span class="cell-icon accent2">${icon('palm')}</span><span class="grow">${s.state ? stateName(s.state) : 'Kein Bundesland gewählt'}<span class="sub">${hs.count && hs.state === s.state ? `${hs.count} Einträge · Stand ${fmtFull(String(hs.fetchedAt).slice(0, 10))}` : s.state ? (hs.error ? 'Konnte nicht geladen werden' : 'Noch nicht geladen') : 'Wähle oben dein Bundesland'}</span></span>${s.state ? html`<button class="text-btn small" data-act="holidays">${icon('refresh')} Laden</button>` : ''}</div>
            ${hol.map((h) => html`<div class="cell"><span class="grow">${h.name}</span><span class="value">${fmtRange(h.start, h.end)}</span></div>`)}
          </div>
          <div class="group-foot">Quelle: OpenHolidays API. Gesendet wird nur das Bundesland. Eigene freie Tage trägst du im Kalender als Termin „Unterrichtsfrei“ ein.</div>
        </div>

        <div>
          <div class="group-label">Noten</div>
          <div class="group">
            ${selectCell('st-tend', 'Plus/Minus zählt', TENDENCIES.map((t) => ({ value: t.value, label: `${t.label} (${t.hint})` })), TENDENCIES.find((t) => Math.abs(t.value - s.tendency) < 0.01)?.value ?? 0.25)}
            ${toggleCell('st-main', 'Hauptfächer doppelt', s.mainDouble, 'Im Gesamtschnitt zählen Hauptfächer zweifach')}
          </div>
        </div>

        <div>
          <div class="group-label">Lernen & Kalender</div>
          <div class="group">
            ${selectCell('st-pensum', 'Lernpensum', Object.entries(PENSUM).map(([k, p]) => ({ value: k, label: `${p.label} (${p.sub})` })), s.pensum)}
            ${selectCell('st-rem', 'Erinnerung', REMINDER_OPTIONS.map((r) => ({ value: r.key, label: r.label })), s.reminder)}
            ${selectCell('st-excuse', 'Entschuldigung', [1, 2, 3, 4, 5, 7, 10].map((n) => ({ value: n, label: `innerhalb von ${n} Schultag${n === 1 ? '' : 'en'}` })), s.excuseDays)}
          </div>
          <div class="group-foot">Die Erinnerung gilt für Tests, die du in den iPhone-Kalender übernimmst.</div>
        </div>

        <div>
          <div class="group-label">Darstellung</div>
          <div class="seg" id="theme-seg" style="margin-bottom:10px">
            ${[['system', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, l]) => html`<button class="${theme === k ? 'active' : ''}" data-theme="${k}">${l}</button>`)}
          </div>
          <div class="palette-grid">
            ${Object.entries(PALETTES).map(([k, p]) => html`<button class="palette ${pal === k ? 'active' : ''}" data-palette="${k}"><span class="sw" style="--a:${p[mode].swatch[0]};--b:${p[mode].swatch[1]}"></span><span>${p.name}</span></button>`)}
          </div>
        </div>

        <div>
          <div class="group-label">Synchronisation</div>
          ${syncHtml}
        </div>

        <div>
          <div class="group-label">Backup</div>
          <div class="group">
            <button class="cell link" data-act="export"><span class="cell-icon">${icon('download')}</span><span class="grow">Backup exportieren</span><span class="chev">${icon('chevron')}</span></button>
            <button class="cell link" data-act="import"><span class="cell-icon">${icon('upload')}</span><span class="grow">Backup importieren</span><span class="chev">${icon('chevron')}</span></button>
          </div>
          <input type="file" id="imp" accept="application/json,.json" hidden>
          <div class="group-foot">Sicherung als Datei, z. B. in „Dateien“ oder iCloud Drive.</div>
        </div>

        <div>
          <div class="group-label">App</div>
          <div class="group">
            <div class="cell"><span class="grow">Version</span><span class="value">${APP_VERSION}</span></div>
            <button class="cell link danger-row" data-act="wipe"><span class="grow">Alle Daten auf diesem Gerät löschen</span></button>
          </div>
        </div>
      </div>
    </div>`);

  const saveField = async (patch) => { await saveSettings(patch); };

  const onChange = async (e) => {
    const t = e.target;
    if (t.dataset.key && t.type !== 'date') { await saveField({ [t.dataset.key]: t.value.trim() }); return; }
    if (t.type === 'date' && t.dataset.key) { if (t.value) await saveField({ [t.dataset.key]: t.value }); return; }
    switch (t.id) {
      case 'st-state': await saveField({ state: t.value }); if (t.value) refreshHolidays({ force: true }).then((r) => { if (!r.ok && r.reason !== 'nostate') toast('Ferien konnten nicht geladen werden', { icon: 'info' }); }); break;
      case 'st-tend': await saveField({ tendency: Number(t.value) }); break;
      case 'st-main': await saveField({ mainDouble: t.checked }); break;
      case 'st-pensum': await saveField({ pensum: t.value }); break;
      case 'st-rem': await saveField({ reminder: t.value }); break;
      case 'st-excuse': await saveField({ excuseDays: Number(t.value) }); break;
      case 'imp': if (t.files?.[0]) { const f = t.files[0]; t.value = ''; importBackup(f); } break;
    }
  };
  const onSubmit = async (e) => {
    if (e.target.id !== 'login') return;
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await login(el.querySelector('#le').value, el.querySelector('#lp').value);
      toast('Angemeldet', { icon: 'check' });
      refresh();
    } catch (err) {
      toast(err.message, { icon: 'info', duration: 4000 });
      btn.disabled = false;
    }
  };
  const onClick = async (e) => {
    const th = e.target.closest('[data-theme]');
    if (th) { setThemePref(th.dataset.theme); refresh(); return; }
    const pa = e.target.closest('[data-palette]');
    if (pa) { setPalette(pa.dataset.palette); refresh(); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    switch (a.dataset.act) {
      case 'holidays': {
        a.disabled = true;
        const r = await refreshHolidays({ force: true });
        toast(r.ok ? `${r.count} Ferientage und Feiertage geladen` : 'Ferien konnten nicht geladen werden', { icon: r.ok ? 'check' : 'info' });
        refresh();
        break;
      }
      case 'creds': credsSheet(); break;
      case 'sync': syncNow(); break;
      case 'logout': if (await confirmDialog({ title: 'Abmelden?', message: 'Die Daten bleiben auf diesem Gerät.', ok: 'Abmelden' })) { await logout(); refresh(); } break;
      case 'export': exportBackup(); break;
      case 'import': el.querySelector('#imp').click(); break;
      case 'wipe': {
        const ok = await confirmDialog({ title: 'Alles löschen?', message: 'Alle Fächer, Noten, Aufgaben und Einstellungen auf diesem Gerät werden gelöscht. Mit Sync bleiben die Daten in der Cloud erhalten.', ok: 'Alles löschen', danger: true });
        if (!ok) return;
        await logout().catch(() => {});
        await wipeAll();
        try { Object.keys(localStorage).filter((k) => k.startsWith('sp-')).forEach((k) => localStorage.removeItem(k)); } catch {}
        location.hash = '';
        location.reload();
        break;
      }
    }
  };
  el.addEventListener('change', onChange);
  el.addEventListener('submit', onSubmit);
  el.addEventListener('click', onClick);
  const offStatus = onStatus((st) => { const n = el.querySelector('#sync-status'); if (n) n.innerHTML = String(statusPill(st)); });
  return () => {
    el.removeEventListener('change', onChange);
    el.removeEventListener('submit', onSubmit);
    el.removeEventListener('click', onClick);
    offStatus();
  };
}
