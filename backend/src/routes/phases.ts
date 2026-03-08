import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';

export const phasesRouter = Router();
phasesRouter.use(requireAuth);

// GET /api/phases?project_id=...
phasesRouter.get('/', async (req, res) => {
  const { project_id } = req.query;
  const { rows } = await pool.query(
    `SELECT ph.* FROM phases ph
     JOIN projects p ON p.id = ph.project_id
     WHERE ph.project_id = $1 AND p.workspace_id = $2
     ORDER BY ph."order"`,
    [project_id, req.auth!.workspaceId]
  );
  res.json(rows);
});

// POST /api/phases
phasesRouter.post('/', async (req, res) => {
  const { project_id, title, order, start_date, end_date } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO phases (project_id, title, "order", start_date, end_date)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [project_id, title, order ?? 0, start_date ?? null, end_date ?? null]
  );
  res.status(201).json(rows[0]);
});

// PATCH /api/phases/:id
phasesRouter.patch('/:id', async (req, res) => {
  const allowed = ['title', 'order', 'start_date', 'end_date'];
  const entries = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (!entries.length) { res.status(400).json({ error: 'No valid fields' }); return; }
  const sets = entries.map(([k], i) => `"${k}" = $${i + 2}`).join(', ');
  const vals = entries.map(([, v]) => v);
  const { rows } = await pool.query(
    `UPDATE phases SET ${sets} WHERE id = $1 RETURNING *`,
    [req.params.id, ...vals]
  );
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(rows[0]);
});

// DELETE /api/phases/:id
phasesRouter.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM phases WHERE id = $1', [req.params.id]);
  res.status(204).send();
});
