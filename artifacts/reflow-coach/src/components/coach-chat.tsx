import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Check, LoaderCircle, Plus, RefreshCw, Sparkles } from 'lucide-react';
import {
  validatePlanProposal,
  isSameWeek,
  isPlanProposal,
  type PlanProposal,
  type Session,
} from '../coaching-logic';

type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  includeInHistory?: boolean;
  planUpdate?: PlanProposal;
  planUpdateApplied?: boolean;
  planUpdateError?: string;
  planBaseWeek?: Session[];
  planUpdateDismissed?: boolean;
};

type ChatEvent =
  | { type: 'delta'; content: string }
  | { type: 'reflow_ready'; update: unknown }
  | { type: 'error'; message: string }
  | { type: 'done' };

type Props = {
  week: Session[];
  setWeek: (week: Session[]) => void;
  conversationKey: number;
  onNewConversation: () => void;
};

const greeting: ChatMessage = {
  id: 'greeting',
  role: 'assistant',
  content: 'I’m here to think through your training week with you. What changed, what are you hoping to keep, and what feels uncertain? We can work through the impact before changing anything.',
  includeInHistory: false,
};

function readEvent(block: string): ChatEvent | null {
  const data = block
    .split('\n')
    .find((line) => line.startsWith('data:'))
    ?.slice(5)
    .trim();
  if (!data) return null;
  try {
    return JSON.parse(data) as ChatEvent;
  } catch {
    return null;
  }
}

function PlanUpdateCard({
  update,
  applied,
  error,
  disabled,
  onReflow,
  before,
  dismissed,
  onDismiss,
}: {
  update: PlanProposal;
  applied: boolean;
  error?: string;
  disabled: boolean;
  onReflow: () => void;
  before: Session[];
  dismissed: boolean;
  onDismiss: () => void;
}) {
  return (
    <div className={`plan-update${applied ? ' plan-update-applied' : ''}`} data-testid="reflow-plan-card">
      <div className="plan-update-heading">
        {applied ? <Check size={14} /> : <RefreshCw size={13} />}
        {applied ? 'WEEK REFLOWED' : dismissed ? 'PROPOSAL DISMISSED' : error ? 'CHANGES NEEDED' : 'REVIEW CHANGES'}
      </div>
      <div className="proposal-changes">
        {update.changes.map((change) => {
          const original = before.find((session) => session.id === change.sessionId);
          return <div className="proposal-comparison" key={change.sessionId}>
            <div><strong>Original</strong><span>{original?.day} · {original?.time}</span><span>{original?.title}</span><small>{original?.detail} · {original?.status}</small></div>
            <div><strong>Proposed</strong><span>{change.day} · {change.time}</span><span>{change.title}</span><small>{change.detail} · {change.status}</small></div>
          </div>
        })}
      </div>
      <p className="plan-update-impact">{update.impact}</p>
      {error && <p className="plan-update-error" role="alert">{error}</p>}
      {applied ? (
        <div className="plan-update-result" role="status">Week at a glance now reflects these changes.</div>
      ) : dismissed ? <p className="plan-update-result">Dismissed. This proposal did not change the week.</p> : (
        <div className="proposal-actions">
        <button
          type="button"
          className="reflow-week-button"
          onClick={onReflow}
          disabled={disabled || Boolean(error)}
          data-testid="button-reflow-week"
        >
          <RefreshCw size={13} /> Reflow the week
        </button>
        <button type="button" className="new-chat-button" onClick={onDismiss} disabled={disabled}>Keep current week</button>
        </div>
      )}
    </div>
  );
}

