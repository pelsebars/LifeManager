import { useMemo } from 'react';
import { usePlanningStore } from '../../store/planningStore';
import type { Task, LoadEntry } from '../../types';

interface Props {
  projectId: string;
}

const DEFAULT_FREE_HOURS = { workday: 3, weekend: 6, vacation: 8 };

function computeLoad(tasks: Task[], days: string[]): LoadEntry[] {
  return days.map((date) => {
    const dow = new Date(date).getDay();
    const dayType = dow === 0 || dow === 6 ? 'weekend' : 'workday';
    const available = DEFAULT_FREE_HOURS[dayType];

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
}

const STATUS_COLORS = { green: '#4caf50', yellow: '#ff9800', red: '#f44336' };

export function LoadBar({ projectId }: Props) {
  const { phases, tasks } = usePlanningStore();
  const projectPhases = phases[projectId] ?? [];
  const allTasks: Task[] = projectPhases.flatMap((ph) => tasks[ph.id] ?? []);

  const days = useMemo(() => {
    const result: string[] = [];
    const start = new Date();
    start.setDate(start.getDate() - 7);
    for (let i = 0; i < 45; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      result.push(d.toISOString().slice(0, 10));
    }
    return result;
  }, []);

  const loadEntries = useMemo(() => computeLoad(allTasks, days), [allTasks, days]);

  return (
    <div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 600 }}>CAPACITY LOAD (next 45 days)</div>
      <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden', border: '1px solid #e0e0e0' }}>
        {loadEntries.map((entry) => (
          <div
            key={entry.date}
            title={`${entry.date}: ${entry.planned_hours.toFixed(1)}h planned / ${entry.available_hours}h available`}
            style={{
              flex: 1,
              background: STATUS_COLORS[entry.status],
              opacity: entry.planned_hours === 0 ? 0.15 : 0.85,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '1rem', marginTop: 4, fontSize: 11, color: '#666' }}>
        <span><span style={{ color: STATUS_COLORS.green }}>■</span> Under capacity</span>
        <span><span style={{ color: STATUS_COLORS.yellow }}>■</span> Tight</span>
        <span><span style={{ color: STATUS_COLORS.red }}>■</span> Overloaded</span>
      </div>
    </div>
  );
}
