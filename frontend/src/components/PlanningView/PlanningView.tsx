import { useEffect } from 'react';
import { usePlanningStore } from '../../store/planningStore';
import { PhaseRibbon } from './PhaseRibbon';
import { GanttChart } from './GanttChart';
import { LoadBar } from './LoadBar';
import { TaskDetailPanel } from './TaskDetailPanel';

export function PlanningView() {
  const {
    projects, selectedProjectId, phases, tasks,
    loading, error,
    loadDummyData, loadProjects, loadProjectTasks,
    selectProject,
    selectedTaskId, setSelectedTask, updateTask,
  } = usePlanningStore();

  // BL-19: use live API when authenticated, fall back to dummy data for dev
  const hasToken = !!localStorage.getItem('token');
  useEffect(() => {
    if (hasToken) {
      loadProjects();
    } else {
      loadDummyData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken]);

  // When a project is selected, load its tasks (phases already populated by loadProjects)
  useEffect(() => {
    if (selectedProjectId) {
      if (hasToken) {
        loadProjectTasks(selectedProjectId);
      }
      // Dummy data already has tasks pre-loaded — nothing to do
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  // Resolve the selected task + its phase reference label for the detail panel
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
      if (idx !== -1) return `${ph.order}${String.fromCharCode(65 + idx)}`;
    }
    return '';
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem', gap: '0.75rem' }}>

      {/* Project selector */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <label htmlFor="project-select" style={{ fontWeight: 600, fontSize: 13 }}>Project:</label>
        <select
          id="project-select"
          value={selectedProjectId ?? ''}
          onChange={(e) => selectProject(e.target.value || null)}
          style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid #ccc', fontSize: 13, minWidth: 240 }}
        >
          <option value="">— select a project —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
        {loading && <span style={{ fontSize: 12, color: '#888' }}>Loading…</span>}
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', borderRadius: 5, padding: '6px 10px' }}>
          {error}
        </div>
      )}

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

      {!selectedProjectId && !loading && (
        <div style={{ color: '#888', marginTop: '3rem', textAlign: 'center', fontSize: 14 }}>
          Select a project above to view its timeline.
        </div>
      )}

      {/* BL-16: Task detail panel — at this level to avoid Gantt overflow clipping */}
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
