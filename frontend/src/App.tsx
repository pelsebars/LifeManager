import { useState } from 'react';
import { PlanningView } from './components/PlanningView/PlanningView';
import { StandupView } from './components/Standup/StandupView';
import { LoginPage } from './components/Auth/LoginPage';

type View = 'planning' | 'standup';

export default function App() {
  const [authed, setAuthed]  = useState(() => !!localStorage.getItem('token'));
  const [view, setView]      = useState<View>('planning');

  if (!authed) {
    return <LoginPage onSuccess={() => setAuthed(true)} />;
  }

  const handleSignOut = () => {
    localStorage.removeItem('token');
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
        <button
          onClick={handleSignOut}
          style={{ marginLeft: 'auto', background: 'none', color: '#888', border: '1px solid #444', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
        >
          Sign out
        </button>
      </nav>
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'planning' ? <PlanningView /> : <StandupView />}
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
