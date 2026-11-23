/** Tool availability is permission to stage a review, never permission to apply it. */
export function hasClearReflowIntent(messages: Array<{ role: string; content: string }>): boolean {
  const latest = messages.at(-1);
  if (!latest || latest.role !== 'user') return false;
  const text = latest.content.trim().toLowerCase().replace(/[’‘]/g, "'");
  // Qualified agreement, hypothetical discussion and explicit refusal stay read-only.
  if (!text || /\b(maybe|perhaps|not sure|what if|i wonder|explore|compare|explain|wait|hold on|not yet|hold off|before i decide|still deciding|unless)\b/.test(text)
    || /\b(?:do not|don't|never)\s+(?:prepare|stage|change|move|reschedule|update|reflow)\b/.test(text)
    || /\bno\s+(?:proposal|changes?|edits?)\b/.test(text)) return false;

  const edit = '(?:prepare|stage|reflow|reschedule|apply|make|update|change|move|replace|switch|add|shorten|extend|skip|mark|set|cancel|remove)';
  const polite = "(?:(?:please|can you|could you|would you|let's)\\s+)*";
  if (new RegExp('^' + polite + edit + '\\b').test(text)
    || new RegExp("^(?:i want you to|i want to|i'd like you to|i'd like to)\\s+" + edit + '\\b').test(text)) return true;

  const previous = messages.slice(0, -1).reverse().find(message => message.role === 'assistant')?.content ?? '';
  // A specific recommendation is enough context even if the model forgot its closing question.
  const hasPlan = /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i.test(previous)
    && /\b(?:keep|mark|move|replace|shorten|extend|skip|rest|cancel|recommend|plan)\b/i.test(previous);
  if (!hasPlan || /\b(?:but|except|although)\b/.test(text)) return false;
  return /^(?:(?:that|this|it) (?:sounds|looks) good|(?:that|this) works(?: for me)?|sounds good|looks good|i (?:really )?like (?:the|this|that) plan|i like (?:it|that)|i(?:'m| am) (?:happy with (?:this|the) plan|good with that)|i agree|i approve|i choose|yes|yeah|yep|sure|okay|ok|go ahead|do it|do that|let's (?:do it|do that|go with|proceed)|i(?:'ll| will) (?:go with|take)|let's take|take (?:the )?(?:first|second|third|option))\b/i.test(text);
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
