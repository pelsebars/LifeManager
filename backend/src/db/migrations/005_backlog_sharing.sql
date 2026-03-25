-- ─────────────────────────────────────────
-- Backlog sharing
-- A workspace owner can invite another user (by email) to share their backlog.
-- The invitee sees the shared backlog and can add items or activate them as tasks.
-- ─────────────────────────────────────────

CREATE TABLE backlog_shares (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_user_id         UUID NOT NULL REFERENCES users(id),
  invitee_email         TEXT NOT NULL,
  invitee_workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- prevent duplicate invites from the same workspace to the same email
  UNIQUE (owner_workspace_id, invitee_email)
);

CREATE INDEX backlog_shares_owner_idx      ON backlog_shares(owner_workspace_id);
CREATE INDEX backlog_shares_invitee_email  ON backlog_shares(invitee_email);
CREATE INDEX backlog_shares_invitee_ws     ON backlog_shares(invitee_workspace_id);

CREATE TRIGGER backlog_shares_updated_at BEFORE UPDATE ON backlog_shares
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
