import { useEffect } from 'react';
import { usePlanningStore } from '../../store/planningStore';
import { PhaseRibbon } from './PhaseRibbon';
import { GanttChart } from './GanttChart';
import { LoadBar } from './LoadBar';
import { TaskDetailPanel } from './TaskDetailPanel';

export function PlanningView() {
  const {
    projects, selectedProjectId, phases, tasks,
    loadDummyData, selectProject,
    selectedTaskId, setSelectedTask, updateTask,
  } = usePlanningStore();

  // BL-19 will replace this with loadProjects() once the API is connected
  useEffect(() => { loadDummyData(); }, [loadDummyData]);

  // Resolve the selected task object + its phase reference label
  const selectedTask = selectedTaskId
    ? Object.values(tasks).flat().find((t) => t.id === selectedTaskId) ?? null
    : null;

  const phaseRef = (() => {
    if (!selectedTask || !selectedProjectId) return '';
    const projectPhases = (phases[selectedProjectId] ?? [])
      .slice().sort((a, b) => a.order - b.order);
    for (const ph of projectPhases) {
      const phaseTasks = (tasks[ph.id] ?? [])
        .slice().sort((a, b) => a.start_date.localeCompare(b.start_date));
      const idx = phaseTasks.findIndex((t) => t.id === selectedTask.id);
      if (idx !== -1) {
        return `${ph.order}${String.fromCharCode(65 + idx)}`;
      }
    }
    return '';
  })();

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

      {/* BL-16: Task detail panel — rendered at this level to avoid Gantt overflow clipping */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          phaseRef={phaseRef}
          onSave={(id, patch) => { updateTask(id, patch); setSelectedTask(null); }}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
