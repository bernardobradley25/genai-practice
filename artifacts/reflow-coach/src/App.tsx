import { useState, type FormEvent } from 'react';
import './reflow.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  applyMissedRunMove,
  classifyRequest,
  initialWeek,
  validateSoccerDetails,
  type CaseType,
  type Session,
} from './coaching-logic';
import {
  Activity, ArrowDownRight, ArrowRight, CalendarDays, Check, ChevronRight,
  CircleHelp, Clock3, Dumbbell, Footprints, Info, RotateCcw, ShieldCheck,
  Sparkles, X,
} from 'lucide-react';

type CaseStatus = 'idle' | 'clarifying' | 'review' | 'resolved';

const examples = [
  { label: 'I missed Tuesday’s easy run', value: 'I missed Tuesday’s easy run. I have a free recovery slot Thursday evening.' },
  { label: 'Soccer replaced a run', value: 'Soccer replaced my Thursday run.' },
  { label: 'Make up every missed session', value: 'I missed two sessions and want to make up every one this week.' },
];

function sportIcon(sport: Session['sport']) {
  if (sport === 'Run') return <Footprints size={16} strokeWidth={1.8} />;
  if (sport === 'Soccer') return <Activity size={16} strokeWidth={1.8} />;
  return <Dumbbell size={16} strokeWidth={1.8} />;
}

