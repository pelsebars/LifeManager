import { usePlanningStore } from '../../store/planningStore';

interface Props {
  projectId: string;
}

export function PhaseRibbon({ projectId }: Props) {
  const { phases, selectedPhaseId, selectPhase } = usePlanningStore();
  const projectPhases = (phases[projectId] ?? []).slice().sort((a, b) => a.order - b.order);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '8px 12px', background: '#f8f9fa',
      borderRadius: 6, border: '1px solid #e0e0e0', flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 11, color: '#aaa', fontWeight: 700, letterSpacing: '0.05em' }}>START</span>

      {projectPhases.map((phase) => {
        const active = selectedPhaseId === phase.id;
        return (
          <span key={phase.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#ccc', fontSize: 14 }}>›</span>
            <button
              onClick={() => selectPhase(active ? null : phase.id)}
              title={phase.start_date && phase.end_date
                ? `${phase.start_date} → ${phase.end_date}`
                : undefined}
              style={{
                padding: '4px 14px',
                borderRadius: 20,
                border: `1px solid ${active ? '#4a9eff' : '#d0d7de'}`,
                background: active ? '#4a9eff' : 'white',
                color: active ? 'white' : '#444',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ color: active ? 'rgba(255,255,255,0.7)' : '#999', fontSize: 11, marginRight: 4 }}>
                {phase.order}.
              </span>
              {phase.title}
            </button>
          </span>
        );
      })}

      <span style={{ color: '#ccc', fontSize: 14 }}>›</span>
      <span style={{ fontSize: 11, color: '#aaa', fontWeight: 700, letterSpacing: '0.05em' }}>GOAL</span>

      {selectedPhaseId && (
        <button
          onClick={() => selectPhase(null)}
          style={{
            marginLeft: 'auto', fontSize: 11, color: '#888',
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
          }}
        >
          Show all phases
        </button>
      )}
    </div>
  );
}
