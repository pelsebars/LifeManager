/**
 * useLoadCalculation
 *
 * Derives the daily load bar data from the current task and day profile state.
 * This is the frontend mirror of the backend schedulingEngine.computeLoad.
 * Used by the LoadBar component for immediate local recalculation (no round-trip needed).
 */

import { useMemo } from 'react';
import type { Task, DayProfile, LoadEntry } from '../types';

const DEFAULT_PROFILES: Record<string, number> = {
  workday: 3,
  weekend: 6,
  vacation: 8,
};

export function useLoadCalculation(
  tasks: Task[],
  dayProfiles: DayProfile[],
  windowDays = 45
): LoadEntry[] {
  return useMemo(() => {
    const profileMap: Record<string, number> = { ...DEFAULT_PROFILES };
    for (const p of dayProfiles) {
      profileMap[p.day_type] = p.free_hours;
    }

    const days: string[] = [];
    const start = new Date();
    start.setDate(start.getDate() - 7);
    for (let i = 0; i < windowDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }

    return days.map((date) => {
      const dow = new Date(date).getDay();
      const dayType = dow === 0 || dow === 6 ? 'weekend' : 'workday';
      const available = profileMap[dayType] ?? 3;

      const planned = tasks
        .filter((t) => t.status !== 'completed' && t.status !== 'deferred')
        .filter((t) => date >= t.start_date && date <= t.end_date)
        .reduce((sum, t) => {
          const remaining = t.effort * (1 - t.progress_pct / 100);
          return sum + remaining / t.duration_days;
        }, 0);

      const ratio = available > 0 ? planned / available : 0;
      const status: LoadEntry['status'] = ratio <= 0.8 ? 'green' : ratio <= 1.0 ? 'yellow' : 'red';
      return { date, planned_hours: planned, available_hours: available, status };
    });
  }, [tasks, dayProfiles, windowDays]);
}
