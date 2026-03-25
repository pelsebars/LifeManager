-- ─────────────────────────────────────────
-- Redesign backlog sharing to bucket level.
-- Drop and recreate backlog_shares with bucket_id as the unit of sharing.
-- Safe: migration 005 was deployed but sharing is not yet in use.
-- ─────────────────────────────────────────

DROP TABLE IF EXISTS backlog_shares;

CREATE TABLE backlog_shares (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id             UUID NOT NULL REFERENCES backlog_buckets(id) ON DELETE CASCADE,
  owner_workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_user_id         UUID NOT NULL REFERENCES users(id),
  invitee_email         TEXT NOT NULL,
  invitee_workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bucket_id, invitee_email)
);

CREATE INDEX backlog_shares_bucket_idx     ON backlog_shares(bucket_id);
CREATE INDEX backlog_shares_owner_idx      ON backlog_shares(owner_workspace_id);
CREATE INDEX backlog_shares_invitee_email  ON backlog_shares(invitee_email);
CREATE INDEX backlog_shares_invitee_ws     ON backlog_shares(invitee_workspace_id);

CREATE TRIGGER backlog_shares_updated_at BEFORE UPDATE ON backlog_shares
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
