import { create } from 'zustand';
import { api } from '../api/client';
import type { Project, Phase, Task, DayProfile, LoadEntry } from '../types';
import { DUMMY_PROJECTS, DUMMY_PHASES, DUMMY_TASKS, DUMMY_DAY_PROFILES } from '../data/dummy';

interface PlanningState {
  projects: Project[];
  phases: Record<string, Phase[]>;     // keyed by project_id
  tasks: Record<string, Task[]>;       // keyed by phase_id
  dayProfiles: DayProfile[];           // workday / weekend / vacation capacity
  loadEntries: LoadEntry[];            // latest load bar values from API
  selectedProjectId: string | null;
  selectedPhaseId: string | null;
  selectedTaskId: string | null;
  loading: boolean;
  error: string | null;
  expandedProjects: Set<string>;

  loadDummyData: () => void;
  loadProjects: () => Promise<void>;
  loadProjectTasks: (projectId: string) => Promise<void>;
  loadPhases: (projectId: string) => Promise<void>;
  loadTasks: (phaseId: string) => Promise<void>;
  loadDayProfiles: () => Promise<void>;
  saveDayProfile: (dayType: string, body: { work_hours: number; commute_hours: number; free_hours: number }) => Promise<void>;
  selectProject: (id: string | null) => void;
  selectPhase: (id: string | null) => void;
  setSelectedTask: (id: string | null) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  createTask: (data: { phase_id: string; title: string; effort: number; duration_days: number; start_date: string; deadline: string | null; is_locked: boolean; dependencies: string[]; category: 'work' | 'personal' }) => Promise<void>;
  deleteTask: (id: string, phaseId: string) => Promise<void>;
  toggleProject: (id: string) => void;
  createProject: (data: { title: string; description: string; start_date: string; target_end_date: string }) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  createPhase: (data: { project_id: string; title: string; order: number }) => Promise<Phase>;
  updatePhase: (id: string, patch: Partial<Phase>) => Promise<void>;
  deletePhase: (id: string) => Promise<void>;
}

function loadExpandedFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem('lm_expanded_projects');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set<string>(arr);
    }
  } catch {
    // ignore parse errors
  }
  return new Set<string>();
}

