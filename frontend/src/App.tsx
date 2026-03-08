import { useState } from 'react';
import { PlanningView } from './components/PlanningView/PlanningView';
import { StandupView } from './components/Standup/StandupView';

type View = 'planning' | 'standup';

export default function App() {
  const [view, setView] = useState<View>('planning');

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ padding: '0.75rem 1.5rem', background: '#1a1a2e', color: 'white', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <strong style={{ marginRight: '2rem' }}>LifeManager</strong>
        <button onClick={() => setView('planning')} style={{ background: view === 'planning' ? '#4a9eff' : 'transparent', color: 'white', border: '1px solid #4a9eff', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}>
          Planning
        </button>
        <button onClick={() => setView('standup')} style={{ background: view === 'standup' ? '#4a9eff' : 'transparent', color: 'white', border: '1px solid #4a9eff', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}>
          Daily Standup
        </button>
      </nav>
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'planning' ? <PlanningView /> : <StandupView />}
      </main>
    </div>
  );
}
