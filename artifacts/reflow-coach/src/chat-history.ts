/** Retain recent complete messages within the server budget; never truncate the latest request. */
export function boundedHistory(messages: Array<{role: 'user' | 'assistant'; content: string}>) {
  let size = 0;
  const selected: typeof messages = [];
  for (let index = messages.length - 1; index >= 0 && selected.length < 24; index--) {
    const message = messages[index];
    if (size + message.content.length > 24000) break;
    selected.unshift(message);
    size += message.content.length;
  }
  while (selected[0]?.role === 'assistant') selected.shift();
  return selected;
}
