import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

// GET /api/projects
projectsRouter.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*,
       json_agg(ph ORDER BY ph."order") FILTER (WHERE ph.id IS NOT NULL) AS phases
     FROM projects p
     LEFT JOIN phases ph ON ph.project_id = p.id
     WHERE p.workspace_id = $1
     GROUP BY p.id
     ORDER BY p.start_date`,
    [req.auth!.workspaceId]
  );
  res.json(rows);
});

// GET /api/projects/:id
projectsRouter.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM projects WHERE id = $1 AND workspace_id = $2',
    [req.params.id, req.auth!.workspaceId]
  );
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(rows[0]);
});

// POST /api/projects
projectsRouter.post('/', async (req, res) => {
  const { title, description, start_date, target_end_date } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO projects (workspace_id, owner_id, title, description, start_date, target_end_date)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.auth!.workspaceId, req.auth!.userId, title, description ?? null, start_date, target_end_date]
  );
  res.status(201).json(rows[0]);
});

// PATCH /api/projects/:id
projectsRouter.patch('/:id', async (req, res) => {
  const allowed = ['title', 'description', 'start_date', 'target_end_date', 'status'];
  const updates = Object.entries(req.body)
    .filter(([k]) => allowed.includes(k))
    .map(([k, v], i) => `${k} = $${i + 3}` );
  if (!updates.length) { res.status(400).json({ error: 'No valid fields to update' }); return; }
  const values = Object.entries(req.body)
    .filter(([k]) => allowed.includes(k))
    .map(([, v]) => v);
  const { rows } = await pool.query(
    `UPDATE projects SET ${updates.join(', ')} WHERE id = $1 AND workspace_id = $2 RETURNING *`,
    [req.params.id, req.auth!.workspaceId, ...values]
  );
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(rows[0]);
});

// DELETE /api/projects/:id
projectsRouter.delete('/:id', async (req, res) => {
  await pool.query(
    'DELETE FROM projects WHERE id = $1 AND workspace_id = $2',
    [req.params.id, req.auth!.workspaceId]
  );
  res.status(204).send();
});
