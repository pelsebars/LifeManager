import { useState, useEffect } from 'react';
import { PlanningView } from './components/PlanningView/PlanningView';
import { StandupView } from './components/Standup/StandupView';
import { DayProfileSettings } from './components/Settings/DayProfileSettings';
import { BacklogView, PendingInvitePopup } from './components/Backlog/BacklogView';
import { LoginPage } from './components/Auth/LoginPage';
import { NewProjectModal } from './components/PlanningView/NewProjectModal';
import { usePlanningStore } from './store/planningStore';
import { useBacklogStore } from './store/backlogStore';

type View = 'planning' | 'standup' | 'settings' | 'backlog';

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [authed, setAuthed]      = useState(() => !!localStorage.getItem('token') || !!localStorage.getItem('demoMode'));
  const [view, setView]          = useState<View>('planning');
  const [showNewProject, setShowNewProject] = useState(false);
  const { createProject } = usePlanningStore();
  const { pendingInvites, fetchPendingInvites, respondToInvite } = useBacklogStore();

  // Fetch pending invites once when logged in
  useEffect(() => {
    if (authed && localStorage.getItem('token')) {
      fetchPendingInvites();
    }
  }, [authed, fetchPendingInvites]);

  if (!authed) {
    return (
      <LoginPage
        onSuccess={() => setAuthed(true)}
        onDemoMode={() => { localStorage.setItem('demoMode', '1'); setAuthed(true); }}
      />
    );
  }

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('demoMode');
    setAuthed(false);
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ padding: '0.75rem 1.5rem', background: '#1a1a2e', color: 'white', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <strong style={{ marginRight: '2rem', letterSpacing: '-0.3px' }}>LifeManager</strong>
        <button onClick={() => setView('planning')} style={navBtn(view === 'planning')}>Planning</button>
        <button onClick={() => setView('standup')}  style={navBtn(view === 'standup')}>Daily Standup</button>
        <button onClick={() => setView('backlog')}  style={navBtn(view === 'backlog')}>
          Backlog
          {pendingInvites.length > 0 && (
            <span style={{ marginLeft: 5, background: '#f59e0b', color: 'white', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 5px' }}>
              {pendingInvites.length}
            </span>
          )}
        </button>
        <button onClick={() => setView('settings')} style={navBtn(view === 'settings')}>Capacity</button>
        <button
          onClick={() => setShowNewProject(true)}
          style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          + New Project
        </button>
        <button
          onClick={handleSignOut}
          style={{ marginLeft: 'auto', background: 'none', color: '#888', border: '1px solid #444', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
        >
          Sign out
        </button>
      </nav>

      {showNewProject && (
        <NewProjectModal
          onCreate={async (data) => { await createProject(data); setShowNewProject(false); }}
          onClose={() => setShowNewProject(false)}
        />
      )}

      {/* Pending invite popup — shown on login if someone shared their backlog with me */}
      {pendingInvites.length > 0 && (
        <PendingInvitePopup invites={pendingInvites} onRespond={respondToInvite} />
      )}

      <main style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'planning' && <PlanningView />}
        {view === 'standup'  && <StandupView />}
        {view === 'backlog'  && <div style={{ overflowY: 'auto', height: '100%' }}><BacklogView /></div>}
        {view === 'settings' && <div style={{ overflowY: 'auto', height: '100%' }}><DayProfileSettings /></div>}
      </main>
    </div>
  );
}

function navBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? '#4a9eff' : 'transparent',
    color: 'white',
    border: '1px solid #4a9eff',
    borderRadius: 4,
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: 13,
  };
}
