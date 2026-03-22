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

// POST /api/backlog
backlogRouter.post('/', async (req, res) => {
  const { title, description, category, effort, bucket_id } = req.body;
  if (!title?.trim()) { res.status(400).json({ error: 'title required' }); return; }
  const { rows: [item] } = await pool.query(
    `INSERT INTO backlog_items (workspace_id, owner_id, bucket_id, title, description, category, effort)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      req.auth!.workspaceId,
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
