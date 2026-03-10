import { create } from 'zustand';
import { api } from '../api/client';
import type { TodayTask, SlippedTask } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ExecutionState {
  messages: Message[];
  todayTasks: TodayTask[];
  slippedTasks: SlippedTask[];
  completingIds: Set<string>;   // task IDs currently being saved
  loading: boolean;
  error: string | null;

  loadTodayTasks: () => Promise<void>;
  completeTodayTask: (taskId: string) => Promise<void>;
  applyReschedule: (taskId: string, newStartDate: string) => Promise<void>;
  dismissSlipped: (taskId: string) => void;
  sendMessage: (text: string) => Promise<void>;
  resetStandup: () => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  messages: [],
  todayTasks: [],
  slippedTasks: [],
  completingIds: new Set(),
  loading: false,
  error: null,

  // BL-21: load tasks crossing today's date line
  loadTodayTasks: async () => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const tasks = await api.tasks.listByDate(today);
      set({ todayTasks: tasks });
    } catch {
      // Backend not available (unauthenticated dev mode) — leave empty
    }
  },

  // BL-21 + BL-22: mark a task complete; cascade unblocks dependents via schedule/apply
  completeTodayTask: async (taskId) => {
    // Optimistic update
    set((s) => ({
      todayTasks: s.todayTasks.map((t) =>
        t.id === taskId ? { ...t, status: 'completed', progress_pct: 100 } : t
      ),
      completingIds: new Set([...s.completingIds, taskId]),
    }));
    try {
      // BL-22: schedule/apply runs computeCascade — dependent tasks get their
      // dates confirmed (shifted if they were blocked waiting on this task)
      await api.schedule.apply(taskId, { status: 'completed', progress_pct: 100 } as never);
    } finally {
      set((s) => {
        const ids = new Set(s.completingIds);
        ids.delete(taskId);
        return { completingIds: ids };
      });
    }
  },

  // BL-26: accept a reschedule proposal — applies the proposed dates to the task
  applyReschedule: async (taskId, newStartDate) => {
    set((s) => ({
      slippedTasks: s.slippedTasks.filter((t) => t.id !== taskId),
    }));
    try {
      await api.schedule.apply(taskId, { start_date: newStartDate } as never);
    } catch {
      // Silently ignore if backend not available
    }
  },

  // BL-26: dismiss a reschedule proposal without applying it
  dismissSlipped: (taskId) => {
    set((s) => ({
      slippedTasks: s.slippedTasks.filter((t) => t.id !== taskId),
    }));
  },

  sendMessage: async (text) => {
    const userMsg: Message = { role: 'user', content: text };
    const history = [...get().messages, userMsg];
    set({ messages: history, loading: true, error: null });
    try {
      const { reply, slippedTasks } = await api.assistant.standup({
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      });
      // BL-25: slipped tasks come back on first standup call; merge without duplicates
      set((s) => {
        const existingIds = new Set(s.slippedTasks.map((t) => t.id));
        const newSlipped = (slippedTasks ?? []).filter((t) => !existingIds.has(t.id));
        return {
          messages: [...history, { role: 'assistant', content: reply }],
          slippedTasks: [...s.slippedTasks, ...newSlipped],
          loading: false,
        };
      });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  resetStandup: () => set({ messages: [], slippedTasks: [], error: null }),
}));
