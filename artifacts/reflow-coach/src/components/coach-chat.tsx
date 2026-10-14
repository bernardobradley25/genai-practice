import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Check, LoaderCircle, Plus, RefreshCw, Sparkles } from 'lucide-react';
import {
  applyPlanProposal,
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
}: {
  update: PlanProposal;
  applied: boolean;
  error?: string;
  disabled: boolean;
  onReflow: () => void;
}) {
  return (
    <div className={`plan-update${applied ? ' plan-update-applied' : ''}`} data-testid="reflow-plan-card">
      <div className="plan-update-heading">
        {applied ? <Check size={14} /> : <RefreshCw size={13} />}
        {applied ? 'WEEK REFLOWED' : 'READY TO REFLOW'}
      </div>
      <div className="proposal-changes">
        {update.changes.map((change) => (
          <div className="proposal-change" key={change.sessionId}>
            <span className="proposal-day">{change.day.slice(0, 3).toUpperCase()}</span>
            <span className="proposal-session">{change.title}<small>{change.detail}</small></span>
            <span className="proposal-time">{change.time}</span>
          </div>
        ))}
      </div>
      <p className="plan-update-impact">{update.impact}</p>
      {error && <p className="plan-update-error" role="alert">{error}</p>}
      {applied ? (
        <div className="plan-update-result" role="status">Week at a glance now reflects these changes.</div>
      ) : (
        <button
          type="button"
          className="reflow-week-button"
          onClick={onReflow}
          disabled={disabled || Boolean(error)}
          data-testid="button-reflow-week"
        >
          <RefreshCw size={13} /> Reflow the week
        </button>
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

  const reflowWeek = (messageId: string, update: PlanProposal) => {
    const revisedWeek = applyPlanProposal(week, update);
    if (!revisedWeek) {
      setMessages((current) => current.map((item) =>
        item.id === messageId
          ? { ...item, planUpdateError: 'This Reflow no longer fits the current week. Your week is unchanged.' }
          : item,
      ));
      return;
    }

    setWeek(revisedWeek);
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
                  error={message.planUpdateError}
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