export const usePlanningStore = create<PlanningState>((set, get) => ({
  projects: [],
  phases: {},
  tasks: {},
  dayProfiles: DUMMY_DAY_PROFILES,   // sensible defaults until API data loads
  loadEntries: [],
  selectedProjectId: null,
  selectedPhaseId: null,
  selectedTaskId: null,
  loading: false,
  error: null,
  expandedProjects: loadExpandedFromStorage(),

  // ── Sprint 2/3 dev: load static data without a backend ───────────────────
  loadDummyData: () => {
    const expandedProjects = new Set<string>(DUMMY_PROJECTS.map((p) => p.id));
    localStorage.setItem('lm_expanded_projects', JSON.stringify([...expandedProjects]));
    set({ projects: DUMMY_PROJECTS, phases: DUMMY_PHASES, tasks: DUMMY_TASKS, dayProfiles: DUMMY_DAY_PROFILES, loading: false, error: null, expandedProjects });
  },

  // ── BL-19: load live data from API ───────────────────────────────────────

  // GET /api/projects returns projects with phases embedded.
  // Also pre-loads tasks for every project so the load bar reflects full life load.
  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await api.projects.list();
      const phases: Record<string, Phase[]> = {};
      for (const p of projects) {
        if (p.phases) phases[p.id] = p.phases;
      }
      // Auto-expand all loaded projects (merge with any already-expanded from localStorage)
      const expanded = new Set<string>([...get().expandedProjects, ...projects.map((p) => p.id)]);
      localStorage.setItem('lm_expanded_projects', JSON.stringify([...expanded]));
      set({ projects, phases, loading: false, expandedProjects: expanded });

      // Load tasks for ALL projects in parallel — load bar needs the full picture
      const allPhases = Object.values(phases).flat();
      await Promise.all(
        allPhases.map((ph) =>
          api.tasks.listByPhase(ph.id).then((phaseTasks) => {
            set((s) => ({ tasks: { ...s.tasks, [ph.id]: phaseTasks } }));
          }),
        ),
      );
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  // Still available for refreshing a single project's tasks (e.g. after edits)
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

  // BL-27/28: load and save day profiles
  loadDayProfiles: async () => {
    try {
      const profiles = await api.dayProfiles.list();
      if (profiles.length > 0) set({ dayProfiles: profiles });
    } catch {
      // Backend not available — keep DUMMY defaults
    }
  },

  saveDayProfile: async (dayType, body) => {
    if (localStorage.getItem('token')) {
      const saved = await api.dayProfiles.upsert(dayType, body);
      set((s) => ({
        dayProfiles: s.dayProfiles.map((p) => p.day_type === dayType ? saved : p),
      }));
    } else {
      // Offline / demo mode — update local state directly
      set((s) => ({
        dayProfiles: s.dayProfiles.map((p) =>
          p.day_type === dayType
            ? { ...p, ...body }
            : p
        ),
      }));
    }
  },

  selectProject: (id) => set({ selectedProjectId: id, selectedPhaseId: null }),
  selectPhase:   (id) => set({ selectedPhaseId: id }),
  setSelectedTask: (id) => set({ selectedTaskId: id }),

  createTask: async (data) => {
    let task: Task;
    if (localStorage.getItem('token')) {
      task = await api.tasks.create({ ...data, progress_pct: 0, status: 'not_started' });
    } else {
      // Dummy / offline mode — create locally with a generated id
      const now = new Date().toISOString();
      const end = new Date(data.start_date);
      end.setDate(end.getDate() + data.duration_days - 1);
      task = {
        id: `task-${Date.now()}`,
        phase_id: data.phase_id,
        owner_id: 'user-demo',
        title: data.title,
        description: '',
        category: data.category,
        effort: data.effort,
        duration_days: data.duration_days,
        start_date: data.start_date,
        end_date: end.toISOString().slice(0, 10),
        deadline: data.deadline,
        is_locked: data.is_locked,
        progress_pct: 0,
        status: 'not_started',
        dependencies: data.dependencies,
        created_at: now,
        updated_at: now,
      };
    }
    set((s) => ({
      tasks: {
        ...s.tasks,
        [data.phase_id]: [...(s.tasks[data.phase_id] ?? []), task],
      },
    }));
  },

  toggleProject: (id) => {
    const next = new Set(get().expandedProjects);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    localStorage.setItem('lm_expanded_projects', JSON.stringify([...next]));
    set({ expandedProjects: next });
  },

  // BL-35: create a new project
  createProject: async (data) => {
    let project: Project;
    if (localStorage.getItem('token')) {
      project = await api.projects.create({ ...data, status: 'active' });
    } else {
      const now = new Date().toISOString();
      project = {
        id: `proj-${Date.now()}`,
        title: data.title,
        description: data.description,
        start_date: data.start_date,
        target_end_date: data.target_end_date,
        status: 'active',
        owner_id: 'user-demo',
        workspace_id: 'ws-demo',
        created_at: now,
        updated_at: now,
        phases: [],
      };
    }
    set((s) => {
      const expanded = new Set<string>([...s.expandedProjects, project.id]);
      localStorage.setItem('lm_expanded_projects', JSON.stringify([...expanded]));
      return {
        projects: [...s.projects, project],
        phases: { ...s.phases, [project.id]: [] },
        expandedProjects: expanded,
      };
    });
  },

  // BL-36: delete a project
  deleteProject: async (id) => {
    if (localStorage.getItem('token')) {
      await api.projects.delete(id);
    }
    set((s) => {
      const newPhases = { ...s.phases };
      const newTasks  = { ...s.tasks };
      const projectPhases = newPhases[id] ?? [];
      for (const ph of projectPhases) delete newTasks[ph.id];
      delete newPhases[id];
      const next = new Set(s.expandedProjects);
      next.delete(id);
      return {
        projects: s.projects.filter((p) => p.id !== id),
        phases: newPhases,
        tasks: newTasks,
        expandedProjects: next,
      };
    });
  },

  deleteTask: async (id, phaseId) => {
    if (localStorage.getItem('token')) await api.tasks.delete(id);
    set((s) => ({
      tasks: { ...s.tasks, [phaseId]: (s.tasks[phaseId] ?? []).filter((t) => t.id !== id) },
    }));
  },

  createPhase: async (data) => {
    let phase: Phase;
    if (localStorage.getItem('token')) {
      phase = await api.phases.create(data);
    } else {
      const now = new Date().toISOString();
      phase = {
        id: `phase-${Date.now()}`,
        project_id: data.project_id,
        title: data.title,
        order: data.order,
        start_date: undefined,
        end_date: undefined,
        created_at: now,
        updated_at: now,
      };
    }
    set((s) => ({ phases: { ...s.phases, [data.project_id]: [...(s.phases[data.project_id] ?? []), phase] } }));
    return phase;
  },

  updatePhase: async (id, patch) => {
    if (localStorage.getItem('token')) await api.phases.update(id, patch);
    set((s) => {
      const newPhases = { ...s.phases };
      for (const pid of Object.keys(newPhases)) {
        newPhases[pid] = newPhases[pid].map((ph) => ph.id === id ? { ...ph, ...patch } : ph);
      }
      return { phases: newPhases };
    });
  },

  deletePhase: async (id) => {
    if (localStorage.getItem('token')) await api.phases.delete(id);
    set((s) => {
      const newPhases = { ...s.phases };
      const newTasks = { ...s.tasks };
      delete newTasks[id];
      for (const pid of Object.keys(newPhases)) {
        newPhases[pid] = newPhases[pid].filter((ph) => ph.id !== id);
      }
      return { phases: newPhases, tasks: newTasks };
    });
  },

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
