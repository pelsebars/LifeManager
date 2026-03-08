import React, { useEffect } from 'react';
import { usePlanningStore } from '../../store/planningStore';

interface Props {
  projectId: string;
}

export function PhaseRibbon({ projectId }: Props) {
  const { phases, selectedPhaseId, loadPhases, selectPhase } = usePlanningStore();
  const projectPhases = phases[projectId] ?? [];

  useEffect(() => { loadPhases(projectId); }, [projectId, loadPhases]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: '#f8f9fa', borderRadius: 6, border: '1px solid #e0e0e0', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>START</span>
      {projectPhases.map((phase) => (
        <React.Fragment key={phase.id}>
          <span style={{ color: '#888' }}>→</span>
          <button
            onClick={() => selectPhase(selectedPhaseId === phase.id ? null : phase.id)}
            style={{
              padding: '4px 12px',
              borderRadius: 16,
              border: '1px solid #4a9eff',
              background: selectedPhaseId === phase.id ? '#4a9eff' : 'white',
              color: selectedPhaseId === phase.id ? 'white' : '#4a9eff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {phase.title}
          </button>
        </React.Fragment>
      ))}
      <span style={{ color: '#888' }}>→</span>
      <span style={{ fontSize: 12, color: '#888', fontWeight: 600 }}>GOAL</span>
    </div>
  );
}
