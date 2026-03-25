import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';

export const backlogRouter = Router();
backlogRouter.use(requireAuth);

// ─────────────────────────────────────────────────────────────────────────────
// Buckets
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/backlog/buckets
backlogRouter.get('/buckets', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT bb.*,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', bs.id, 'invitee_email', bs.invitee_email,
                  'status', bs.status, 'invitee_workspace_id', bs.invitee_workspace_id
                )
              ) FILTER (WHERE bs.id IS NOT NULL),
              '[]'
            ) AS shares
     FROM backlog_buckets bb
     LEFT JOIN backlog_shares bs ON bs.bucket_id = bb.id
     WHERE bb.workspace_id = $1
     GROUP BY bb.id
     ORDER BY bb.created_at`,
    [req.auth!.workspaceId],
  );
  res.json(rows);
});

// POST /api/backlog/buckets
backlogRouter.post('/buckets', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'name required' }); return; }
  const { rows: [bucket] } = await pool.query(
    `INSERT INTO backlog_buckets (workspace_id, name) VALUES ($1, $2) RETURNING *, '[]'::json AS shares`,
    [req.auth!.workspaceId, name.trim()],
  );
  res.status(201).json(bucket);
});

// PATCH /api/backlog/buckets/:id
backlogRouter.patch('/buckets/:id', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'name required' }); return; }
  const { rows: [bucket] } = await pool.query(
    `UPDATE backlog_buckets SET name = $2 WHERE id = $1 AND workspace_id = $3 RETURNING *`,
    [req.params.id, name.trim(), req.auth!.workspaceId],
  );
  if (!bucket) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(bucket);
});

// DELETE /api/backlog/buckets/:id
backlogRouter.delete('/buckets/:id', async (req, res) => {
  await pool.query(
    `DELETE FROM backlog_buckets WHERE id = $1 AND workspace_id = $2`,
    [req.params.id, req.auth!.workspaceId],
  );
  res.status(204).send();
});

// ─────────────────────────────────────────────────────────────────────────────
// Sharing (bucket level)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/backlog/shares  — share a specific bucket with someone by email
backlogRouter.post('/shares', async (req, res) => {
  const { bucket_id, email } = req.body;
  if (!bucket_id || !email?.trim()) {
    res.status(400).json({ error: 'bucket_id and email required' }); return;
  }

  // Verify the bucket belongs to the current workspace
  const { rows: [bucket] } = await pool.query(
    `SELECT id FROM backlog_buckets WHERE id = $1 AND workspace_id = $2`,
    [bucket_id, req.auth!.workspaceId],
  );
  if (!bucket) { res.status(404).json({ error: 'Bucket not found' }); return; }

  // Look up the invitee
  const { rows: [invitee] } = await pool.query(
    `SELECT id, workspace_id FROM users WHERE email = $1`,
    [email.trim().toLowerCase()],
  );

  // Prevent self-invite
  if (invitee?.workspace_id === req.auth!.workspaceId) {
    res.status(400).json({ error: 'Cannot share with yourself' }); return;
  }

  try {
    const { rows: [share] } = await pool.query(
      `INSERT INTO backlog_shares
         (bucket_id, owner_workspace_id, owner_user_id, invitee_email, invitee_workspace_id, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       ON CONFLICT (bucket_id, invitee_email)
         DO UPDATE SET status = 'pending', updated_at = NOW()
       RETURNING *`,
      [
        bucket_id,
        req.auth!.workspaceId,
        req.auth!.userId,
        email.trim().toLowerCase(),
        invitee?.workspace_id ?? null,
      ],
    );
    res.status(201).json(share);
  } catch {
    res.status(500).json({ error: 'Failed to create share' });
  }
});

// GET /api/backlog/shares/pending  — bucket invitations waiting for ME
backlogRouter.get('/shares/pending', async (req, res) => {
  const { rows: [me] } = await pool.query(
    `SELECT email FROM users WHERE id = $1`,
    [req.auth!.userId],
  );
  if (!me) { res.status(404).json({ error: 'User not found' }); return; }

  const { rows } = await pool.query(
    `SELECT bs.*, bb.name AS bucket_name,
            w.name AS owner_workspace_name, u.email AS owner_email
     FROM backlog_shares bs
     JOIN backlog_buckets bb ON bb.id = bs.bucket_id
     JOIN workspaces w ON w.id = bs.owner_workspace_id
     JOIN users u ON u.id = bs.owner_user_id
     WHERE bs.invitee_email = $1
       AND bs.status = 'pending'
     ORDER BY bs.created_at DESC`,
    [me.email],
  );
  res.json(rows);
});

// PUT /api/backlog/shares/:id/respond  — accept or reject
backlogRouter.put('/shares/:id/respond', async (req, res) => {
  const { accept } = req.body;
  if (typeof accept !== 'boolean') {
    res.status(400).json({ error: 'accept (boolean) required' }); return;
  }

  const { rows: [me] } = await pool.query(
    `SELECT email FROM users WHERE id = $1`,
    [req.auth!.userId],
  );

  const newStatus = accept ? 'accepted' : 'rejected';
  const { rows: [share] } = await pool.query(
    `UPDATE backlog_shares
     SET status = $2,
         invitee_workspace_id = CASE WHEN $2 = 'accepted' THEN $3 ELSE invitee_workspace_id END,
         updated_at = NOW()
     WHERE id = $1
       AND invitee_email = $4
       AND status = 'pending'
     RETURNING *`,
    [req.params.id, newStatus, req.auth!.workspaceId, me.email],
  );
  if (!share) { res.status(404).json({ error: 'Not found or not pending' }); return; }
  res.json(share);
});

// GET /api/backlog/shared  — all buckets shared with me (accepted)
backlogRouter.get('/shared', async (req, res) => {
  const { rows: shares } = await pool.query(
    `SELECT bs.id, bs.bucket_id, bs.owner_workspace_id, bs.owner_user_id,
            bs.invitee_email, bs.invitee_workspace_id, bs.status,
            bs.created_at, bs.updated_at,
            bb.name AS bucket_name,
            w.name AS owner_workspace_name, u.email AS owner_email
     FROM backlog_shares bs
     JOIN backlog_buckets bb ON bb.id = bs.bucket_id
     JOIN workspaces w ON w.id = bs.owner_workspace_id
     JOIN users u ON u.id = bs.owner_user_id
     WHERE bs.invitee_workspace_id = $1
       AND bs.status = 'accepted'`,
    [req.auth!.workspaceId],
  );

  // For each shared bucket, fetch its items
  const results = await Promise.all(shares.map(async (share) => {
    const { rows: items } = await pool.query(
      `SELECT bi.*, bb.name AS bucket_name
       FROM backlog_items bi
       LEFT JOIN backlog_buckets bb ON bb.id = bi.bucket_id
       WHERE bi.bucket_id = $1
       ORDER BY bi.created_at DESC`,
      [share.bucket_id],
    );
    return { share, items };
  }));

  res.json(results);
});

// DELETE /api/backlog/shared-item/:itemId  — remove item from a shared bucket (activate)
backlogRouter.delete('/shared-item/:itemId', async (req, res) => {
  const { rows: [item] } = await pool.query(
    `SELECT * FROM backlog_items WHERE id = $1`,
    [req.params.itemId],
  );
  if (!item) { res.status(404).json({ error: 'Item not found' }); return; }

  // Verify current user has accepted access to this specific bucket
  const { rows: [share] } = await pool.query(
    `SELECT id FROM backlog_shares
     WHERE bucket_id = $1
       AND invitee_workspace_id = $2
       AND status = 'accepted'`,
    [item.bucket_id, req.auth!.workspaceId],
  );
  if (!share) { res.status(403).json({ error: 'No access to this bucket' }); return; }

  await pool.query(`DELETE FROM backlog_items WHERE id = $1`, [req.params.itemId]);
  res.status(204).send();
});

// GET /api/backlog/shares/mine  — shares I have sent
backlogRouter.get('/shares/mine', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT bs.*, bb.name AS bucket_name
     FROM backlog_shares bs
     JOIN backlog_buckets bb ON bb.id = bs.bucket_id
     WHERE bs.owner_workspace_id = $1
     ORDER BY bb.name, bs.created_at DESC`,
    [req.auth!.workspaceId],
  );
  res.json(rows);
});

