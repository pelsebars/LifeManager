-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- Workspaces
-- ─────────────────────────────────────────
CREATE TABLE workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- Users
-- ─────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('owner', 'editor', 'viewer');

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           user_role NOT NULL DEFAULT 'owner',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX users_workspace_idx ON users(workspace_id);

-- ─────────────────────────────────────────
-- Projects
-- ─────────────────────────────────────────
CREATE TYPE project_status AS ENUM ('active', 'completed', 'archived');

CREATE TABLE projects (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_id         UUID NOT NULL REFERENCES users(id),
  title            TEXT NOT NULL,
  description      TEXT,
  start_date       DATE NOT NULL,
  target_end_date  DATE NOT NULL,
  status           project_status NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX projects_workspace_idx ON projects(workspace_id);

-- ─────────────────────────────────────────
-- Phases
-- ─────────────────────────────────────────
CREATE TABLE phases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  "order"     INTEGER NOT NULL DEFAULT 0,
  start_date  DATE,
  end_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX phases_project_idx ON phases(project_id);

-- ─────────────────────────────────────────
-- Tasks
-- ─────────────────────────────────────────
CREATE TYPE task_status AS ENUM ('not_started', 'in_progress', 'completed', 'deferred');

CREATE TABLE tasks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id       UUID NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  owner_id       UUID NOT NULL REFERENCES users(id),
  title          TEXT NOT NULL,
  description    TEXT,
  -- effort is the actual work hours required (NOT the same as duration)
  effort         DECIMAL(6,2) NOT NULL DEFAULT 1.0,
  -- duration_days is calendar days the task spans (effort is spread across these days)
  duration_days  INTEGER NOT NULL DEFAULT 1,
  start_date     DATE NOT NULL,
  -- end_date is derived: start_date + duration_days - 1, stored for query convenience
  end_date       DATE NOT NULL,
  deadline       DATE,
  is_locked      BOOLEAN NOT NULL DEFAULT FALSE,
  progress_pct   INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  status         task_status NOT NULL DEFAULT 'not_started',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX tasks_phase_idx ON tasks(phase_id);
CREATE INDEX tasks_owner_idx ON tasks(owner_id);
CREATE INDEX tasks_date_range_idx ON tasks(start_date, end_date);

-- Task dependencies (many-to-many: a task can depend on multiple tasks)
CREATE TABLE task_dependencies (
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_id)
);

-- ─────────────────────────────────────────
-- Day Profiles (capacity model)
-- ─────────────────────────────────────────
CREATE TYPE day_type AS ENUM ('workday', 'weekend', 'vacation');

CREATE TABLE day_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  day_type        day_type NOT NULL,
  work_hours      DECIMAL(4,2) NOT NULL DEFAULT 8.0,
  commute_hours   DECIMAL(4,2) NOT NULL DEFAULT 1.0,
  free_hours      DECIMAL(4,2) NOT NULL DEFAULT 3.0,
  UNIQUE (workspace_id, day_type)
);

-- Per-day capacity overrides (deferred in MVP UI, but schema is in place)
CREATE TABLE day_overrides (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  work_hours     DECIMAL(4,2),
  commute_hours  DECIMAL(4,2),
  free_hours     DECIMAL(4,2),
  UNIQUE (workspace_id, date)
);

-- ─────────────────────────────────────────
-- updated_at auto-update trigger
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER phases_updated_at BEFORE UPDATE ON phases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
