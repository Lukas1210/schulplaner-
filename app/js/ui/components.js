// Wiederverwendbare UI-Bausteine.
import { html } from './dom.js';
import { icon } from './icons.js';
import { LEVELS } from '../model.js';
import { gradeTone, reportLabel, labelFor, gradeKind } from '../logic/grades.js';

/** Kopfzeile im iOS-Stil (Titel erscheint beim Scrollen). */
export function topbar({ title = '', back = false, backLabel = 'Zurück', fallback = '/', left = '', right = '', alwaysTitle = false, solid = false } = {}) {
  return html`
    <header class="topbar ${alwaysTitle ? 'always-title' : ''} ${solid ? 'solid' : ''}">
      <div class="topbar-left">${back ? html`<button class="back-btn" data-act="back" data-fallback="${fallback}">${icon('back')}<span>${backLabel}</span></button>` : left}</div>
      <div class="topbar-title">${title}</div>
      <div class="topbar-right">${right}</div>
    </header>`;
}

export function emptyState({ icon: ico = 'sparkles', title, text = '', action = '', small = false }) {
  return html`<div class="empty ${small ? 'small' : ''}"><span class="em-ico">${icon(ico)}</span><h3>${title}</h3>${text ? html`<p>${text}</p>` : ''}${action}</div>`;
}

export function sectionHead(title, link = '') {
  return html`<div class="section-head"><h2 class="section-title small">${title}</h2>${link}</div>`;
}

/** Farbiges Fach-Kürzel. */
export function subjBadge(subject, { size = '' } = {}) {
  const d = subject?.data;
  return html`<span class="subj-badge ${size}" style="--c:${d?.color || '#5A6B7B'}" aria-hidden="true">${d?.short || '–'}</span>`;
}
export const subjDot = (subject) => html`<span class="subj-dot" style="--c:${subject?.data?.color || '#5A6B7B'}"></span>`;
export const subjName = (subject) => subject?.data?.name || 'Ohne Fach';

export function icoTile(name, color = 'var(--accent-ink)', { lg = false } = {}) {
  return html`<span class="ico-tile ${lg ? 'lg' : ''}" style="--c:${color}">${icon(name)}</span>`;
}

/** Ampel-Symbol (Farbe + Form). */
export function amp(level, { label = false } = {}) {
  const l = LEVELS[Math.max(0, Math.min(2, level ?? 0))];
  return html`<span class="amp l${l.level}" title="${l.label}">${icon(l.icon)}${label ? html`<span>${l.short}</span>` : ''}<span class="sr-only">${l.label}</span></span>`;
}

/** Fortschrittsbalken rot/gelb/grün. */
export function ampBar(p) {
  if (!p.total) return html`<div class="amp-bar" aria-hidden="true"></div>`;
  const w = (n) => `${(n / p.total) * 100}%`;
  return html`<div class="amp-bar" role="img" aria-label="${p.green} von ${p.total} Themen sitzen, ${p.yellow} unsicher, ${p.red} noch offen">${p.red ? html`<i class="r" style="width:${w(p.red)}"></i>` : ''}${p.yellow ? html`<i class="y" style="width:${w(p.yellow)}"></i>` : ''}${p.green ? html`<i class="g" style="width:${w(p.green)}"></i>` : ''}</div>`;
}

export function ampLegend(p) {
  return html`<div class="amp-legend"><span>${amp(0)} ${p.red} offen</span><span>${amp(1)} ${p.yellow} unsicher</span><span>${amp(2)} ${p.green} sitzen</span></div>`;
}

/** Note als Chip (Wert, Art, Datum). */
export function gradeChip(g, tendency, { meta = '' } = {}) {
  const tone = gradeTone(g.value);
  const kind = gradeKind(g.kind);
  return html`<button class="grade-chip ${tone}" data-grade="${g.id}" aria-label="Note ${g.label || labelFor(g.value, tendency)}, ${kind.label}${meta ? `, ${meta}` : ''}"><b>${g.label || labelFor(g.value, tendency)}</b><small>${meta || kind.short}</small>${g.weight && g.weight !== 1 ? html`<span class="w">×${String(g.weight).replace('.', ',')}</span>` : ''}</button>`;
}

/** Prognose-Chip: voraussichtliche Zeugnisnote. */
export function progChip(rep) {
  if (!rep) return html`<span class="prog" aria-label="noch keine Prognose">–</span>`;
  const tone = gradeTone(rep.grade);
  return html`<span class="prog ${tone} ${rep.alt ? 'wobble' : ''}" aria-label="Zeugnis voraussichtlich ${reportLabel(rep)}${rep.alt ? ', wackelt' : ''}">${reportLabel(rep)}</span>`;
}
