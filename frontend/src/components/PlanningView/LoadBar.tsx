/**
 * LoadBar — Layer 3 of the Planning View.
 *
 * BL-11: Colour-coded capacity bar beneath the Gantt on the same date axis.
 *   Green  = load ≤ 80% of available free hours
 *   Yellow = load between 80–100%
 *   Red    = overloaded
 *
 * Calculation: for each day, sum (remaining effort / duration_days) across all
 * tasks that span that day, and compare to free_hours from the day profile.
 */

import { useMemo } from 'react';
import { usePlanningStore } from '../../store/planningStore';
import type { Task, DayProfile, LoadEntry } from '../../types';

interface Props {
  projectId: string;
}

const STATUS_COLOR: Record<LoadEntry['status'], string> = {
  green:  '#4caf50',
  yellow: '#ff9800',
  red:    '#ef4444',
};

function getDayType(dateStr: string): 'workday' | 'weekend' {
  const dow = new Date(dateStr).getDay(); // 0=Sun, 6=Sat
  return dow === 0 || dow === 6 ? 'weekend' : 'workday';
}

function computeLoad(tasks: Task[], days: string[], profiles: DayProfile[]): LoadEntry[] {
  // BL-28: use user-defined (or dummy fallback) day profiles
  const profileMap: Record<string, number> = {};
  for (const p of profiles) {
    profileMap[p.day_type] = p.free_hours;
  }

  return days.map((date) => {
    const dayType = getDayType(date);
    const available = profileMap[dayType] ?? 3;

    const planned = tasks
      .filter((t) => t.status !== 'completed' && t.status !== 'deferred')
      .filter((t) => date >= t.start_date && date <= t.end_date)
      .reduce((sum, t) => {
        const remaining = t.effort * (1 - t.progress_pct / 100);
        return sum + remaining / t.duration_days;
      }, 0);

    const ratio = available > 0 ? planned / available : (planned > 0 ? Infinity : 0);
    const status: LoadEntry['status'] =
      ratio <= 0.8 ? 'green' : ratio <= 1.0 ? 'yellow' : 'red';

    return { date, planned_hours: planned, available_hours: available, status };
  });
}

// Build 45 days starting 10 days ago (matches default Gantt window)
const WINDOW_START_OFFSET = -10;
const WINDOW_DAYS = 45;

export function LoadBar({ projectId }: Props) {
  const { phases, tasks, dayProfiles } = usePlanningStore();
  const projectPhases = phases[projectId] ?? [];
  const allTasks: Task[] = projectPhases.flatMap((ph) => tasks[ph.id] ?? []);

  const days = useMemo(() => {
    const result: string[] = [];
    const base = new Date();
    base.setDate(base.getDate() + WINDOW_START_OFFSET);
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      result.push(d.toISOString().slice(0, 10));
    }
    return result;
  }, []);

  const entries = useMemo(() => computeLoad(allTasks, days, dayProfiles), [allTasks, days, dayProfiles]);

  const overloadedDays = entries.filter((e) => e.status === 'red').length;
  const tightDays = entries.filter((e) => e.status === 'yellow').length;

  return (
    <div style={{ userSelect: 'none' }}>
      {/* Header row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 10, color: '#999', fontWeight: 700, letterSpacing: '0.06em' }}>
          CAPACITY LOAD — NEXT {WINDOW_DAYS} DAYS
        </span>
        <span style={{ fontSize: 11, color: '#888' }}>
          {overloadedDays > 0 && (
            <span style={{ color: '#ef4444', marginRight: 8 }}>
              ⚠ {overloadedDays} overloaded {overloadedDays === 1 ? 'day' : 'days'}
            </span>
          )}
          {tightDays > 0 && (
            <span style={{ color: '#ff9800' }}>
              {tightDays} tight {tightDays === 1 ? 'day' : 'days'}
            </span>
          )}
        </span>
      </div>

      {/* Bar */}
      <div style={{
        display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden',
        border: '1px solid #e0e0e0',
      }}>
        {entries.map((entry) => (
          <div
            key={entry.date}
            title={`${entry.date}  ${entry.planned_hours.toFixed(1)}h planned / ${entry.available_hours}h available`}
            style={{
              flex: 1,
              background: STATUS_COLOR[entry.status],
              opacity: entry.planned_hours < 0.05 ? 0.12 : 0.8,
            }}
          />
        ))}
      </div>

      {/* Legend + date labels */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginTop: 4,
      }}>
        <div style={{ display: 'flex', gap: '1rem', fontSize: 11, color: '#777' }}>
          <span><span style={{ color: STATUS_COLOR.green }}>■</span> Under capacity</span>
          <span><span style={{ color: STATUS_COLOR.yellow }}>■</span> Tight</span>
          <span><span style={{ color: STATUS_COLOR.red }}>■</span> Overloaded</span>
        </div>
        <div style={{ fontSize: 10, color: '#aaa' }}>
          {days[0]} – {days[days.length - 1]}
        </div>
      </div>
    </div>
  );
}
