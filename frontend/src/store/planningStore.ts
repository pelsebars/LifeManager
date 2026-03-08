import { create } from 'zustand';
import { api } from '../api/client';
import type { Project, Phase, Task } from '../types';

interface PlanningState {
  projects: Project[];
  phases: Record<string, Phase[]>;   // keyed by project_id
  tasks: Record<string, Task[]>;     // keyed by phase_id
  selectedProjectId: string | null;
  selectedPhaseId: string | null;
  loading: boolean;
  error: string | null;

  loadProjects: () => Promise<void>;
  loadPhases: (projectId: string) => Promise<void>;
  loadTasks: (phaseId: string) => Promise<void>;
  selectProject: (id: string | null) => void;
  selectPhase: (id: string | null) => void;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
}

export const usePlanningStore = create<PlanningState>((set, _get) => ({
  projects: [],
  phases: {},
  tasks: {},
  selectedProjectId: null,
  selectedPhaseId: null,
  loading: false,
  error: null,

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

  updateTask: async (id, patch) => {
    const updated = await api.tasks.update(id, patch);
    set((s) => {
      const newTasks = { ...s.tasks };
      for (const phaseId of Object.keys(newTasks)) {
        newTasks[phaseId] = newTasks[phaseId].map((t) => (t.id === id ? { ...t, ...updated } : t));
      }
      return { tasks: newTasks };
    });
  },
}));
