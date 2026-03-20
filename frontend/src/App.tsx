import { useState } from 'react';
import { PlanningView } from './components/PlanningView/PlanningView';
import { StandupView } from './components/Standup/StandupView';
import { DayProfileSettings } from './components/Settings/DayProfileSettings';
import { LoginPage } from './components/Auth/LoginPage';
import { NewProjectModal } from './components/PlanningView/NewProjectModal';
import { usePlanningStore } from './store/planningStore';

type View = 'planning' | 'standup' | 'settings';

export default function App() {
  const [authed, setAuthed]      = useState(() => !!localStorage.getItem('token') || !!localStorage.getItem('demoMode'));
  const [view, setView]          = useState<View>('planning');
  const [showNewProject, setShowNewProject] = useState(false);
  const { createProject } = usePlanningStore();

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
        <button onClick={() => setView('planning')} style={navBtn(view === 'planning')}>
          Planning
        </button>
        <button onClick={() => setView('standup')} style={navBtn(view === 'standup')}>
          Daily Standup
        </button>
        <button onClick={() => setView('settings')} style={navBtn(view === 'settings')}>
          Capacity
        </button>
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
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'planning' && <PlanningView />}
        {view === 'standup'  && <StandupView />}
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
