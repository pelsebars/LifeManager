import { create } from 'zustand';
import { api } from '../api/client';
import type { Project, Phase, Task, LoadEntry } from '../types';
import { DUMMY_PROJECTS, DUMMY_PHASES, DUMMY_TASKS } from '../data/dummy';

interface PlanningState {
  projects: Project[];
  phases: Record<string, Phase[]>;     // keyed by project_id
  tasks: Record<string, Task[]>;       // keyed by phase_id
  loadEntries: LoadEntry[];            // latest load bar values from API
  selectedProjectId: string | null;
  selectedPhaseId: string | null;
  selectedTaskId: string | null;
  loading: boolean;
  error: string | null;

  loadDummyData: () => void;
  loadProjects: () => Promise<void>;
  loadProjectTasks: (projectId: string) => Promise<void>;
  loadPhases: (projectId: string) => Promise<void>;
  loadTasks: (phaseId: string) => Promise<void>;
  selectProject: (id: string | null) => void;
  selectPhase: (id: string | null) => void;
  setSelectedTask: (id: string | null) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
}

export const usePlanningStore = create<PlanningState>((set, get) => ({
  projects: [],
  phases: {},
  tasks: {},
  loadEntries: [],
  selectedProjectId: null,
  selectedPhaseId: null,
  selectedTaskId: null,
  loading: false,
  error: null,

  // ── Sprint 2/3 dev: load static data without a backend ───────────────────
  loadDummyData: () => {
    set({ projects: DUMMY_PROJECTS, phases: DUMMY_PHASES, tasks: DUMMY_TASKS, loading: false, error: null });
  },

  // ── BL-19: load live data from API ───────────────────────────────────────

  // GET /api/projects returns projects with phases embedded
  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await api.projects.list();
      // Populate phases map from the embedded phases array on each project
      const phases: Record<string, Phase[]> = {};
      for (const p of projects) {
        if (p.phases) phases[p.id] = p.phases;
      }
      set({ projects, phases, loading: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  // Load tasks for all phases of a given project in parallel
  loadProjectTasks: async (projectId: string) => {
    const { phases } = get();
    const projectPhases = phases[projectId] ?? [];
    await Promise.all(
      projectPhases.map((ph) =>
        api.tasks.listByPhase(ph.id).then((phaseTasks) => {
          set((s) => ({ tasks: { ...s.tasks, [ph.id]: phaseTasks } }));
        }),
      ),
    );
  },

  loadPhases: async (projectId) => {
    const phasesData = await api.phases.list(projectId);
    set((s) => ({ phases: { ...s.phases, [projectId]: phasesData } }));
  },

  loadTasks: async (phaseId) => {
    const tasksData = await api.tasks.listByPhase(phaseId);
    set((s) => ({ tasks: { ...s.tasks, [phaseId]: tasksData } }));
  },

  selectProject: (id) => set({ selectedProjectId: id, selectedPhaseId: null }),
  selectPhase:   (id) => set({ selectedPhaseId: id }),
  setSelectedTask: (id) => set({ selectedTaskId: id }),

  // ── BL-20: persist changes via schedule/apply, apply cascade ─────────────
  updateTask: (id, patch) => {
    // 1. Optimistic local update — keeps drag interactions snappy
    set((s) => {
      const newTasks = { ...s.tasks };
      for (const phaseId of Object.keys(newTasks)) {
        newTasks[phaseId] = newTasks[phaseId].map((t) => {
          if (t.id !== id) return t;
          const merged = { ...t, ...patch };
          // Keep end_date consistent with start_date + duration_days
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

    // 2. Persist + get cascade from the scheduling engine endpoint
    api.schedule.apply(id, patch).then(({ task, cascade, loadEntries }) => {
      set((s) => {
        const newTasks = { ...s.tasks };
        // Apply definitive DB state for the changed task + any cascaded tasks
        for (const t of [task, ...cascade]) {
          if (!t) continue;
          for (const phaseId of Object.keys(newTasks)) {
            newTasks[phaseId] = newTasks[phaseId].map((existing) =>
              existing.id === t.id ? { ...existing, ...t } : existing,
            );
          }
        }
        return { tasks: newTasks, loadEntries };
      });
    }).catch(() => {
      // Backend not running — optimistic state stands (fine for local dev)
    });
  },
}));
