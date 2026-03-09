import { create } from 'zustand';
import { api } from '../api/client';
import type { Project, Phase, Task } from '../types';
import { DUMMY_PROJECTS, DUMMY_PHASES, DUMMY_TASKS } from '../data/dummy';

interface PlanningState {
  projects: Project[];
  phases: Record<string, Phase[]>;   // keyed by project_id
  tasks: Record<string, Task[]>;     // keyed by phase_id
  selectedProjectId: string | null;
  selectedPhaseId: string | null;
  loading: boolean;
  error: string | null;

  loadDummyData: () => void;
  loadProjects: () => Promise<void>;
  loadPhases: (projectId: string) => Promise<void>;
  loadTasks: (phaseId: string) => Promise<void>;
  selectProject: (id: string | null) => void;
  selectPhase: (id: string | null) => void;
  selectedTaskId: string | null;
  setSelectedTask: (id: string | null) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
}

export const usePlanningStore = create<PlanningState>((set, _get) => ({
  projects: [],
  phases: {},
  tasks: {},
  selectedProjectId: null,
  selectedPhaseId: null,
  selectedTaskId: null,
  loading: false,
  error: null,

  loadDummyData: () => {
    set({
      projects: DUMMY_PROJECTS,
      phases: DUMMY_PHASES,
      tasks: DUMMY_TASKS,
      loading: false,
      error: null,
    });
  },

  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await api.projects.list();
      set({ projects, loading: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  loadPhases: async (projectId) => {
    const phases = await api.phases.list(projectId);
    set((s) => ({ phases: { ...s.phases, [projectId]: phases } }));
  },

  loadTasks: async (phaseId) => {
    const tasks = await api.tasks.listByPhase(phaseId);
    set((s) => ({ tasks: { ...s.tasks, [phaseId]: tasks } }));
  },

  selectProject: (id) => set({ selectedProjectId: id, selectedPhaseId: null }),
  selectPhase: (id) => set({ selectedPhaseId: id }),
  setSelectedTask: (id) => set({ selectedTaskId: id }),

  // Optimistic update: applies to local state immediately so drag interactions
  // work without a running backend. BL-20 will make the API call the source of truth.
  updateTask: (id, patch) => {
    set((s) => {
      const newTasks = { ...s.tasks };
      for (const phaseId of Object.keys(newTasks)) {
        newTasks[phaseId] = newTasks[phaseId].map((t) => {
          if (t.id !== id) return t;
          const merged = { ...t, ...patch };
          // Keep end_date consistent whenever start_date or duration_days changes
          if ('start_date' in patch || 'duration_days' in patch) {
            const dt = new Date(merged.start_date);
            dt.setDate(dt.getDate() + merged.duration_days - 1);
            merged.end_date = dt.toISOString().slice(0, 10);
          }
          return merged;
        });
      }
      return { tasks: newTasks };
    });
    // BL-20: also persist to API once the backend is connected
    api.tasks.update(id, patch).catch(() => {});
  },
}));