function App() {
  const [week, setWeek] = useState<Session[]>(initialWeek);
  const [message, setMessage] = useState('');
  const [caseType, setCaseType] = useState<CaseType | null>(null);
  const [status, setStatus] = useState<CaseStatus>('idle');
  const [error, setError] = useState('');
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState('');
  const [choice, setChoice] = useState<'keep' | 'drop' | null>(null);
  const [appliedNotice, setAppliedNotice] = useState('');

  const beginCase = (value: string) => {
    setMessage(value);
    setError('');
    setAppliedNotice('');
    setChoice(null);
    const requestType = classifyRequest(value);
    if (requestType === 'empty') {
      setError('Add a little context first, or start with one of the examples.');
      return;
    }
    setCaseType(requestType);
    if (requestType === 'soccer') {
      setStatus('clarifying');
      setDuration('');
      setIntensity('');
    } else {
      setStatus('review');
    }
  };

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    beginCase(message);
  };

  const finishSoccerDetails = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateSoccerDetails(duration, intensity);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setStatus('review');
  };

  const resolve = (accepted: boolean) => {
    if (caseType === 'missed' && accepted) {
      setWeek(applyMissedRunMove);
      setAppliedNotice('Easy run moved to Thursday evening. Thursday’s steady run is kept clear so the sessions do not stack.');
    } else if (caseType === 'makeup' && choice) {
      setAppliedNotice(choice === 'drop'
        ? 'Recovery-first choice recorded: let both missed sessions go; your displayed training week is unchanged.'
        : 'Plan stays as written. Nothing was added to an already full week.');
    } else if (caseType === 'soccer') {
      setAppliedNotice('Context noted. The plan stays unchanged: soccer effort is variable and is not counted as an equivalent run.');
    } else {
      setAppliedNotice('No plan edits made. Your week stays as written.');
    }
    setStatus('resolved');
  };

  const reset = () => {
    setWeek(initialWeek);
    setMessage('');
    setCaseType(null);
    setStatus('idle');
    setError('');
    setDuration('');
    setIntensity('');
    setChoice(null);
    setAppliedNotice('');
  };

  const activeSessions = week.filter((session) => session.status !== 'rest' && session.status !== 'missed');
  const dayCount = activeSessions.filter((session) => session.sport !== 'Strength').length;
  const runCount = activeSessions.filter((session) => session.sport === 'Run').length;
  const soccerCount = activeSessions.filter((session) => session.sport === 'Soccer').length;
  const strengthCount = activeSessions.filter((session) => session.sport === 'Strength').length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/" aria-label="Reflow home" data-testid="link-home">
            <span className="brand-mark"><Activity size={19} strokeWidth={2.2} /></span>
            <span className="brand-name">reflow<span>.</span></span>
          </a>
          <div className="header-meta">
            <span className="week-label"><span className="live-dot" /> TRAINING DESK</span>
            <span className="meta-divider" />
            <span className="athlete-label">A WEEK THAT FITS</span>
          </div>
          <button className="reset-link" onClick={reset} data-testid="button-reset-top">
            <RotateCcw size={15} /> <span>Reset week</span>
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="intro enter">
          <div className="intro-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> YOUR TRAINING, IN CONTEXT</div>
            <h1 className="display">Make room for<br className="desktop-break" /> <em>real life.</em></h1>
            <p className="intro-text">A practical plan for the whole week—not a pile of sessions competing for space.</p>
          </div>
          <div className="athlete-card">
            <div className="avatar">JM</div>
            <div className="athlete-info"><strong>Jordan M.</strong><span>Adult amateur · 10K + Sunday league</span></div>
            <span className="week-chip">WEEK 24</span>
          </div>
        </section>

        <div className="main-grid">
          <section className="week-panel panel enter enter-delay" aria-labelledby="week-heading">
            <div className="panel-heading">
              <div>
                <div className="section-kicker"><CalendarDays size={14} /> THE WHOLE ROUTINE</div>
                <h2 className="display" id="week-heading">This week, at a glance</h2>
              </div>
              <div className="load-indicator"><span className="load-number">{dayCount}<small> / 5</small></span><span className="load-caption">run + field days</span></div>
            </div>
            <div className="constraint-strip" data-testid="athlete-constraints">
              <span><i>GOAL</i> 10K · comfortable finish</span>
              <span><i>OPEN</i> Thu evening</span>
              <span><i>CAP</i> 5 run / field days</span>
            </div>
            <div className="week-grid" data-testid="week-plan">
              {week.map((session) => (
                <article className={`day-card ${session.status === 'rest' ? 'day-rest' : ''} ${session.status === 'moved' ? 'day-moved' : ''} ${session.status === 'missed' ? 'day-missed' : ''}`} key={session.id} data-testid={`session-${session.id}`}>
                  <div className="day-top"><span className="day-name">{session.shortDay}</span>{session.status === 'done' && <span className="done-dot" aria-label="Completed"><Check size={11} /></span>}</div>
                  {session.status === 'rest' ? (
                    <div className="rest-mark"><span className="rest-rule" /><span>open</span></div>
                  ) : (
                    <>
                      <div className={`sport-icon sport-${session.sport.toLowerCase()}`}>{sportIcon(session.sport)}</div>
                      <h3>{session.title}</h3>
                      <p className="session-detail">{session.detail}</p>
                      <div className="session-time"><Clock3 size={12} /> {session.time}</div>
                      {session.status === 'moved' && <span className="moved-tag" data-testid="status-session-moved">MOVED</span>}
                      {session.status === 'missed' && <span className="missed-tag" data-testid="status-session-missed">MISSED</span>}
                    </>
                  )}
                  {session.status === 'rest' && <p className="rest-caption">{session.title}</p>}
                </article>
              ))}
            </div>
            <div className="plan-foot">
              <div className="legend">
                <span><i className="legend-dot run-dot" /> Run</span>
                <span><i className="legend-dot soccer-dot" /> Soccer</span>
                <span><i className="legend-dot strength-dot" /> Strength</span>
              </div>
              <span className="plan-note">{runCount} runs · {soccerCount} soccer · {strengthCount} strength</span>
            </div>
          </section>

          <section className="coach-panel panel enter enter-delay" aria-labelledby="coach-heading">
            <div className="coach-head">
              <div className="coach-heading-group">
                <div className="coach-glyph"><Activity size={18} /></div>
                <div><div className="section-kicker">REFLOW COACH <span className="sim-dot" /></div><h2 className="display" id="coach-heading">Let’s work with the week.</h2></div>
              </div>
              {status !== 'idle' && <button className="small-reset" onClick={reset} data-testid="button-start-over"><RotateCcw size={14} /> Start over</button>}
            </div>

            <div className="coach-content">
              {status === 'idle' && (
                <>
                  <p className="coach-prompt">What changed? Tell me what happened and when you have room.</p>
                  <div className="example-row" aria-label="Example schedule changes">
                    {examples.map((example, index) => (
                      <button key={example.label} className="example-chip" onClick={() => setMessage(example.value)} data-testid={`example-${index + 1}`}>
                        {example.label}<ChevronRight size={13} />
                      </button>
                    ))}
                  </div>
                  <form className="message-form" onSubmit={submitMessage}>
                    <label htmlFor="schedule-change" className="sr-only">Describe a schedule change</label>
                    <textarea id="schedule-change" value={message} onChange={(event) => { setMessage(event.target.value); setError(''); }} placeholder="For example: I missed my easy run, but Thursday evening opened up…" rows={3} data-testid="input-schedule-change" />
                    {error && <p className="form-error" role="alert" data-testid="error-empty-input">{error}</p>}
                    <div className="form-bottom"><span className="input-hint">A day, a session, and any new free time helps.</span><button className="send-button" type="submit" data-testid="button-review-change">Review change <ArrowRight size={15} /></button></div>
                  </form>
                </>
              )}

              {status === 'clarifying' && (
                <div className="response-wrap enter" data-testid="coach-clarification">
                  <div className="you-said"><span className="response-label">YOU SAID</span><p>{message}</p></div>
                  <div className="coach-response">
                    <div className="response-label coach-label"><Sparkles size={13} /> BEFORE I ADJUST ANYTHING</div>
                    <p>Soccer has bursts, contact, and unpredictable effort. I won’t count it as a run by default. How long were you on the field, and how hard did it feel overall?</p>
                    <form className="clarify-form" onSubmit={finishSoccerDetails}>
                      <label className="field-label" htmlFor="soccer-duration">Time on field</label>
                      <div className="input-suffix"><input id="soccer-duration" type="number" min="1" max="240" value={duration} onChange={(event) => { setDuration(event.target.value); setError(''); }} placeholder="e.g. 75" data-testid="input-soccer-duration" /><span>minutes</span></div>
                      <label className="field-label" htmlFor="soccer-intensity">Overall perceived effort</label>
                      <select id="soccer-intensity" value={intensity} onChange={(event) => { setIntensity(event.target.value); setError(''); }} data-testid="select-soccer-intensity">
                        <option value="">Choose the closest fit</option>
                        <option value="easy">Easy — could talk comfortably</option>
                        <option value="moderate">Moderate — working, still in control</option>
                        <option value="hard">Hard — repeated intense efforts</option>
                      </select>
                      {error && <p className="form-error" role="alert" data-testid="error-soccer-details">{error}</p>}
                      <button className="send-button clarify-button" type="submit" data-testid="button-submit-soccer-details">Continue with context <ArrowRight size={15} /></button>
                    </form>
                  </div>
                </div>
              )}

              {status === 'review' && caseType && (
                <div className="response-wrap enter" data-testid="coach-review">
                  <div className="you-said"><span className="response-label">YOU SAID</span><p>{message}</p></div>
                  {caseType === 'missed' && (
                    <div className="coach-response">
                      <div className="response-label coach-label"><Sparkles size={13} /> A SMALL, CLEAN MOVE</div>
                      <p>There’s a Thursday recovery window, but Thursday already holds a steady run. I can move Tuesday’s easy run there <strong>only if we keep the steady run clear</strong>—two runs in one day would change the load, not just the calendar.</p>
                      <div className="tradeoff-box"><ArrowDownRight size={15} /><span><strong>Trade-off</strong> This protects a recovery gap, but you’ll have one fewer steady session this week.</span></div>
                      <div className="edit-preview" data-testid="proposed-edit">
                        <div><span className="edit-before">TUE</span><span className="edit-arrow">→</span><span className="edit-after">THU · 6:30 PM</span><span className="edit-description">Easy run · 35 min</span></div>
                        <div className="preview-clear"><span className="edit-before">THU</span><span className="edit-arrow">→</span><span className="edit-after">OPEN</span><span className="edit-description">Steady run removed</span></div>
                      </div>
                      <div className="assumption-note"><Info size={14} /><span><strong>Assumption:</strong> Thursday evening is genuinely available, and the recovery slot is not after a hard soccer session.</span></div>
                      <div className="decision-row"><button className="accept-button" onClick={() => resolve(true)} data-testid="button-accept-proposal"><Check size={15} /> Make this change</button><button className="reject-button" onClick={() => resolve(false)} data-testid="button-reject-proposal"><X size={15} /> Keep my week</button></div>
                    </div>
                  )}
                  {caseType === 'makeup' && (
                    <div className="coach-response">
                      <div className="response-label coach-label"><ShieldCheck size={13} /> I WOULDN’T ADD BOTH</div>
                      <p>Your open space is already doing useful work: recovery between soccer, running, and strength. There isn’t a compatible free slot for every missed session without stacking load or taking that recovery away.</p>
                      <div className="tradeoff-box"><ArrowDownRight size={15} /><span><strong>Trade-off</strong> Chasing every session can turn a disrupted week into a compressed, harder one. The missed work doesn’t need to be repaid all at once.</span></div>
                      <div className="assumption-note"><Info size={14} /><span><strong>Uncertainty:</strong> I don’t know how hard those missed sessions were or how you’re recovering, so I won’t invent extra capacity.</span></div>
                      <p className="choice-prompt">Which feels right for this week?</p>
                      <div className="choice-buttons">
                        <button className={`choice-button ${choice === 'drop' ? 'choice-selected' : ''}`} onClick={() => setChoice('drop')} data-testid="button-choice-let-go"><span className="choice-mark">A</span><span><strong>Let the missed sessions go</strong><small>Keep the rest of the week as planned.</small></span>{choice === 'drop' && <Check size={16} />}</button>
                        <button className={`choice-button ${choice === 'keep' ? 'choice-selected' : ''}`} onClick={() => setChoice('keep')} data-testid="button-choice-keep-plan"><span className="choice-mark">B</span><span><strong>Keep the plan as written</strong><small>No catch-up sessions; revisit next week.</small></span>{choice === 'keep' && <Check size={16} />}</button>
                      </div>
                      <button className="send-button decision-submit" onClick={() => resolve(true)} disabled={!choice} data-testid="button-confirm-choice">Confirm choice <ArrowRight size={15} /></button>
                    </div>
                  )}
                  {caseType === 'soccer' && (
                    <div className="coach-response">
                      <div className="response-label coach-label"><Sparkles size={13} /> CONTEXT ADDED</div>
                      <p>Thanks—that’s useful context: <strong>{duration} minutes, {intensity} effort.</strong> Soccer includes stop-start efforts and change of direction, so time alone still can’t tell me it replaces a steady run. I’ll leave the run on your plan rather than make a false one-for-one swap.</p>
                      <div className="tradeoff-box"><Info size={15} /><span><strong>Why no edit?</strong> Duration and perceived effort are helpful, but they don’t capture the full load of a match or club session.</span></div>
                      <div className="assumption-note"><Info size={14} /><span><strong>Uncertainty:</strong> No detail on match intensity spikes, contact, or how fresh you feel tomorrow. This is a note, not a training-load calculation.</span></div>
                      <div className="decision-row"><button className="accept-button" onClick={() => resolve(true)} data-testid="button-acknowledge-soccer"><Check size={15} /> Keep plan, note soccer</button><button className="reject-button" onClick={() => resolve(false)} data-testid="button-dismiss-soccer"><X size={15} /> Leave unnoted</button></div>
                    </div>
                  )}
                  {caseType === 'unknown' && (
                    <div className="coach-response">
                      <div className="response-label coach-label"><CircleHelp size={13} /> I NEED A BIT MORE TO GO ON</div>
                      <p>I can help think through a change to this sample week, but I don’t want to guess at a plan edit. Try naming the session that changed and any new time you have available.</p>
                      <div className="decision-row"><button className="reject-button" onClick={reset} data-testid="button-try-again">Try a clearer note <ArrowRight size={14} /></button></div>
                    </div>
                  )}
                </div>
              )}

              {status === 'resolved' && (
                <div className="resolved-view enter" data-testid="coach-resolution">
                  <div className="resolved-icon"><Check size={19} /></div>
                  <div className="response-label coach-label">WEEK REVIEWED</div>
                  <h3 className="display">That’s a plan you can work with.</h3>
                  <p className="resolved-copy">{appliedNotice}</p>
                  <div className="resolution-recap">
                    <span className="recap-label">YOUR WEEK, YOUR CALL</span>
                    <span>{caseType === 'missed' && appliedNotice.startsWith('Easy run moved') ? 'Tuesday easy run → Thursday 6:30 PM' : 'No unapproved changes to your week'}</span>
                  </div>
                  <button className="send-button" onClick={reset} data-testid="button-reset-conversation"><RotateCcw size={14} /> Review another change</button>
                </div>
              )}
            </div>
            <div className="coach-foot"><span className="sim-mark"><span /> SIMULATED COACH</span><span>Responses are prewritten, not AI-generated.</span></div>
          </section>
        </div>

        <section className="principles" aria-label="Coaching principles">
          <div><span className="principle-number">01</span><span><strong>Whole-week thinking</strong><small>Every sport shares the same recovery budget.</small></span></div>
          <div><span className="principle-number">02</span><span><strong>No false equivalents</strong><small>Soccer is not a run with a different label.</small></span></div>
          <div><span className="principle-number">03</span><span><strong>You stay in charge</strong><small>Review every proposed change before it lands.</small></span></div>
        </section>
      </main>
      <footer className="disclosure" data-testid="persistent-disclosure">
        <Info size={15} /><p><strong>Prototype note</strong> Coach responses are prewritten and simulated—not AI-generated. This is a planning aid, not medical guidance. Use your judgment and seek qualified support for health concerns.</p>
        <span className="prototype-tag">SAMPLE ATHLETE · NO DATA SAVED</span>
      </footer>
    </div>
  );
}

const queryClient = new QueryClient();

function Router() {
  return (
    <ErrorBoundary>
      <Switch>
        <Route path="/" component={App} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default Root;
