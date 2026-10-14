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

export type PlanChange = {
  sessionId: string;
  day: string;
  time: string;
  title: string;
  detail: string;
  status: string;
};

export type PlanProposal = {
  impact: string;
  changes: PlanChange[];
};

export const initialWeek: Session[] = [
  { id: 'mon', day: 'Monday', shortDay: 'MON', sport: 'Strength', title: 'Full-body strength', detail: '45 min · moderate', time: '6:30 PM', status: 'done' },
  { id: 'tue', day: 'Tuesday', shortDay: 'TUE', sport: 'Run', title: 'Easy run', detail: '35 min · conversational', time: '7:00 AM', status: 'planned' },
  { id: 'wed', day: 'Wednesday', shortDay: 'WED', sport: 'Soccer', title: 'Club training', detail: '75 min · variable', time: '7:15 PM', status: 'planned' },
  { id: 'thu', day: 'Thursday', shortDay: 'THU', sport: 'Run', title: 'Steady run', detail: '40 min · controlled', time: '6:45 AM', status: 'planned' },
  { id: 'fri', day: 'Friday', shortDay: 'FRI', sport: 'Strength', title: 'Strength + mobility', detail: '40 min · moderate', time: '5:30 PM', status: 'planned' },
  { id: 'sat', day: 'Saturday', shortDay: 'SAT', sport: 'Run', title: 'Long easy run', detail: '60 min · relaxed', time: '9:00 AM', status: 'planned' },
  { id: 'sun', day: 'Sunday', shortDay: 'SUN', sport: 'Run', title: 'Recovery buffer', detail: 'Unplanned space', time: 'Open', status: 'rest' },
];

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const editableStatuses = ['planned', 'moved', 'missed', 'rest'];

export function isPlanProposal(value: unknown): value is PlanProposal {
  if (!value || typeof value !== 'object') return false;
  const proposal = value as Record<string, unknown>;
  if (typeof proposal.impact !== 'string' || proposal.impact.length > 700) return false;
  if (!Array.isArray(proposal.changes) || proposal.changes.length < 1 || proposal.changes.length > 3) return false;
  return proposal.changes.every((rawChange) => {
    if (!rawChange || typeof rawChange !== 'object') return false;
    const change = rawChange as Record<string, unknown>;
    return typeof change.sessionId === 'string'
      && typeof change.day === 'string'
      && days.includes(change.day)
      && typeof change.time === 'string'
      && change.time.length <= 40
      && typeof change.title === 'string'
      && change.title.length <= 80
      && typeof change.detail === 'string'
      && change.detail.length <= 120
      && typeof change.status === 'string'
      && editableStatuses.includes(change.status);
  });
}

export function applyPlanProposal(sessions: Session[], value: unknown): Session[] | null {
  if (!isPlanProposal(value)) return null;
  const proposal = value;
  const ids = new Set(proposal.changes.map((change) => change.sessionId));
  if (ids.size !== proposal.changes.length) return null;

  const updated = sessions.map((session) => {
    const change = proposal.changes.find((item) => item.sessionId === session.id);
    if (!change) return session;
    if (session.status === 'done') return null;
    return {
      ...session,
      day: change.day,
      shortDay: change.day.slice(0, 3).toUpperCase(),
      time: change.time,
      title: change.title,
      detail: change.detail,
      status: change.status as Session['status'],
    };
  });
  if (updated.some((session) => session === null)) return null;

  const nextWeek = updated as Session[];
  const activeRunFieldDays = nextWeek
    .filter((session) => ['Run', 'Soccer'].includes(session.sport) && !['missed', 'rest'].includes(session.status))
    .map((session) => session.day);
  if (activeRunFieldDays.length > 5 || new Set(activeRunFieldDays).size !== activeRunFieldDays.length) return null;
  if (proposal.changes.some((change) => !sessions.some((session) => session.id === change.sessionId))) return null;

  return nextWeek;
}
