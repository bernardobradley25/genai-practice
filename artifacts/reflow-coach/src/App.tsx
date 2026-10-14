import { useState } from 'react';
import './reflow.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { initialWeek, type Session } from './coaching-logic';
import { CoachChat } from './components/coach-chat';
import { Activity, CalendarDays, Check, Clock3, Dumbbell, Footprints, Info, RotateCcw, Waves } from 'lucide-react';

function sportIcon(sport: Session['sport']) {
  if (sport === 'Run') return <Footprints size={16} strokeWidth={1.8} />;
  if (sport === 'Soccer') return <Activity size={16} strokeWidth={1.8} />;
  if (sport === 'Surf') return <Waves size={16} strokeWidth={1.8} />;
  return <Dumbbell size={16} strokeWidth={1.8} />;
}

function App() {
  const [week, setWeek] = useState<Session[]>(initialWeek);
  const [conversationVersion, setConversationVersion] = useState(0);

  const reset = () => {
    setWeek(initialWeek);
    setConversationVersion((version) => version + 1);
  };

  const activeSessions = week.filter((session) => session.status !== 'rest' && session.status !== 'missed');
  const dayCount = activeSessions.filter((session) => session.sport !== 'Strength').length;
  const runCount = activeSessions.filter((session) => session.sport === 'Run').length;
  const soccerCount = activeSessions.filter((session) => session.sport === 'Soccer').length;
  const surfCount = activeSessions.filter((session) => session.sport === 'Surf').length;
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
            <div className="athlete-info"><strong>Jordan M.</strong><span>Fictional sample · adult amateur</span></div>
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
              <div className="load-indicator"><span className="load-number">{dayCount}<small> / 5</small></span><span className="load-caption">run + sport days</span></div>
            </div>
            <div className="constraint-strip" data-testid="athlete-constraints">
              <span><i>GOAL</i> 10K · comfortable finish</span>
              <span><i>OPEN</i> Thu evening</span>
              <span><i>CAP</i> 5 run / sport days</span>
            </div>
            <div className="week-grid" data-testid="week-plan">
              {week.map((session) => (
                <article className={`day-card ${session.status === 'rest' ? 'day-rest' : ''} ${session.status === 'moved' ? 'day-moved' : ''} ${session.status === 'missed' ? 'day-missed' : ''}`} key={session.id} data-testid={`session-${session.id}`}>
                  <div className="day-top">
                    <span className="day-name">{session.shortDay}</span>
                    {session.status === 'done' && <span className="done-dot" aria-label="Completed"><Check size={11} /></span>}
                  </div>
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
                <span><i className="legend-dot surf-dot" /> Surf</span>
                <span><i className="legend-dot strength-dot" /> Strength</span>
              </div>
              <span className="plan-note">{runCount} runs · {soccerCount} soccer · {surfCount} surf · {strengthCount} strength</span>
            </div>
          </section>

          <section className="coach-panel panel enter enter-delay" aria-labelledby="coach-heading">
            <div className="coach-head">
              <div className="coach-heading-group">
                <div className="coach-glyph"><Activity size={18} /></div>
                <div>
                  <div className="section-kicker">REFLOW COACH <span className="ai-dot" /> LIVE AI</div>
                  <h2 className="display" id="coach-heading">Let’s work through it.</h2>
                </div>
              </div>
            </div>
            <CoachChat
              key={conversationVersion}
              week={week}
              setWeek={setWeek}
              conversationKey={conversationVersion}
              onNewConversation={() => setConversationVersion((version) => version + 1)}
            />
            <div className="coach-foot">
              <span className="ai-mark"><span /> AI conversation</span>
              <span>Uses Replit AI credits · chat stays in this tab</span>
            </div>
          </section>
        </div>

        <section className="principles" aria-label="Coaching principles">
          <div><span className="principle-number">01</span><span><strong>Whole-week thinking</strong><small>Every sport shares the same recovery budget.</small></span></div>
          <div><span className="principle-number">02</span><span><strong>No false equivalents</strong><small>Soccer is not a run with a different label.</small></span></div>
          <div><span className="principle-number">03</span><span><strong>You stay in charge</strong><small>Review any proposed change before it lands.</small></span></div>
        </section>
      </main>
      <footer className="disclosure" data-testid="persistent-disclosure">
        <Info size={15} />
        <p><strong>Prototype note</strong> AI responses can be wrong and are not medical advice. Messages go to Replit’s managed AI service; this prototype does not save conversation history. Use the fictional profile—don’t enter identifying or medical details.</p>
        <span className="prototype-tag">FICTIONAL ATHLETE · NO APP STORAGE</span>
      </footer>
    </div>
  );
}

const queryClient = new QueryClient();

function Router() {
  const [location] = useLocation();
  return (
    <ErrorBoundary>
      <Switch location={location}>
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
