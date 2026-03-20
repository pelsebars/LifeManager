-- BL-41: Add category to tasks (work vs personal)
-- Existing tasks default to 'personal' (personal/life tasks)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'personal'
    CHECK (category IN ('work', 'personal'));
