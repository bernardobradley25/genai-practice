import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Check, LoaderCircle, MessageSquare, Plus, Sparkles } from 'lucide-react';
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
  proposal?: PlanProposal;
  proposalStatus?: 'accepted' | 'kept';
};

type ChatEvent =
  | { type: 'delta'; content: string }
  | { type: 'proposal'; proposal: unknown }
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

function ProposalCard({
  message,
  onChoose,
  week,
}: {
  message: ChatMessage;
  onChoose: (accepted: boolean) => void;
  week: Session[];
}) {
  const proposal = message.proposal;
  if (!proposal) return null;
  const revisedWeek = applyPlanProposal(week, proposal);
  const decided = Boolean(message.proposalStatus);

  return (
    <div className="plan-proposal" data-testid="ai-plan-proposal">
      <div className="proposal-heading"><Sparkles size={14} /> POSSIBLE WEEK CHANGE</div>
      <div className="proposal-changes">
        {proposal.changes.map((change) => (
          <div className="proposal-change" key={change.sessionId}>
            <span className="proposal-day">{change.day.slice(0, 3).toUpperCase()}</span>
            <span className="proposal-session">{change.title}<small>{change.detail}</small></span>
            <span className="proposal-time">{change.time}</span>
          </div>
        ))}
      </div>
      <p className="proposal-impact">{proposal.impact}</p>
      {decided ? (
        <div className="proposal-result" role="status">
          <Check size={14} />
          {message.proposalStatus === 'accepted' ? 'Applied to the sample week above.' : 'Kept your week as it was.'}
        </div>
      ) : (
        <div className="proposal-actions">
          <button
            type="button"
            className="accept-button"
            onClick={() => onChoose(true)}
            disabled={!revisedWeek}
            data-testid="button-accept-proposal"
          >
            <Check size={14} /> Apply to sample week
          </button>
          <button
            type="button"
            className="reject-button"
            onClick={() => onChoose(false)}
            data-testid="button-reject-proposal"
          >
            Keep my week
          </button>
        </div>
      )}
      {!decided && !revisedWeek && (
        <p className="proposal-warning" role="alert">This conflicts with the current schedule, so it can’t be applied. Ask the coach to reconsider it.</p>
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
    setDraft('');
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
      let hasError = false;
      let finished = false;

      const processBlock = (block: string) => {
        const chatEvent = readEvent(block);
        if (!chatEvent) return;
        if (chatEvent.type === 'delta' && typeof chatEvent.content === 'string') {
          setMessages((current) => current.map((item) =>
            item.id === assistantId ? { ...item, content: item.content + chatEvent.content } : item,
          ));
        } else if (chatEvent.type === 'proposal' && isPlanProposal(chatEvent.proposal)) {
          const proposal = chatEvent.proposal;
          setMessages((current) => current.map((item) =>
            item.id === assistantId ? { ...item, proposal } : item,
          ));
        } else if (chatEvent.type === 'error') {
          hasError = true;
          setError(chatEvent.message);
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

      setMessages((current) => current.map((item) =>
        item.id === assistantId
          ? {
              ...item,
              content: item.content || (item.proposal
                ? 'I’ve outlined a possible adjustment below. Take a look at the impact and decide whether it fits.'
                : hasError ? item.content : 'I wasn’t able to put together a useful reply just now. Your plan hasn’t changed.'),
              includeInHistory: !hasError,
            }
          : item,
      ));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Something went wrong. Your week has not changed.');
      setMessages((current) => current.map((item) =>
        item.id === assistantId ? { ...item, content: 'I couldn’t reach the coach just now. Your plan hasn’t changed.', includeInHistory: false } : item,
      ));
    } finally {
      setIsThinking(false);
      textareaRef.current?.focus();
    }
  };

  const decideProposal = (messageId: string, proposal: PlanProposal, accepted: boolean) => {
    const decision: ChatMessage['proposalStatus'] = accepted ? 'accepted' : 'kept';
    if (accepted) {
      const revisedWeek = applyPlanProposal(week, proposal);
      if (!revisedWeek) {
        setError('The proposed change no longer fits the current week. No changes were made.');
        return;
      }
      setWeek(revisedWeek);
    }
    setMessages((current) => [
      ...current.map((item) =>
        item.id === messageId ? { ...item, proposalStatus: decision } : item,
      ),
      {
        id: `user-${nextId.current++}`,
        role: 'user',
        content: accepted ? 'I applied that change to the sample week.' : 'I kept my original week instead.',
        includeInHistory: true,
      },
    ]);
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
              {message.proposal && <ProposalCard
                message={message}
                week={week}
                onChoose={(accepted) => decideProposal(message.id, message.proposal!, accepted)}
              />}
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
