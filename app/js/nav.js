// Navigation: Tabs (iPhone) bzw. Hauptbereiche der Seitenleiste (iPad) und „Mehr“-Bereiche.
export const TABS = [
  { tab: 'today', path: '/', label: 'Heute', icon: 'today' },
  { tab: 'calendar', path: '/calendar', label: 'Kalender', icon: 'calendar' },
  { tab: 'tasks', path: '/tasks', label: 'Aufgaben', icon: 'tasks' },
  { tab: 'learn', path: '/learn', label: 'Lernen', icon: 'learn' },
  { tab: 'grades', path: '/grades', label: 'Noten', icon: 'grades' },
];

export const MORE = [
  { side: 'subjects', path: '/subjects', label: 'Fächer', icon: 'book' },
  { side: 'timetable', path: '/timetable', label: 'Stundenplan', icon: 'grid' },
  { side: 'absences', path: '/absences', label: 'Fehltage', icon: 'thermo' },
  { side: 'settings', path: '/settings', label: 'Einstellungen', icon: 'settings' },
];
