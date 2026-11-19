// Test-Seite: Countdown, Lernstoff mit Ampel, Lernplan-Hinweis, Kalender-Export, Note.
import { html } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { get, update, shortId, settings } from '../store.js';
import { go, refresh } from '../router.js';
import { topbar, subjBadge, emptyState, amp, ampBar, ampLegend } from '../ui/components.js';
import { toast } from '../ui/sheet.js';
import { subjectById, examKind, examData, timetableCtx } from '../model.js';
import { periodsOf, schoolDaysBetween } from '../logic/timetable.js';
import { examProgress, todayPlan, PENSUM, studiedOn } from '../logic/plan.js';
import { today, fmtLong, relDay, daysBetween } from '../logic/dates.js';
import { labelFor } from '../logic/grades.js';
import { openTopicSheet } from './topic-sheet.js';
import { burstAt } from '../ui/fx.js';

export const live = true;
const state = { editing: false };

function topicRows(ex, t) {
  const topics = ex.data.topics || [];
  if (!topics.length) return '';
  return html`<div class="todo-group">${topics.map((tp, i) => state.editing
    ? html`<div class="topic"><span class="amp-btn">${amp(tp.level)}</span><input class="t-text" data-edit-topic="${tp.id}" value="${tp.text}" aria-label="Thema ${i + 1}" style="border:0;outline:none;background:transparent;font-size:16px"><button class="icon-btn" data-up-topic="${tp.id}" aria-label="Nach oben" ${i === 0 ? 'disabled' : ''}>${icon('chevronUp')}</button><button class="icon-btn" data-del-topic="${tp.id}" aria-label="Thema löschen" style="color:var(--danger)">${icon('trash')}</button></div>`
    : html`<div class="topic ${studiedOn(tp, t) ? 'done' : ''}">
        <button class="amp-btn" data-cycle="${tp.id}" aria-label="Ampel weiterschalten (jetzt ${['rot', 'gelb', 'grün'][tp.level || 0]})">${amp(tp.level)}</button>
        <button class="t-text" data-learn="${tp.id}"><span>${tp.text}</span>${studiedOn(tp, t) ? html`<span class="t-sub">heute gelernt</span>` : ''}</button>
      </div>`)}</div>`;
}

