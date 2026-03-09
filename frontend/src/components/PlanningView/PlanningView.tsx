import { useEffect } from 'react';
import { usePlanningStore } from '../../store/planningStore';
import { PhaseRibbon } from './PhaseRibbon';
import { GanttChart } from './GanttChart';
import { LoadBar } from './LoadBar';

export function PlanningView() {
  const { projects, selectedProjectId, loadDummyData, selectProject } = usePlanningStore();

  // BL-19 will replace this with loadProjects() once the API is connected
  useEffect(() => { loadDummyData(); }, [loadDummyData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem', gap: '0.75rem' }}>
      {/* Project selector */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <label htmlFor="project-select"><strong>Project:</strong></label>
        <select
          id="project-select"
          value={selectedProjectId ?? ''}
          onChange={(e) => selectProject(e.target.value || null)}
          style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
        >
          <option value="">— select a project —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      {selectedProjectId && (
        <>
          {/* Layer 1 — Phase Ribbon */}
          <PhaseRibbon projectId={selectedProjectId} />

          {/* Layer 2 — Gantt */}
          <div style={{ flex: 1, overflow: 'hidden', border: '1px solid #e0e0e0', borderRadius: 6 }}>
            <GanttChart projectId={selectedProjectId} />
          </div>

          {/* Layer 3 — Load Bar */}
          <LoadBar projectId={selectedProjectId} />
        </>
      )}

      {!selectedProjectId && (
        <div style={{ color: '#888', marginTop: '2rem', textAlign: 'center' }}>
          Select a project to view its timeline.
        </div>
      )}
    </div>
  );
}
