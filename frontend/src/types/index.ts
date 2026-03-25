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
export type TaskCategory = 'work' | 'personal';

export interface Task {
  id: string;
  phase_id: string;
  owner_id: string;
  title: string;
  description?: string;
  category: TaskCategory;   // which capacity pool this draws from
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

export interface Routine {
  id: string;
  workspace_id: string;
  name: string;
  category: TaskCategory;
  effort_hours: number;
  occurrences: string[];  // YYYY-MM-DD dates loaded from API
  created_at: string;
  updated_at: string;
}

/** Task enriched with phase/project context — returned by GET /api/tasks?date=... */
export interface TodayTask extends Task {
  phase_title: string;
  project_title: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backlog (BL-45, BL-46, BL-47)
// ─────────────────────────────────────────────────────────────────────────────

/** A minimal share record embedded in a bucket (for the bucket list endpoint) */
export interface BucketShareSummary {
  id: string;
  invitee_email: string;
  status: 'pending' | 'accepted' | 'rejected';
  invitee_workspace_id: string | null;
}

export interface BacklogBucket {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  shares: BucketShareSummary[];  // shares I have created for this bucket
}

export interface BacklogItem {
  id: string;
  workspace_id: string;
  owner_id: string;
  bucket_id: string | null;
  bucket_name: string | null;   // joined from backlog_buckets
  title: string;
  description?: string;
  category: TaskCategory;
  effort: number | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Backlog sharing
// ─────────────────────────────────────────────────────────────────────────────

export interface BacklogShare {
  id: string;
  bucket_id: string;
  bucket_name: string;           // joined from backlog_buckets
  owner_workspace_id: string;
  owner_user_id: string;
  owner_email: string;
  owner_workspace_name: string;
  invitee_email: string;
  invitee_workspace_id: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

/** A single shared bucket as returned by GET /api/backlog/shared */
export interface SharedBacklog {
  share: BacklogShare;   // includes bucket_id + bucket_name
  items: BacklogItem[];
}

/** Slipped task with a proposed reschedule — returned by POST /api/assistant/standup */
export interface SlippedTask {
  id: string;
  title: string;
  phase_title: string;
  project_title: string;
  original_end: string;
  proposed_start_date: string;
  proposed_end_date: string;
  warning?: string;
}