export function render(el, { id }) {
  const ex = get(id);
  if (!ex || ex.type !== 'exam') {
    el.innerHTML = String(html`${topbar({ back: true })}<div class="page">${emptyState({ icon: 'learn', title: 'Nicht gefunden', text: 'Dieser Test wurde gelöscht.' })}</div>`);
    return;
  }
  const d = ex.data;
  const t = today();
  const s = subjectById(d.subjectId);
  const kind = examKind(d.kind);
  const p = examProgress(d);
  const ctx = timetableCtx();
  const per = d.period ? periodsOf(ctx.settings)[d.period - 1] : null;
  const n = d.date ? daysBetween(t, d.date) : null;
  const grade = d.gradeId ? get(d.gradeId) : null;
  const plan = d.date && n > 0 ? todayPlan({ exams: [examData(ex)], today: t, cap: (PENSUM[settings().pensum] || PENSUM.normal).cap }) : null;
  const todayTopics = plan ? plan.items.filter((i) => !i.done).map((i) => d.topics.find((x) => x.id === i.topicId)?.text).filter(Boolean) : [];
  const schoolDaysLeft = d.date && n > 0 ? schoolDaysBetween(t, d.date, ctx) : null;

  el.innerHTML = String(html`
    ${topbar({ title: kind.label, back: true, fallback: '/learn', right: html`<button class="text-btn" data-act="edit">Bearbeiten</button>` })}
    <div class="page">
      <div class="detail-head">${subjBadge(s, { size: 'lg' })}<div class="grow"><h1>${kind.label}${d.title ? `: ${d.title}` : ''}</h1>
        <div class="dh-sub">${s ? s.data.name : 'Ohne Fach'}${d.date ? ` · ${fmtLong(d.date)}` : ' · ohne Termin'}${per ? ` · ${d.period}. Stunde (${per.start})` : ''}</div></div></div>
      ${d.date ? html`<div class="fact-row">
        <div class="fact"><div class="k">${n < 0 ? 'Vorbei' : 'Noch'}</div><div class="v">${n === 0 ? 'Heute!' : n > 0 ? `${n} ${n === 1 ? 'Tag' : 'Tage'}` : relDay(d.date, t)}</div></div>
        ${schoolDaysLeft != null ? html`<div class="fact"><div class="k">Schultage</div><div class="v">${schoolDaysLeft}</div></div>` : ''}
        <div class="fact"><div class="k">Lernstoff</div><div class="v">${p.total ? `${p.green}/${p.total} sitzen` : '–'}</div></div>
        ${grade ? html`<button class="fact" data-grade="${grade.id}" style="text-align:left"><div class="k">Note</div><div class="v">${grade.data.label || labelFor(grade.data.value, settings().tendency)}</div></button>` : ''}
      </div>` : ''}
      ${n === 0 ? html`<div class="notice accent" style="margin-top:14px">${icon('sparkles')}<span class="grow">Heute ist es so weit – viel Erfolg! Du hast dich vorbereitet.</span></div>` : ''}

      <div class="section">
        <div class="section-head"><h2 class="section-title small">Lernstoff</h2>${p.total ? html`<button class="section-link" data-act="toggle-edit">${state.editing ? 'Fertig' : 'Bearbeiten'}</button>` : ''}</div>
        ${p.total ? html`${ampBar(p)}${ampLegend(p)}<div style="height:12px"></div>` : ''}
        ${topicRows(ex, t)}
        <form class="todo-add" id="add-topic" style="margin-top:10px"><div class="ta-row"><input id="topic-text" placeholder="${p.total ? 'Weiteres Thema …' : 'Erstes Thema, z. B. p-q-Formel'}" autocomplete="off" enterkeyhint="done" aria-label="Neues Thema"><button class="add-btn" type="submit" aria-label="Thema hinzufügen">${icon('plus')}</button></div></form>
        <p class="muted" style="font-size:13px;margin:8px 4px 0">${p.total ? 'Ampel antippen = einschätzen. Thema antippen = lernen und danach einschätzen.' : 'Mehrere Themen auf einmal? Einfach eine Liste einfügen – jede Zeile wird ein Thema.'}</p>
      </div>

      ${todayTopics.length ? html`<div class="section"><div class="notice accent">${icon('learn')}<span class="grow"><b>Heute dran:</b> ${todayTopics.join(', ')}<span class="n-sub">${n === 1 ? 'Morgen ist der Test – danach einmal alles durchgehen.' : 'So schaffst du bis zum Test alles.'}</span></span></div></div>` : ''}
      ${d.notes ? html`<div class="section"><div class="section-head"><h2 class="section-title small">Notizen</h2></div><div class="card notes">${d.notes}</div></div>` : ''}

      <div class="section list">
        ${d.date && n >= 0 ? html`<button class="btn block ghost" data-act="ics">${icon('calendarPlus')} In den iPhone-Kalender</button>` : ''}
        ${kind.gradeKind ? html`<button class="btn block ${n != null && n <= 0 && !grade ? 'primary' : ''}" data-act="grade">${icon('grades')} ${grade ? 'Note ansehen' : 'Note eintragen'}</button>` : ''}
        ${s ? html`<button class="btn block" data-go="/subject/${s.id}">Zur Fach-Seite</button>` : ''}
      </div>
    </div>`);

  const setTopics = (topics) => update(id, { topics });
  const addTopics = async (text) => {
    const lines = text.split(/\r?\n/).map((x) => x.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);
    if (!lines.length) return;
    await setTopics([...(get(id).data.topics || []), ...lines.map((l) => ({ id: shortId(), text: l, level: 0, studied: [] }))]);
    if (lines.length > 1) toast(`${lines.length} Themen hinzugefügt`, { icon: 'check' });
  };

  const onSubmit = async (e) => {
    if (e.target.id !== 'add-topic') return;
    e.preventDefault();
    const inp = el.querySelector('#topic-text');
    const v = inp.value;
    inp.value = '';
    await addTopics(v);
    setTimeout(() => el.querySelector('#topic-text')?.focus(), 200);
  };
  const onPaste = (e) => {
    if (e.target.id !== 'topic-text') return;
    const text = e.clipboardData?.getData('text') || '';
    if (text.includes('\n')) { e.preventDefault(); addTopics(text); }
  };
  const onChange = async (e) => {
    const inp = e.target.closest('[data-edit-topic]');
    if (!inp) return;
    const text = inp.value.trim();
    if (!text) return;
    await setTopics(get(id).data.topics.map((x) => (x.id === inp.dataset.editTopic ? { ...x, text } : x)));
  };
  const onClick = async (e) => {
    const c = e.target.closest('[data-cycle]');
    if (c) {
      const topics = get(id).data.topics.map((x) => (x.id === c.dataset.cycle ? { ...x, level: ((x.level || 0) + 1) % 3 } : x));
      const now = topics.find((x) => x.id === c.dataset.cycle);
      if (now.level === 2) burstAt(c, 10);
      await setTopics(topics);
      return;
    }
    const l = e.target.closest('[data-learn]');
    if (l) { openTopicSheet(id, l.dataset.learn); return; }
    const del = e.target.closest('[data-del-topic]');
    if (del) { await setTopics(get(id).data.topics.filter((x) => x.id !== del.dataset.delTopic)); return; }
    const up = e.target.closest('[data-up-topic]');
    if (up) {
      const topics = [...get(id).data.topics];
      const i = topics.findIndex((x) => x.id === up.dataset.upTopic);
      if (i > 0) { [topics[i - 1], topics[i]] = [topics[i], topics[i - 1]]; await setTopics(topics); }
      return;
    }
    const gr = e.target.closest('[data-grade]');
    if (gr) { (await import('../forms/grade-form.js')).openGradeForm({ id: gr.dataset.grade }); return; }
    const g = e.target.closest('[data-go]');
    if (g) { go(g.dataset.go); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    switch (a.dataset.act) {
      case 'edit': (await import('../forms/exam-form.js')).openExamForm({ id }); break;
      case 'toggle-edit': state.editing = !state.editing; refresh(); break;
      case 'grade': {
        const { openGradeForm } = await import('../forms/grade-form.js');
        if (grade) openGradeForm({ id: grade.id });
        else openGradeForm({ examId: id });
        break;
      }
      case 'ics': (await import('../ics.js')).exportExams([get(id)]); break;
    }
  };
  el.addEventListener('submit', onSubmit);
  el.addEventListener('paste', onPaste);
  el.addEventListener('change', onChange);
  el.addEventListener('click', onClick);
  return () => {
    el.removeEventListener('submit', onSubmit);
    el.removeEventListener('paste', onPaste);
    el.removeEventListener('change', onChange);
    el.removeEventListener('click', onClick);
    state.editing = false;
  };
}

