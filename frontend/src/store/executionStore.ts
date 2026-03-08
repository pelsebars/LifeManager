import { create } from 'zustand';
import { api } from '../api/client';
import type { Task } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ExecutionState {
  messages: Message[];
  todayTasks: Task[];
  loading: boolean;
  error: string | null;

  loadTodayTasks: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  resetStandup: () => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  messages: [],
  todayTasks: [],
  loading: false,
  error: null,

  loadTodayTasks: async () => {
    const today = new Date().toISOString().slice(0, 10);
    const tasks = await api.tasks.listByDate(today);
    set({ todayTasks: tasks as unknown as Task[] });
  },

  sendMessage: async (text) => {
    const userMsg: Message = { role: 'user', content: text };
    const history = [...get().messages, userMsg];
    set({ messages: history, loading: true, error: null });
    try {
      const { reply } = await api.assistant.standup({
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      });
      set({ messages: [...history, { role: 'assistant', content: reply }], loading: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  resetStandup: () => set({ messages: [], error: null }),
}));