// DELETE /api/backlog/shares/:id  — revoke a share I created
backlogRouter.delete('/shares/:id', async (req, res) => {
  await pool.query(
    `DELETE FROM backlog_shares WHERE id = $1 AND owner_workspace_id = $2`,
    [req.params.id, req.auth!.workspaceId],
  );
  res.status(204).send();
});

// ─────────────────────────────────────────────────────────────────────────────
// Items
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/backlog
backlogRouter.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT bi.*, bb.name AS bucket_name
     FROM backlog_items bi
     LEFT JOIN backlog_buckets bb ON bb.id = bi.bucket_id
     WHERE bi.workspace_id = $1
     ORDER BY bi.created_at DESC`,
    [req.auth!.workspaceId],
  );
  res.json(rows);
});

// POST /api/backlog  — add to own backlog OR to a shared bucket
backlogRouter.post('/', async (req, res) => {
  const { title, description, category, effort, bucket_id, shared_bucket_id } = req.body;
  if (!title?.trim()) { res.status(400).json({ error: 'title required' }); return; }

  let targetWorkspaceId = req.auth!.workspaceId;
  let targetBucketId    = bucket_id ?? null;

  if (shared_bucket_id) {
    // Verify current user has accepted access to this shared bucket
    const { rows: [share] } = await pool.query(
      `SELECT bs.owner_workspace_id FROM backlog_shares bs
       WHERE bs.bucket_id = $1
         AND bs.invitee_workspace_id = $2
         AND bs.status = 'accepted'`,
      [shared_bucket_id, req.auth!.workspaceId],
    );
    if (!share) { res.status(403).json({ error: 'No access to this bucket' }); return; }
    targetWorkspaceId = share.owner_workspace_id;
    targetBucketId    = shared_bucket_id;
  }

  const { rows: [item] } = await pool.query(
    `INSERT INTO backlog_items (workspace_id, owner_id, bucket_id, title, description, category, effort)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [targetWorkspaceId, req.auth!.userId, targetBucketId, title.trim(), description ?? null, category ?? 'personal', effort ?? null],
  );
  res.status(201).json(item);
});

// PATCH /api/backlog/:id
backlogRouter.patch('/:id', async (req, res) => {
  const allowed = ['title', 'description', 'category', 'effort', 'bucket_id'];
  const entries = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (!entries.length) { res.status(400).json({ error: 'No valid fields' }); return; }

  const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  const vals = entries.map(([, v]) => v);
  const { rows: [item] } = await pool.query(
    `UPDATE backlog_items SET ${sets} WHERE id = $1 AND workspace_id = $${entries.length + 2} RETURNING *`,
    [req.params.id, ...vals, req.auth!.workspaceId],
  );
  if (!item) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(item);
});

// DELETE /api/backlog/:id
backlogRouter.delete('/:id', async (req, res) => {
  await pool.query(
    `DELETE FROM backlog_items WHERE id = $1 AND workspace_id = $2`,
    [req.params.id, req.auth!.workspaceId],
  );
  res.status(204).send();
});
