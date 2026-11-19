// Linien-Icons (24×24) im iOS-Stil.
import { raw } from './dom.js';

const P = {
  // Navigation
  today: '<circle cx="12" cy="13" r="4"/><path d="M12 3.5v2M4.6 6.6l1.4 1.4M19.4 6.6L18 8M2.5 17.5h19M6.5 20.5h11"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  tasks: '<rect x="3.5" y="4" width="17" height="16.5" rx="3.5"/><path d="M7.5 9.5l1.6 1.6 3-3M7.5 15.5l1.6 1.6 3-3M14.5 10h3M14.5 16h3"/>',
  learn: '<path d="M9.5 18h5M10.3 21h3.4"/><path d="M12 3a6 6 0 00-3.5 10.9c.7.5 1.1 1.3 1.1 2.1h4.8c0-.8.4-1.6 1.1-2.1A6 6 0 0012 3z"/>',
  grades: '<circle cx="12" cy="9" r="5.5"/><path d="M8.7 13.4L7.2 21l4.8-2.5 4.8 2.5-1.5-7.6"/><path d="M10.2 9.2l1.3 1.3 2.6-2.8"/>',
  book: '<path d="M5 5.5A2.5 2.5 0 017.5 3H19v14.5H7.5A2.5 2.5 0 005 20z"/><path d="M5 20a2 2 0 002 1.5h12v-4"/><path d="M9 7.5h6"/>',
  grid: '<rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="M3.5 9.5h17M3.5 14.8h17M9.2 4v16M14.8 4v16"/>',
  thermo: '<path d="M10 14.3V5a2 2 0 014 0v9.3a4 4 0 11-4 0z"/><path d="M12 9v7.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5"/>',
  more: '<circle cx="5.5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor"/>',
  cap: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.6V16c1.5 1.3 3.5 2 5.5 2s4-.7 5.5-2v-4.4M21.5 9.5v5"/>',
  cards: '<rect x="8" y="3.5" width="10.5" height="15" rx="2.5" transform="rotate(9 13.25 11)"/><path d="M13 7.6l-6.7-1.1a2.5 2.5 0 00-2.9 2.1L2.3 15a2.5 2.5 0 002 2.9l5.9 1"/>',
  // Aktionen
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronUp: '<path d="M6 15l6-6 6 6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  brush: '<path d="M18.4 2.8a2 2 0 012.8 2.8L12.3 14.5 9.5 11.7z"/><path d="M8.6 12.9c-2 0-3.6 1.6-3.6 3.6 0 1.3-.7 2.2-2 2.9 4.6.5 8.2-1 8.2-4.3"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  share: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M7 10.5H5.5v10h13v-10H17"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M5 19.5h14"/>',
  cloud: '<path d="M7 18.5h10.5a4 4 0 00.5-8 6 6 0 00-11.6 1.6A3.3 3.3 0 007 18.5z"/>',
  refresh: '<path d="M20 11.5A8 8 0 006.3 6.3L4 8.5M4 4v4.5h4.5M4 12.5a8 8 0 0013.7 5.2L20 15.5M20 20v-4.5h-4.5"/>',
  rotate: '<path d="M19.5 12a7.5 7.5 0 11-2.2-5.3M19.5 4v4h-4"/>',
  shuffle: '<path d="M3.5 7h3.5c4.5 0 5.5 10 10 10h3.5M17.5 14l3 3-3 3M3.5 17H7c1.5 0 2.6-1.1 3.4-2.6M13.6 9.6C14.4 8.1 15.5 7 17 7h3.5M17.5 4l3 3-3 3"/>',
  repeat: '<path d="M4.5 11V9.5a3 3 0 013-3H19M16 3.5l3 3-3 3M19.5 13v1.5a3 3 0 01-3 3H5M8 20.5l-3-3 3-3"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  grip: '<path d="M9 6.5h.01M15 6.5h.01M9 12h.01M15 12h.01M9 17.5h.01M15 17.5h.01" stroke-width="3"/>',
  calendarPlus: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/>',
  logout: '<path d="M14 4.5h3.5a2 2 0 012 2v11a2 2 0 01-2 2H14M10 16.5L5.5 12 10 7.5M5.5 12H16"/>',
  // Inhalt
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  alert: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.5M12 17.3v.2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0113 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  target: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.8a4 4 0 018 0v2.7"/>',
  flag: '<path d="M5.5 21V4M5.5 4.5h11l-2.2 4 2.2 4h-11"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  palm: '<path d="M12 21v-9M7 21h10"/><path d="M12 12c-1.6-3.4-5-4.4-8-3 2.6.2 4.6 1.5 5.5 3M12 12c1.6-3.4 5-4.4 8-3-2.6.2-4.6 1.5-5.5 3M12 12c0-3.2-1.6-6.2-4.7-7.6 1 1.8 1.6 3.6 1.6 5.1M12 12c0-3.2 1.6-6.2 4.7-7.6-1 1.8-1.6 3.6-1.6 5.1"/>',
  note: '<path d="M7 3.5h7l4 4V19a1.5 1.5 0 01-1.5 1.5H7A1.5 1.5 0 015.5 19V5A1.5 1.5 0 017 3.5z"/><path d="M14 3.5v4h4M9 12h6M9 16h4"/>',
  sparkles: '<path d="M10 3.5l1.6 4.6 4.6 1.6-4.6 1.6L10 16l-1.6-4.7-4.6-1.6 4.6-1.6z"/><path d="M18 13.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.3 2.4-5.3 3.6-7.8.4 1.6 1.3 2.7 2.4 3.2 0-2.9 1.3-5.4 3.6-6.7-.3 2.6.6 4.5 2.1 6.2 1.2 1.4 1.8 3 1.8 5 0 3.7-2.9 6.3-7 6.3z"/>',
  trend: '<path d="M3.5 17l5.5-5.5 4 4 7.5-7.5"/><path d="M15 8h5.5v5.5"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="17.5" r="1.2" fill="currentColor"/>',
  people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2"/><circle cx="17" cy="9.5" r="2.5"/><path d="M15.8 14.4c2.6.2 4.4 1.9 5 4.6"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  bolt: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
  // Ampel (zusätzlich zur Farbe eine Form)
  ampRed: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5.5M12 16.3v.2"/>',
  ampYellow: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 010 17z" fill="currentColor" stroke="none"/>',
  ampGreen: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.8 2.8 5.2-5.6"/>',
};

export function icon(name, cls = 'i') {
  return raw(`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`);
}

export const iconStr = (name, cls) => String(icon(name, cls));
export const hasIcon = (name) => !!P[name];
