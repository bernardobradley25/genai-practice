export type Session = {
  id: string;
  day: string;
  shortDay: string;
  sport: 'Run' | 'Soccer' | 'Surf' | 'Swim' | 'Strength';
  title: string;
  detail: string;
  time: string;
  status: 'planned' | 'done' | 'moved' | 'missed' | 'rest';
};

export type PlanChange = {
  sessionId: string;
  sport: Session['sport'];
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

export const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const editableStatuses = ['planned', 'moved', 'missed', 'rest', 'done'];

export function summarizeWeek(sessions: Session[]) {
  const active = sessions.filter((session) => !['missed', 'rest'].includes(session.status));
  const sportDays = days.filter((day) => active.some((session) => session.day === day && session.sport !== 'Strength'));
  return { sportDays, dayCount: sportDays.length,
    runCount: active.filter((session) => session.sport === 'Run').length,
    soccerCount: active.filter((session) => session.sport === 'Soccer').length,
    surfCount: active.filter((session) => session.sport === 'Surf').length,
    swimCount: active.filter((session) => session.sport === 'Swim').length,
    strengthCount: active.filter((session) => session.sport === 'Strength').length,
  };
}

export function groupWeekByDay(sessions: Session[]) {
  return days.map((day) => ({ day, sessions: sessions.filter((session) => session.day === day)
    .sort((a, b) => (parseStartTime(a.time) ?? 1440) - (parseStartTime(b.time) ?? 1440)) }));
}

/** Compact proposal context fits alongside a reply within the API's message limit. */
export function proposalHistory(proposal: PlanProposal, state: string): string {
  return `Proposal status: ${state}. Changes: ${proposal.changes.map((change) =>
    `${change.sessionId}: ${change.day} ${change.time}, ${change.sport}, ${change.title}, ${change.detail.slice(0, 90)}, ${change.status}`,
  ).join('; ')}`;
}

export function isPlanProposal(value: unknown): value is PlanProposal {
  if (!value || typeof value !== 'object') return false;
  const proposal = value as Record<string, unknown>;
  if (typeof proposal.impact !== 'string' || !proposal.impact.trim() || proposal.impact.length > 700) return false;
  if (!Array.isArray(proposal.changes) || proposal.changes.length < 1 || proposal.changes.length > 7) return false;
  return proposal.changes.every((rawChange) => {
    if (!rawChange || typeof rawChange !== 'object') return false;
    const change = rawChange as Record<string, unknown>;
    return typeof change.sessionId === 'string'
      && typeof change.sport === 'string'
      && ['Run', 'Soccer', 'Surf', 'Swim', 'Strength'].includes(change.sport)
      && typeof change.day === 'string'
      && days.includes(change.day)
      && typeof change.time === 'string'
      && change.time.length <= 40
      && typeof change.title === 'string'
      && Boolean(change.title.trim())
      && change.title.length <= 80
      && typeof change.detail === 'string'
      && change.detail.length <= 300
      && typeof change.status === 'string'
      && editableStatuses.includes(change.status);
  });
}

/** Accept an explicit 12-hour clock time or 24-hour HH:mm. */
export function parseStartTime(value: string): number | null {
  const text = value.trim();
  const twelve = /^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i.exec(text);
  if (twelve) return (Number(twelve[1]) % 12 + (twelve[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(twelve[2]);
  const twentyFour = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text);
  return twentyFour ? Number(twentyFour[1]) * 60 + Number(twentyFour[2]) : null;
}

/** Existing session details use minutes; reserve the upper end of a range. */
export function parseDuration(value: string): number | null {
  const match = /^(\d+)(?:\s*[-–—]\s*(\d+))?\s*min(?:utes)?\b/i.exec(value.trim());
  if (!match) return null;
  const low = Number(match[1]);
  const high = Number(match[2] ?? match[1]);
  return low > 0 && high >= low && high <= 1440 ? high : null;
}

export type PlanValidation =
  | { ok: true; week: Session[]; proposal: PlanProposal }
  | { ok: false; error: string };

export function validatePlanProposal(sessions: Session[], value: unknown): PlanValidation {
  const reject = (error: string): PlanValidation => ({ ok: false, error });
  if (!isPlanProposal(value)) return reject('The proposed change is incomplete. Ask for a specific session, day, time, and duration.');
  const ids = new Set(value.changes.map((change) => change.sessionId));
  if (ids.size !== value.changes.length) return reject('The proposal changes the same session twice. Ask for one clear change per session.');
  for (const change of value.changes) {
    const original = sessions.find((session) => session.id === change.sessionId);
    if (!original) return reject('The proposal refers to a session that is not in this week.');
    if (original.status === 'done') return reject(`${original.title} is already completed and cannot be changed.`);
  }
  const nextWeek = sessions.map((session): Session => {
    const change = value.changes.find((item) => item.sessionId === session.id);
    if (!change) return { ...session };
    const { sessionId: _sessionId, ...fields } = change;
    return { ...session, ...fields, status: change.status as Session['status'], shortDay: change.day.slice(0, 3).toUpperCase() };
  });
  const active = nextWeek.filter((session) => !['missed', 'rest'].includes(session.status));
  const intervals: Array<{ session: Session; start: number; end: number }> = [];
  for (const session of active) {
    const start = parseStartTime(session.time);
    if (start === null) return reject(`${session.title} on ${session.day} needs a valid start time, such as 6:30 PM.`);
    const duration = parseDuration(session.detail);
    if (duration === null) return reject(`${session.title} on ${session.day} needs a positive duration in minutes, such as 35 min.`);
    if (start + duration > 1440) return reject(`${session.title} runs past midnight. Choose a time and duration within the same day.`);
    intervals.push({ session, start, end: start + duration });
  }
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const a = intervals[i], b = intervals[j];
      if (a.session.day === b.session.day && a.start < b.end && b.start < a.end) {
        return reject(`${a.session.title} and ${b.session.title} overlap on ${a.session.day}. Choose separate times before applying this plan.`);
      }
    }
  }
  const sportDays = active.filter((session) => session.sport !== 'Strength').map((session) => session.day);
  if (new Set(sportDays).size > 5) return reject('This plan exceeds the five run/sport-day limit. Shorten the week before applying it.');
  if (new Set(sportDays).size !== sportDays.length) return reject('This prototype allows one run/sport session per day. Replace or move the other session first.');
  return { ok: true, week: nextWeek, proposal: value };
}

export function applyPlanProposal(sessions: Session[], value: unknown): Session[] | null {
  const result = validatePlanProposal(sessions, value);
  return result.ok ? result.week : null;
}

export function isSameWeek(a: Session[], b: Session[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}


/** Validate the entire supplied stateless demo, not only newly proposed edits. */
export function validateCurrentWeek(sessions: Session[]): string | null {
  if (sessions.length !== initialWeek.length || new Set(sessions.map(s => s.id)).size !== initialWeek.length
    || sessions.some(s => !initialWeek.some(original => original.id === s.id))) return 'The sample week needs all seven session slots.';
  for (const session of sessions) {
    if (!session.title.trim() || !days.includes(session.day) || session.shortDay !== session.day.slice(0, 3).toUpperCase()) return 'A session has an invalid title or weekday label.';
  }
  // Reuse every interval/cap rule without modifying the input or completed records.
  const probe = sessions.find(s => s.status !== 'done');
  const source = probe ? sessions : sessions.map((s, i) => i === 0 ? { ...s, status: 'planned' as const } : s);
  const target = probe ?? source[0];
  const { id, shortDay: _shortDay, ...change } = target;
  const result = validatePlanProposal(source, { impact: 'Validate current week', changes: [{ ...change, sessionId: id }] });
  return result.ok ? null : result.error;
}