export function CoachChat({ week, setWeek, conversationKey, onNewConversation }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [draft, setDraft] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    setMessages([greeting]);
    setDraft('');
    setIsThinking(false);
    setError('');
  }, [conversationKey]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isThinking]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isThinking) return;

    const userMessage: ChatMessage = {
      id: `user-${nextId.current++}`,
      role: 'user',
      content,
      includeInHistory: true,
    };
    const assistantId = `assistant-${nextId.current++}`;
    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, role: 'assistant', content: '', includeInHistory: false },
    ]);
    setIsThinking(true);
    setError('');

    try {
      const conversation = [...messages, userMessage]
        .filter((item) => item.includeInHistory)
        .slice(-24)
        .map(({ role, content: messageContent }) => ({ role, content: messageContent }));
      const response = await fetch('/api/reflow/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversation, week }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? 'The coach is unavailable right now. Your week has not changed.');
      }
      if (!response.body) throw new Error('No chat stream was returned. Your week has not changed.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamError: string | null = null;
      let finished = false;
      let pendingPlanUpdate: PlanProposal | null = null;

      const processBlock = (block: string) => {
        const chatEvent = readEvent(block);
        if (!chatEvent) return;
        if (chatEvent.type === 'delta' && typeof chatEvent.content === 'string') {
          setMessages((current) => current.map((item) =>
            item.id === assistantId ? { ...item, content: item.content + chatEvent.content } : item,
          ));
        } else if (chatEvent.type === 'reflow_ready' && isPlanProposal(chatEvent.update)) {
          pendingPlanUpdate = chatEvent.update;
        } else if (chatEvent.type === 'error') {
          streamError = chatEvent.message;
        } else if (chatEvent.type === 'done') {
          finished = true;
        }
      };

      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';
        for (const block of blocks) processBlock(block);
      }
      if (buffer.trim()) processBlock(buffer);
      await reader.cancel().catch(() => undefined);

      if (streamError) throw new Error(streamError);
      if (!finished) throw new Error('The connection ended before the coach replied. Your week has not changed.');

      setDraft('');
      setMessages((current) => current.map((item) =>
        item.id === assistantId
          ? {
              ...item,
              content: item.content || (pendingPlanUpdate
                ? 'This plan is ready when you are. Click “Reflow the week” to make these changes.'
                : 'I wasn’t able to put together a useful reply just now. Your plan hasn’t changed.'),
              planUpdate: pendingPlanUpdate ?? undefined,
              planBaseWeek: pendingPlanUpdate ? week.map((session) => ({ ...session })) : undefined,
              includeInHistory: true,
            }
          : item,
      ));
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Something went wrong. Your week has not changed.';
      setError(message === 'Failed to fetch'
        ? 'Couldn’t connect to the coach. Your message is still in the box, and your week hasn’t changed. Try again when the connection is back.'
        : message);
      setDraft(content);
      setMessages((current) => current.filter((item) => item.id !== userMessage.id && item.id !== assistantId));
    } finally {
      setIsThinking(false);
      textareaRef.current?.focus();
    }
  };

  const proposalError = (message: ChatMessage): string | undefined => {
    if (!message.planUpdate || message.planUpdateApplied || message.planUpdateDismissed) return undefined;
    if (!message.planBaseWeek || !isSameWeek(message.planBaseWeek, week)) return 'Your week has changed since this proposal. Ask for a new proposal before applying it.';
    const result = validatePlanProposal(week, message.planUpdate);
    return result.ok ? undefined : result.error;
  };

  const reflowWeek = (messageId: string, update: PlanProposal) => {
    const message = messages.find((item) => item.id === messageId);
    if (!message || message.planUpdateApplied || message.planUpdateDismissed) return;
    const validation = validatePlanProposal(week, update);
    const problem = proposalError(message);
    if (!validation.ok || problem) {
      setMessages((current) => current.map((item) =>
        item.id === messageId
          ? { ...item, planUpdateError: `${problem ?? (!validation.ok ? validation.error : '')} Your week is unchanged.` }
          : item,
      ));
      return;
    }

    setWeek(validation.week);
    setMessages((current) => current.map((item) =>
      item.id === messageId
        ? {
            ...item,
            content: `${item.content}\n\nReflowed—the updated week is shown in Week at a glance.`,
            planUpdateApplied: true,
            planUpdateError: undefined,
          }
        : item,
    ));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <div className="coach-chat">
      <div className="chat-toolbar">
        <p>Talk through the change and its effect on the rest of your week.</p>
        <button
          type="button"
          className="new-chat-button"
          onClick={onNewConversation}
          disabled={isThinking}
          data-testid="button-new-conversation"
        >
          <Plus size={13} /> New chat
        </button>
      </div>

      <div className="example-prompts" aria-label="Try a sample scenario">
        <span>Try a sample scenario</span>
        {[
          ['Missed run', 'I missed Tuesday’s 35-minute easy run. I have 35 minutes free Thursday evening. What should I change?'],
          ['Soccer instead', 'I skipped Tuesday’s run and played soccer instead. Does that replace the run?'],
          ['Scheduling conflict', 'Move Friday’s strength to Wednesday at 7:15 PM and keep Wednesday soccer at 7:15 PM too. Prepare that exact plan.'],
        ].map(([label, prompt]) => <button key={label} type="button" disabled={isThinking} onClick={() => { setDraft(prompt); textareaRef.current?.focus(); }}>{label}</button>)}
      </div>

      <div className="chat-thread" ref={threadRef} aria-live="polite" aria-label="Coaching conversation" data-testid="chat-thread">
        {messages.map((message) => (
          <article className={`chat-message ${message.role === 'user' ? 'chat-message-user' : 'chat-message-assistant'}`} key={message.id}>
            {message.role === 'assistant' ? (
              <div className="message-avatar"><Sparkles size={14} /></div>
            ) : null}
            <div className="message-content">
              <span className="message-sender">{message.role === 'user' ? 'YOU' : 'REFLOW'}</span>
              {message.content ? <p>{message.content}</p> : <span className="thinking-indicator"><LoaderCircle size={16} /> Thinking through your week…</span>}
              {message.planUpdate && (
                <PlanUpdateCard
                  update={message.planUpdate}
                  applied={Boolean(message.planUpdateApplied)}
                  error={message.planUpdateError ?? proposalError(message)}
                  before={message.planBaseWeek ?? []}
                  dismissed={Boolean(message.planUpdateDismissed)}
                  onDismiss={() => setMessages((current) => current.map((item) => item.id === message.id ? { ...item, planUpdateDismissed: true } : item))}
                  disabled={isThinking}
                  onReflow={() => reflowWeek(message.id, message.planUpdate!)}
                />
              )}
            </div>
          </article>
        ))}
        {isThinking && messages.at(-1)?.content ? (
          <div className="streaming-indicator"><span /> Working through the rest of the reply</div>
        ) : null}
      </div>

      <form className="chat-composer" onSubmit={sendMessage}>
        <label htmlFor="coach-message" className="sr-only">Message Reflow</label>
        <textarea
          id="coach-message"
          ref={textareaRef}
          value={draft}
          onChange={(event) => { setDraft(event.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder="Tell me what happened, what you’re worried about, or what you’re weighing up…"
          rows={2}
          maxLength={3000}
          disabled={isThinking}
          data-testid="input-coach-message"
        />
        <div className="composer-bottom">
          <span>Enter to send · Shift + Enter for a new line</span>
          <button type="submit" className="chat-send-button" disabled={!draft.trim() || isThinking} aria-label="Send message" data-testid="button-send-message">
            {isThinking ? <LoaderCircle size={17} className="spin" /> : <ArrowUp size={17} />}
          </button>
        </div>
        {error && <p className="chat-error" role="alert" data-testid="chat-error">{error}</p>}
      </form>
    </div>
  );
}
