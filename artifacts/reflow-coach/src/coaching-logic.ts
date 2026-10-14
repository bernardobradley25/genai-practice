export type Session = {
  id: string;
  day: string;
  shortDay: string;
  sport: 'Run' | 'Soccer' | 'Strength';
  title: string;
  detail: string;
  time: string;
  status: 'planned' | 'done' | 'moved' | 'missed' | 'rest';
};

export type CaseType = 'missed' | 'soccer' | 'makeup' | 'unknown';

export const initialWeek: Session[] = [
  { id: 'mon', day: 'Monday', shortDay: 'MON', sport: 'Strength', title: 'Full-body strength', detail: '45 min · moderate', time: '6:30 PM', status: 'done' },
  { id: 'tue', day: 'Tuesday', shortDay: 'TUE', sport: 'Run', title: 'Easy run', detail: '35 min · conversational', time: '7:00 AM', status: 'planned' },
  { id: 'wed', day: 'Wednesday', shortDay: 'WED', sport: 'Soccer', title: 'Club training', detail: '75 min · variable', time: '7:15 PM', status: 'planned' },
  { id: 'thu', day: 'Thursday', shortDay: 'THU', sport: 'Run', title: 'Steady run', detail: '40 min · controlled', time: '6:45 AM', status: 'planned' },
  { id: 'fri', day: 'Friday', shortDay: 'FRI', sport: 'Strength', title: 'Strength + mobility', detail: '40 min · moderate', time: '5:30 PM', status: 'planned' },
  { id: 'sat', day: 'Saturday', shortDay: 'SAT', sport: 'Run', title: 'Long easy run', detail: '60 min · relaxed', time: '9:00 AM', status: 'planned' },
  { id: 'sun', day: 'Sunday', shortDay: 'SUN', sport: 'Run', title: 'Recovery buffer', detail: 'Unplanned space', time: 'Open', status: 'rest' },
];

export function classifyRequest(value: string): CaseType | 'empty' {
  if (!value.trim()) return 'empty';
  const text = value.toLowerCase();
  if (/(make up|make-up|every missed|all missed|missed two|missed all)/.test(text)) return 'makeup';
  if (/(soccer|football|club training|game replaced|match replaced)/.test(text)) return 'soccer';
  if (/(missed|skip|couldn't|could not|free recovery|move.*run|easy run)/.test(text)) return 'missed';
  return 'unknown';
}

export function validateSoccerDetails(duration: string, intensity: string): string | null {
  const minutes = Number(duration);
  if (!duration || !Number.isFinite(minutes) || minutes < 1 || minutes > 240) {
    return 'Please enter time on the field between 1 and 240 minutes.';
  }
  if (!intensity) return 'Please choose how hard it felt overall.';
  return null;
}

export function applyMissedRunMove(sessions: Session[]): Session[] {
  return sessions.map((session) => session.id === 'tue'
    ? { ...session, status: 'missed', detail: 'Moved to Thu · 6:30 PM', time: 'Not completed' }
    : session.id === 'thu'
      ? { ...session, status: 'moved', title: 'Easy run (moved)', detail: '35 min · conversational', time: '6:30 PM' }
      : session);
}
