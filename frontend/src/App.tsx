import { useState, useEffect } from 'react';
import { PlanningView } from './components/PlanningView/PlanningView';
import { StandupView } from './components/Standup/StandupView';
import { DayProfileSettings } from './components/Settings/DayProfileSettings';
import { BacklogView } from './components/Backlog/BacklogView';
import { LoginPage } from './components/Auth/LoginPage';
import { NewProjectModal } from './components/PlanningView/NewProjectModal';
import { usePlanningStore } from './store/planningStore';
import { useBacklogStore } from './store/backlogStore';
import type { BacklogShare } from './types';

type View = 'planning' | 'standup' | 'settings' | 'backlog';

// ─── Pending invite popup ─────────────────────────────────────────────────────

function PendingInvitePopup({ invites, onRespond }: { invites: BacklogShare[]; onRespond: (id: string, accept: boolean) => Promise<void> }) {
  const [current, setCurrent] = useState(0);
  const invite = invites[current];
  if (!invite) return null;

  const handle = async (accept: boolean) => {
    await onRespond(invite.id, accept);
    if (current >= invites.length - 1) setCurrent(0);
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.3)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 9999, width: 400, background: 'white', borderRadius: 12,
        boxShadow: '0 12px 48px rgba(0,0,0,0.22)', fontFamily: 'system-ui, sans-serif',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 16px', background: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🔗</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Backlog sharing invitation</span>
          {invites.length > 1 && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#888', background: '#2a2a3e', padding: '2px 8px', borderRadius: 10 }}>
              {current + 1} / {invites.length}
            </span>
          )}
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e', marginBottom: 8 }}>
            {invite.owner_email} vil gerne dele sin backlog med dig
          </div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>
            Workspace: <strong>{invite.owner_workspace_name}</strong>
          </div>
          <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>
            Hvis du accepterer, kan du se og bidrage til deres backlog — og aktivere items som tasks på dit eget Gantt.
          </div>
        </div>
        <div style={{ padding: '12px 24px 20px', display: 'flex', gap: 10 }}>
          <button
            onClick={() => handle(true)}
            style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            ✓ Ja, accepter
          </button>
          <button
            onClick={() => handle(false)}
            style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #e0e0e0', background: 'white', color: '#888', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            Nej tak
          </button>
        </div>
      </div>
    </>
  );
}

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
