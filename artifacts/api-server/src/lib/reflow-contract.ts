/** Tool availability is permission to stage a review, never permission to apply it. */
export function hasClearReflowIntent(messages: Array<{ role: string; content: string }>): boolean {
  const latest = messages.at(-1);
  if (!latest || latest.role !== 'user') return false;
  const text = latest.content.trim().toLowerCase().replace(/[’‘]/g, "'");
  // Global refusal/uncertainty is read-only. A protected session in a separate
  // clause ("don't change Monday; move Saturday") must not veto the requested edit.
  if (!text || /\b(maybe|perhaps|not sure|what if|i wonder|wait|hold on|not yet|hold off|before i decide|still deciding|not decided|unless)\b/.test(text)
    || /\bno\s+(?:proposal|changes?|edits?)\b/.test(text)
    || /\b(?:do not|don't|never)\s+(?:prepare|stage|reflow)\b/.test(text)) return false;
  const clauses = text.split(/[.;!?\n]|\b(?:and|but|instead)\b/);
  const edit = /\b(?:prepare|stage|reflow|reschedule|apply|make|update|change|move|replace|switch|add|shorten|extend|skip|mark|set|cancel|remove|cambia|cambiar|mueve|prepara|preparar)\b/;
  const direct = clauses.some(clause => !/\b(?:do not|don't|never|not to|no)\b/.test(clause)
    && !/\b(?:what|whether|would|could|should|explore|compare|explain)\b/.test(clause.replace(/\b(?:could|would) you\b/g, ''))
    && edit.test(clause));
  if (direct) return true;

  const previous = messages.slice(0, -1).reverse().find(message => message.role === 'assistant')?.content ?? '';
  // Completing a requested clarification continues the earlier edit intent. It
  // does not promote an earlier hypothetical question into authorization.
  const priorUser = messages.slice(0, -1).findLastIndex(message => message.role === 'user');
  if (/\b(?:time|duration|am|pm|minutes|start)\b/i.test(previous) && previous.includes('?')
    && /\b(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)|(?:[01]\d|2[0-3]):[0-5]\d|\d+\s*min(?:utes)?)\b/i.test(text)
    && priorUser >= 0 && hasClearReflowIntent(messages.slice(0, priorUser + 1))) return true;
  // A specific recommendation is enough context even if the model forgot its closing question.
  const hasPlan = /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)\b/i.test(previous)
    && /\b(?:keep|mark|move|replace|shorten|extend|skip|rest|cancel|recommend|plan)\b/i.test(previous);
  if (!hasPlan || /\b(?:but|except|although)\b/.test(text)) return false;
  return /^(?:that(?:'s| is) good|perfect|great|works for me|agreed|approved|(?:that|this|it) (?:sounds|looks) good|(?:that|this) works(?: for me)?|sounds good|looks good|i (?:really )?like (?:the|this|that) plan|i like (?:it|that)|i(?:'m| am) (?:happy with (?:this|the) plan|good with that)|i agree|i approve|i choose|yes|yeah|yep|sure|okay|ok|go ahead|do it|do that|let's (?:do it|do that|go with|proceed)|i(?:'ll| will) (?:go with|take)|let's take|take (?:the )?(?:first|second|third|option))\b/i.test(text);
}

const sessionIds = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Keyed tool changes make duplicate edits unrepresentable; the shared validator checks the resulting week. */
export function proposalFromTool(value: unknown): unknown {
  if (!value || typeof value !== 'object') throw new Error('Missing proposal');
  const input = value as Record<string, unknown>;
  if (!input.changes || typeof input.changes !== 'object' || Array.isArray(input.changes)) throw new Error('Expected changes keyed by session ID');
  const keyed = input.changes as Record<string, unknown>;
  if (Object.keys(keyed).some(id => !sessionIds.includes(id))) throw new Error('Unknown session ID');
  const changes = Object.entries(keyed).filter(([, change]) => change !== null).map(([sessionId, change]) => {
    if (!change || typeof change !== 'object' || Array.isArray(change)) throw new Error('Invalid session change');
    return { ...change, sessionId };
  });
  return { impact: input.impact, changes };
}

/** A bare 12-hour time must not silently inherit the original session's AM/PM. */
export function needsClockClarification(content: string): boolean {
  if (/\b(?:am|pm|a\.m\.|p\.m\.|morning|afternoon|evening|night|noon|midnight)\b/i.test(content)) return false;
  return /\b(?:at|to)\s+(?:1[0-2]|[1-9])(?::[0-5]\d)?(?=\s*[,.;!?]|\s*$)/i.test(content);
}
