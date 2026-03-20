import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';

export const routinesRouter = Router();
routinesRouter.use(requireAuth);

// GET /api/routines — list all routines with their occurrences for the next 60 days
routinesRouter.get('/', async (req, res) => {
  const workspaceId = req.auth!.workspaceId;
  const { rows } = await pool.query(
    `SELECT r.*,
       COALESCE(
         json_agg(ro.date::text ORDER BY ro.date) FILTER (WHERE ro.date IS NOT NULL),
         '[]'
       ) AS occurrences
     FROM routines r
     LEFT JOIN routine_occurrences ro
       ON ro.routine_id = r.id AND ro.date >= CURRENT_DATE - 14
     WHERE r.workspace_id = $1
     GROUP BY r.id
     ORDER BY r.created_at`,
    [workspaceId],
  );
  res.json(rows);
});

// POST /api/routines — create a routine
routinesRouter.post('/', async (req, res) => {
  const { name, category, effort_hours } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return; }
  const { rows: [routine] } = await pool.query(
    `INSERT INTO routines (workspace_id, name, category, effort_hours)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.auth!.workspaceId, name.trim(), category ?? 'personal', effort_hours ?? 1.0],
  );
  res.status(201).json({ ...routine, occurrences: [] });
});

// DELETE /api/routines/:id
routinesRouter.delete('/:id', async (req, res) => {
  await pool.query(
    'DELETE FROM routines WHERE id = $1 AND workspace_id = $2',
    [req.params.id, req.auth!.workspaceId],
  );
  res.status(204).send();
});

// POST /api/routines/:id/occurrences — toggle an occurrence date on/off
routinesRouter.post('/:id/occurrences', async (req, res) => {
  const { date } = req.body;
  if (!date) { res.status(400).json({ error: 'date is required' }); return; }
  const workspaceId = req.auth!.workspaceId;

  // Verify the routine belongs to this workspace
  const { rows: [routine] } = await pool.query(
    'SELECT id FROM routines WHERE id = $1 AND workspace_id = $2',
    [req.params.id, workspaceId],
  );
  if (!routine) { res.status(404).json({ error: 'Routine not found' }); return; }

  // Toggle: insert or delete
  const { rows: [existing] } = await pool.query(
    'SELECT id FROM routine_occurrences WHERE routine_id = $1 AND date = $2',
    [req.params.id, date],
  );

  if (existing) {
    await pool.query('DELETE FROM routine_occurrences WHERE id = $1', [existing.id]);
    res.json({ date, active: false });
  } else {
    await pool.query(
      'INSERT INTO routine_occurrences (routine_id, date) VALUES ($1, $2)',
      [req.params.id, date],
    );
    res.json({ date, active: true });
  }
});
