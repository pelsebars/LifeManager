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
    `SELECT * FROM backlog_buckets WHERE workspace_id = $1 ORDER BY created_at`,
    [req.auth!.workspaceId],
  );
  res.json(rows);
});

// POST /api/backlog/buckets
backlogRouter.post('/buckets', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'name required' }); return; }
  const { rows: [bucket] } = await pool.query(
    `INSERT INTO backlog_buckets (workspace_id, name) VALUES ($1, $2) RETURNING *`,
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
// Sharing
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/backlog/shares  — invite someone by email
backlogRouter.post('/shares', async (req, res) => {
  const { email } = req.body;
  if (!email?.trim()) { res.status(400).json({ error: 'email required' }); return; }

  // Look up whether the invitee already has an account
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
         (owner_workspace_id, owner_user_id, invitee_email, invitee_workspace_id, status)
       VALUES ($1, $2, $3, $4, 'pending')
       ON CONFLICT (owner_workspace_id, invitee_email)
         DO UPDATE SET status = 'pending', updated_at = NOW()
       RETURNING *`,
      [
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

// GET /api/backlog/shares/pending  — invitations waiting for ME to respond
backlogRouter.get('/shares/pending', async (req, res) => {
  // Find the current user's email
  const { rows: [me] } = await pool.query(
    `SELECT email FROM users WHERE id = $1`,
    [req.auth!.userId],
  );
  if (!me) { res.status(404).json({ error: 'User not found' }); return; }

  const { rows } = await pool.query(
    `SELECT bs.*, w.name AS owner_workspace_name, u.email AS owner_email
     FROM backlog_shares bs
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

// GET /api/backlog/shared  — all backlogs shared with me (accepted)
backlogRouter.get('/shared', async (req, res) => {
  // Find accepted shares where I am the invitee
  const { rows: shares } = await pool.query(
    `SELECT bs.id, bs.owner_workspace_id, bs.owner_user_id,
            bs.invitee_email, bs.invitee_workspace_id, bs.status,
            bs.created_at, bs.updated_at,
            w.name AS owner_workspace_name, u.email AS owner_email
     FROM backlog_shares bs
     JOIN workspaces w ON w.id = bs.owner_workspace_id
     JOIN users u ON u.id = bs.owner_user_id
     WHERE bs.invitee_workspace_id = $1
       AND bs.status = 'accepted'`,
    [req.auth!.workspaceId],
  );

  // For each shared workspace, fetch their buckets and items
  const results = await Promise.all(shares.map(async (share) => {
    const [{ rows: buckets }, { rows: items }] = await Promise.all([
      pool.query(
        `SELECT * FROM backlog_buckets WHERE workspace_id = $1 ORDER BY created_at`,
        [share.owner_workspace_id],
      ),
      pool.query(
        `SELECT bi.*, bb.name AS bucket_name
         FROM backlog_items bi
         LEFT JOIN backlog_buckets bb ON bb.id = bi.bucket_id
         WHERE bi.workspace_id = $1
         ORDER BY bi.created_at DESC`,
        [share.owner_workspace_id],
      ),
    ]);
    return { share, buckets, items };
  }));

  res.json(results);
});

// DELETE /api/backlog/shared-item/:itemId  — remove item from a shared backlog (activate)
// Only allowed if the current user has an accepted share from the item's owner
backlogRouter.delete('/shared-item/:itemId', async (req, res) => {
  // Verify the item exists and find its workspace
  const { rows: [item] } = await pool.query(
    `SELECT * FROM backlog_items WHERE id = $1`,
    [req.params.itemId],
  );
  if (!item) { res.status(404).json({ error: 'Item not found' }); return; }

  // Check the current user has accepted access to that workspace's backlog
  const { rows: [share] } = await pool.query(
    `SELECT id FROM backlog_shares
     WHERE owner_workspace_id = $1
       AND invitee_workspace_id = $2
       AND status = 'accepted'`,
    [item.workspace_id, req.auth!.workspaceId],
  );
  if (!share) { res.status(403).json({ error: 'No access to this backlog' }); return; }

  await pool.query(`DELETE FROM backlog_items WHERE id = $1`, [req.params.itemId]);
  res.status(204).send();
});

// GET /api/backlog/shares/mine  — shares I have sent (so I can see who I've invited)
backlogRouter.get('/shares/mine', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT bs.*, u.email AS owner_email
     FROM backlog_shares bs
     JOIN users u ON u.id = bs.owner_user_id
     WHERE bs.owner_workspace_id = $1
     ORDER BY bs.created_at DESC`,
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

// POST /api/backlog  — add to own backlog OR to a shared backlog
// If shared_workspace_id is provided, adds to that workspace's backlog (must have accepted share)
backlogRouter.post('/', async (req, res) => {
  const { title, description, category, effort, bucket_id, shared_workspace_id } = req.body;
  if (!title?.trim()) { res.status(400).json({ error: 'title required' }); return; }

  let targetWorkspaceId = req.auth!.workspaceId;

  if (shared_workspace_id) {
    // Verify current user has accepted access to this shared workspace's backlog
    const { rows: [share] } = await pool.query(
      `SELECT id FROM backlog_shares
       WHERE owner_workspace_id = $1
         AND invitee_workspace_id = $2
         AND status = 'accepted'`,
      [shared_workspace_id, req.auth!.workspaceId],
    );
    if (!share) { res.status(403).json({ error: 'No access to this backlog' }); return; }
    targetWorkspaceId = shared_workspace_id;
  }

  const { rows: [item] } = await pool.query(
    `INSERT INTO backlog_items (workspace_id, owner_id, bucket_id, title, description, category, effort)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      targetWorkspaceId,
      req.auth!.userId,
      bucket_id ?? null,
      title.trim(),
      description ?? null,
      category ?? 'personal',
      effort ?? null,
    ],
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
