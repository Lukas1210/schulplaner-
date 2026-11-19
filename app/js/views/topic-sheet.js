// „Wie sitzt das Thema jetzt?“ – Ampel setzen und als heute gelernt markieren.
import { html } from '../ui/dom.js';
import { get, update } from '../store.js';
import { openSheet, toast } from '../ui/sheet.js';
import { amp } from '../ui/components.js';
import { LEVELS, subjectById, examKind } from '../model.js';
import { today, relDay } from '../logic/dates.js';
import { burstAt } from '../ui/fx.js';

/** Thema in einem Test ändern. patch: { level?, studied?: true|false } */
export async function setTopic(examId, topicId, { level, studied } = {}) {
  const ex = get(examId);
  if (!ex) return;
  const t = today();
  const topics = (ex.data.topics || []).map((x) => {
    if (x.id !== topicId) return x;
    const next = { ...x };
    if (level != null) next.level = level;
    const days = new Set(x.studied || []);
    if (studied === true) days.add(t);
    if (studied === false) days.delete(t);
    next.studied = [...days].sort().slice(-30);
    return next;
  });
  await update(examId, { topics });
}

export function openTopicSheet(examId, topicId) {
  const ex = get(examId);
  const topic = ex?.data.topics?.find((x) => x.id === topicId);
  if (!topic) return;
  const s = subjectById(ex.data.subjectId);
  const studiedToday = (topic.studied || []).includes(today());
  const where = ex.data.date ? `${examKind(ex.data.kind).label} ${relDay(ex.data.date, today())}` : 'Lernziel';
  const sheet = openSheet({
    title: 'Thema lernen',
    body: html`
      <div class="card" style="margin-bottom:16px">
        <div class="kicker">${s?.data.name || ''} · ${where}</div>
        <div style="font-family:var(--font-round);font-size:21px;font-weight:800;margin-top:6px;line-height:1.2">${topic.text}</div>
      </div>
      <div class="group-label">Wie sitzt es jetzt?</div>
      <div class="amp-pick">
        ${LEVELS.map((l) => html`<button data-level="${l.level}" class="${topic.level === l.level ? 'active' : ''}">${amp(l.level)}<span>${l.label}</span></button>`)}
      </div>
      <div class="group-foot" style="margin-top:10px">Deine Antwort zählt als „heute gelernt“. Der Lernplan verteilt die übrigen Themen neu.</div>
      ${studiedToday ? html`<button class="btn block" data-act="undo" style="margin-top:18px">Doch nicht gelernt</button>` : ''}`,
  });
  sheet.body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-level]');
    if (b) {
      const level = Number(b.dataset.level);
      if (level === 2) burstAt(b, 12);
      await setTopic(examId, topicId, { level, studied: true });
      toast(level === 2 ? 'Sitzt – super!' : 'Gemerkt, kommt wieder dran', { icon: level === 2 ? 'check' : 'repeat' });
      sheet.close();
      return;
    }
    if (e.target.closest('[data-act="undo"]')) {
      await setTopic(examId, topicId, { studied: false });
      sheet.close();
    }
  });
}
