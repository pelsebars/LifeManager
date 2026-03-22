-- ─────────────────────────────────────────
-- Backlog buckets  (BL-47)
-- Named groups like "Renovation project", "Side project ideas", etc.
-- ─────────────────────────────────────────
CREATE TABLE backlog_buckets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX backlog_buckets_workspace_idx ON backlog_buckets(workspace_id);

CREATE TRIGGER backlog_buckets_updated_at BEFORE UPDATE ON backlog_buckets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────
-- Backlog items  (BL-45)
-- Tasks you want to do "eventually" – not yet on the Gantt.
-- ─────────────────────────────────────────
CREATE TYPE task_category AS ENUM ('work', 'personal');

CREATE TABLE backlog_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_id      UUID NOT NULL REFERENCES users(id),
  bucket_id     UUID REFERENCES backlog_buckets(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  category      task_category NOT NULL DEFAULT 'personal',
  effort        DECIMAL(6,2),        -- optional estimated hours
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX backlog_items_workspace_idx ON backlog_items(workspace_id);
CREATE INDEX backlog_items_bucket_idx    ON backlog_items(bucket_id);

CREATE TRIGGER backlog_items_updated_at BEFORE UPDATE ON backlog_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
