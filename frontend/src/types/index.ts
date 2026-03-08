// ─────────────────────────────────────────────────────────────────────────────
// Core domain types — mirror the database schema exactly.
// ─────────────────────────────────────────────────────────────────────────────

export type ProjectStatus = 'active' | 'completed' | 'archived';
export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'deferred';
export type DayType = 'workday' | 'weekend' | 'vacation';
export type UserRole = 'owner' | 'editor' | 'viewer';

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

export interface User {
  id: string;
  workspace_id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  owner_id: string;
  title: string;
  description?: string;
  start_date: string;       // YYYY-MM-DD
  target_end_date: string;  // YYYY-MM-DD
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  phases?: Phase[];
}

export interface Phase {
  id: string;
  project_id: string;
  title: string;
  order: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

/**
 * effort: total work hours required for this task
 * duration_days: calendar days the task spans
 *
 * These are DIFFERENT. A task can have 2h effort spread over 10 days.
 * Daily load contribution = effort / duration_days.
 */
export interface Task {
  id: string;
  phase_id: string;
  owner_id: string;
  title: string;
  description?: string;
  effort: number;           // total hours of work required
  duration_days: number;    // calendar days the task occupies
  start_date: string;       // YYYY-MM-DD
  end_date: string;         // YYYY-MM-DD  (= start_date + duration_days - 1)
  deadline?: string | null; // YYYY-MM-DD  hard constraint date
  is_locked: boolean;       // true = cannot drag end past deadline
  progress_pct: number;     // 0–100
  status: TaskStatus;
  dependencies: string[];   // task IDs that must complete first
  created_at: string;
  updated_at: string;
}

export interface DayProfile {
  id: string;
  workspace_id: string;
  day_type: DayType;
  work_hours: number;
  commute_hours: number;
  free_hours: number;
}

export interface LoadEntry {
  date: string;
  planned_hours: number;
  available_hours: number;
  status: 'green' | 'yellow' | 'red';
}
