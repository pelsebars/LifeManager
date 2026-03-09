/**
 * Scheduling Engine
 *
 * Pure functions — no Express, no database imports.
 * Takes data in, returns computed results.
 * All load calculations and rescheduling logic live here.
 *
 * Key concept: effort ≠ duration.
 *   - effort: total work hours required for the task
 *   - duration_days: calendar days over which that effort is spread
 *   - daily_load = effort / duration_days  (hours per day this task contributes)
 */

export interface Task {
  id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  effort: number;     // total hours of work
  duration_days: number;
  progress_pct: number;
  status: string;
  deadline?: string | null;
  is_locked: boolean;
  dependencies: string[];
}

export interface DayProfile {
  day_type: 'workday' | 'weekend' | 'vacation';
  free_hours: number;
}

export interface DayOverride {
  date: string; // YYYY-MM-DD
  free_hours: number;
}

export interface LoadEntry {
  date: string;
  planned_hours: number;
  available_hours: number;
  /** 'green' | 'yellow' | 'red' */
  status: 'green' | 'yellow' | 'red';
}

/**
 * Compute the load bar entries for a date range.
 * Returns one entry per calendar day.
 */
export function computeLoad(
  tasks: Task[],
  dateRange: { start: string; end: string },
  defaultProfiles: Record<'workday' | 'weekend' | 'vacation', DayProfile>,
  overrides: DayOverride[] = []
): LoadEntry[] {
  const overrideMap = new Map(overrides.map((o) => [o.date, o.free_hours]));
  const days = eachDay(dateRange.start, dateRange.end);

  return days.map((date) => {
    const available = overrideMap.get(date) ?? getFreeHours(date, defaultProfiles);
    const planned = tasks
      .filter((t) => t.status !== 'completed' && t.status !== 'deferred')
      .filter((t) => date >= t.start_date && date <= t.end_date)
      .reduce((sum, t) => {
        const remaining = t.effort * (1 - t.progress_pct / 100);
        const dailyLoad = remaining / t.duration_days;
        return sum + dailyLoad;
      }, 0);

    const ratio = available > 0 ? planned / available : planned > 0 ? Infinity : 0;
    const status: LoadEntry['status'] =
      ratio <= 0.8 ? 'green' : ratio <= 1.0 ? 'yellow' : 'red';

    return { date, planned_hours: planned, available_hours: available, status };
  });
}

/**
 * Reschedule a task after slippage.
 * Preserves remaining effort, adjusts dates, respects deadline.
 */
export function rescheduleTask(
  task: Task,
  newStartDate: string
): { start_date: string; end_date: string; warning?: string } {
  const remainingEffort = task.effort * (1 - task.progress_pct / 100);
  // Maintain the same daily load rate: effort/duration_days stays constant
  const dailyRate = task.duration_days > 0 ? task.effort / task.duration_days : 1;
  const newDuration = Math.ceil(remainingEffort / dailyRate);
  const end = addDays(newStartDate, newDuration - 1);

  let warning: string | undefined;
  if (task.deadline && end > task.deadline) {
    warning = `Rescheduled end date ${end} exceeds deadline ${task.deadline}`;
  }

  return { start_date: newStartDate, end_date: end, warning };
}

/**
 * computeCascade — BL-18
 *
 * Given a task that just changed its dates, BFS through the dependency graph
 * and shift any dependent tasks forward so they start the day after their
 * prerequisite ends. Locked tasks are never moved.
 *
 * @param changedTaskId  The task whose end_date changed
 * @param taskMap        Mutable map of all tasks (will be updated in-place)
 * @returns              Array of {id, start_date, end_date} updates to apply to the DB
 */
export function computeCascade(
  changedTaskId: string,
  taskMap: Map<string, Task>,
): Array<{ id: string; start_date: string; end_date: string }> {
  // Build reverse-dependency index: taskId → [ids of tasks that depend on it]
  const dependentsOf = new Map<string, string[]>();
  for (const t of taskMap.values()) {
    for (const depId of t.dependencies) {
      if (!dependentsOf.has(depId)) dependentsOf.set(depId, []);
      dependentsOf.get(depId)!.push(t.id);
    }
  }

  const updates: Array<{ id: string; start_date: string; end_date: string }> = [];
  const queue = [changedTaskId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const tid = queue.shift()!;
    if (visited.has(tid)) continue;
    visited.add(tid);

    const task = taskMap.get(tid);
    if (!task) continue;

    for (const dependentId of (dependentsOf.get(tid) ?? [])) {
      const dep = taskMap.get(dependentId);
      if (!dep || dep.is_locked) continue;

      // Shift dependent forward if it starts on or before this task's end
      if (dep.start_date <= task.end_date) {
        const newStart = addDays(task.end_date, 1);
        const newEnd   = addDays(newStart, dep.duration_days - 1);
        const shifted  = { ...dep, start_date: newStart, end_date: newEnd };
        taskMap.set(dependentId, shifted);
        updates.push({ id: dependentId, start_date: newStart, end_date: newEnd });
        queue.push(dependentId);
      }
    }
  }

  return updates;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  const current = new Date(start);
  const last = new Date(end);
  while (current <= last) {
    days.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function addDays(date: string, n: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function getFreeHours(
  date: string,
  profiles: Record<'workday' | 'weekend' | 'vacation', DayProfile>
): number {
  const dow = new Date(date).getDay(); // 0=Sun, 6=Sat
  const type = dow === 0 || dow === 6 ? 'weekend' : 'workday';
  return profiles[type].free_hours;
}
