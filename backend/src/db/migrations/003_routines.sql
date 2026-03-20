-- BL-42: Routines — recurring commitments that consume capacity
CREATE TABLE IF NOT EXISTS routines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  category      VARCHAR(20) NOT NULL DEFAULT 'personal'
                  CHECK (category IN ('work', 'personal')),
  effort_hours  NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routine_occurrences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id  UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (routine_id, date)
);

CREATE INDEX IF NOT EXISTS routine_occurrences_date_idx ON routine_occurrences (date);
