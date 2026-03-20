import { create } from 'zustand';
import { api } from '../api/client';
import type { Routine } from '../types';

interface RoutineState {
  routines: Routine[];
  loaded: boolean;
  load: () => Promise<void>;
  create: (data: { name: string; category: string; effort_hours: number }) => Promise<void>;
  delete: (id: string) => Promise<void>;
  toggleOccurrence: (routineId: string, date: string) => Promise<void>;
}

export const useRoutineStore = create<RoutineState>((set) => ({
  routines: [],
  loaded: false,

  load: async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const routines = await api.routines.list();
      set({ routines, loaded: true });
    } catch {
      // backend unavailable — stay empty
    }
  },

  create: async (data) => {
    const routine = await api.routines.create(data);
    set((s) => ({ routines: [...s.routines, routine] }));
  },

  delete: async (id) => {
    await api.routines.delete(id);
    set((s) => ({ routines: s.routines.filter((r) => r.id !== id) }));
  },

  toggleOccurrence: async (routineId, date) => {
    const { active } = await api.routines.toggleOccurrence(routineId, date);
    set((s) => ({
      routines: s.routines.map((r) => {
        if (r.id !== routineId) return r;
        const occs = active
          ? [...r.occurrences.filter((d) => d !== date), date].sort()
          : r.occurrences.filter((d) => d !== date);
        return { ...r, occurrences: occs };
      }),
    }));
  },
}));
