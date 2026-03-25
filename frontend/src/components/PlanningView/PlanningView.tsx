import { useEffect, useState, useMemo } from 'react';
import { usePlanningStore } from '../../store/planningStore';
import { useRoutineStore } from '../../store/routineStore';
import moment from 'moment';
import { GanttChart } from './GanttChart';

const DEFAULT_VISIBLE_START = moment().subtract(10, 'days').valueOf();
const DEFAULT_VISIBLE_END   = moment().add(35, 'days').valueOf();
import { LoadBar } from './LoadBar';
import { TaskDetailPanel } from './TaskDetailPanel';
import { EditPhasePanel } from './EditPhasePanel';
import type { TaskOptionGroup } from './TaskDetailPanel';
import type { Phase } from '../../types';

export function PlanningView() {
  const [visibleTime, setVisibleTime] = useState({
    start: DEFAULT_VISIBLE_START,
    end:   DEFAULT_VISIBLE_END,
    canvasWidth: 0,
  });

  const [addingToProjectId, setAddingToProjectId] = useState<string | null>(null);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);

  const {
    projects, phases, tasks,
    loading, error,
    loadDummyData, loadProjects, loadDayProfiles,
    selectedTaskId, setSelectedTask, updateTask, createTask, deleteTask,
    createPhase, updatePhase, deletePhase,
  } = usePlanningStore();

  // Helper: find the phase_id that contains a given task
  const findPhaseId = (taskId: string): string => {
    for (const [phaseId, phaseTasks] of Object.entries(tasks)) {
      if (phaseTasks.some((t) => t.id === taskId)) return phaseId;
    }
    return '';
  };

  // BL-34: handle "Add Phase" from the Gantt popup menu
  const handleAddPhase = async (projectId: string) => {
    const title = window.prompt('New phase name:');
    if (!title?.trim()) return;
    const projectPhases = phases[projectId] ?? [];
    const nextOrder = projectPhases.length > 0 ? Math.max(...projectPhases.map((p) => p.order)) + 1 : 1;
    await createPhase({ project_id: projectId, title: title.trim(), order: nextOrder });
  };

  // Build grouped task options for dependency selectors (all projects → phases → tasks)
  const taskOptionGroups = useMemo<TaskOptionGroup[]>(() => {
    const groups: TaskOptionGroup[] = [];
    for (const project of projects) {
      const projectPhases = (phases[project.id] ?? []).slice().sort((a, b) => a.order - b.order);
      for (const ph of projectPhases) {
        const phaseTasks = (tasks[ph.id] ?? []).slice().sort((a, b) => a.start_date.localeCompare(b.start_date));
        if (phaseTasks.length === 0) continue;
        groups.push({
          groupLabel: `${project.title} › ${ph.title}`,
          options: phaseTasks.map((t) => ({ id: t.id, label: t.title })),
        });
      }
    }
    return groups;
  }, [projects, phases, tasks]);

  // BL-19: use live API when authenticated, fall back to dummy data for dev
  const hasToken = !!localStorage.getItem('token');
  const loadRoutines = useRoutineStore((s) => s.load);

  useEffect(() => {
    if (hasToken) {
      loadProjects();
      loadDayProfiles();
      loadRoutines();
    } else {
      loadDummyData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken]);

  // Resolve the selected task + its phase reference label for the detail panel
  const selectedTask = selectedTaskId
    ? Object.values(tasks).flat().find((t) => t.id === selectedTaskId) ?? null
    : null;

  const phaseRef = (() => {
    if (!selectedTask) return '';
    // Search all phases across all projects for the one containing selectedTask
    for (const projectPhases of Object.values(phases)) {
      const sorted = projectPhases.slice().sort((a, b) => a.order - b.order);
      for (const ph of sorted) {
        const phaseTasks = (tasks[ph.id] ?? [])
          .slice().sort((a, b) => a.start_date.localeCompare(b.start_date));
        const idx = phaseTasks.findIndex((t) => t.id === selectedTask.id);
        if (idx !== -1) return `${ph.order}${String.fromCharCode(65 + idx)}`;
      }
    }
    return '';
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem', gap: '0.75rem' }}>

      {loading && <span style={{ fontSize: 12, color: '#888' }}>Loading…</span>}

      {error && (
        <div style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', borderRadius: 5, padding: '6px 10px' }}>
          {error}
        </div>
      )}

      {/* Layer 2 — Gantt (all projects, scrolls vertically when expanded) */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 6 }}>
        <GanttChart
          onVisibleTimeChange={(s, e, w) => setVisibleTime({ start: s, end: e, canvasWidth: w })}
          onAddTask={(projectId) => setAddingToProjectId(projectId)}
          onAddPhase={handleAddPhase}
          onEditPhase={(phase) => setEditingPhase(phase)}
        />
      </div>

      {/* Layer 3 — Load Bar */}
      <LoadBar
        visibleTimeStart={visibleTime.start}
        visibleTimeEnd={visibleTime.end}
        ganttCanvasWidth={visibleTime.canvasWidth || undefined}
      />

      {/* Task detail panel (edit) */}
      {selectedTask && (() => {
        // Find project that owns this task, then get all its phases
        const ownerPhaseId = findPhaseId(selectedTask.id);
        const ownerProjectId = Object.entries(phases).find(([, phs]) =>
          phs.some((ph) => ph.id === ownerPhaseId)
        )?.[0] ?? '';
        const allPhasesForProject = (phases[ownerProjectId] ?? [])
          .slice().sort((a, b) => a.order - b.order);
        return (
          <TaskDetailPanel
            task={selectedTask}
            phaseRef={phaseRef}
            phases={allPhasesForProject}
            taskOptionGroups={taskOptionGroups}
            onSave={(id, patch) => { updateTask(id, patch); setSelectedTask(null); }}
            onDelete={(id) => { deleteTask(id, findPhaseId(id)); setSelectedTask(null); }}
            onClose={() => setSelectedTask(null)}
          />
        );
      })()}

      {/* Create task panel */}
      {addingToProjectId && (() => {
        const projectPhases = (phases[addingToProjectId] ?? [])
          .slice().sort((a, b) => a.order - b.order);
        return (
          <TaskDetailPanel
            mode="create"
            phases={projectPhases}
            taskOptionGroups={taskOptionGroups}
            onCreate={async (data) => { await createTask(data); setAddingToProjectId(null); }}
            onClose={() => setAddingToProjectId(null)}
          />
        );
      })()}

      {/* BL-38/39/40: Edit phase panel */}
      {editingPhase && (
        <EditPhasePanel
          phase={editingPhase}
          onSave={(id, patch) => { updatePhase(id, patch); setEditingPhase(null); }}
          onDelete={(id) => { deletePhase(id); setEditingPhase(null); }}
          onClose={() => setEditingPhase(null)}
        />
      )}
    </div>
  );
}
