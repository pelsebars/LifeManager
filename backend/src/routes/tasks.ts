import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

// GET /api/tasks?phase_id=... OR ?date=YYYY-MM-DD (today's tasks)
tasksRouter.get('/', async (req, res) => {
  const { phase_id, date } = req.query;
  if (phase_id) {
    const { rows } = await pool.query(
      `SELECT t.*,
         COALESCE(json_agg(td.depends_on_id) FILTER (WHERE td.depends_on_id IS NOT NULL), '[]') AS dependencies
       FROM tasks t
       LEFT JOIN task_dependencies td ON td.task_id = t.id
       WHERE t.phase_id = $1
       GROUP BY t.id
       ORDER BY t.start_date`,
      [phase_id]
    );
    res.json(rows);
  } else if (date) {
    const { rows } = await pool.query(
      `SELECT t.*,
         COALESCE(json_agg(td.depends_on_id) FILTER (WHERE td.depends_on_id IS NOT NULL), '[]') AS dependencies
       FROM tasks t
       JOIN phases ph ON ph.id = t.phase_id
       JOIN projects p ON p.id = ph.project_id
       LEFT JOIN task_dependencies td ON td.task_id = t.id
       WHERE p.workspace_id = $1 AND $2::date BETWEEN t.start_date AND t.end_date
       GROUP BY t.id
       ORDER BY t.start_date`,
      [req.auth!.workspaceId, date]
    );
    res.json(rows);
  } else {
    res.status(400).json({ error: 'phase_id or date query param required' });
  }
});

// POST /api/tasks
tasksRouter.post('/', async (req, res) => {
  const { phase_id, title, description, effort, duration_days, start_date, deadline, is_locked, owner_id, dependencies } = req.body;
  const end_date = computeEndDate(start_date, duration_days);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [task] } = await client.query(
      `INSERT INTO tasks (phase_id, owner_id, title, description, effort, duration_days, start_date, end_date, deadline, is_locked)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [phase_id, owner_id ?? req.auth!.userId, title, description ?? null, effort ?? 1, duration_days ?? 1, start_date, end_date, deadline ?? null, is_locked ?? false]
    );
    if (dependencies?.length) {
      for (const depId of dependencies) {
        await client.query(
          'INSERT INTO task_dependencies (task_id, depends_on_id) VALUES ($1, $2)',
          [task.id, depId]
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ ...task, dependencies: dependencies ?? [] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to create task' });
  } finally {
    client.release();
  }
});

// PATCH /api/tasks/:id
tasksRouter.patch('/:id', async (req, res) => {
  const allowed = ['title', 'description', 'effort', 'duration_days', 'start_date', 'deadline', 'is_locked', 'progress_pct', 'status'];
  const entries = Object.entries(req.body).filter(([k]) => allowed.includes(k));

  // Recompute end_date if start_date or duration_days changes
  const updates: Record<string, unknown> = Object.fromEntries(entries);
  if ('start_date' in updates || 'duration_days' in updates) {
    const { rows: [current] } = await pool.query('SELECT start_date, duration_days FROM tasks WHERE id = $1', [req.params.id]);
    const start = (updates.start_date as string) ?? current.start_date;
    const dur = (updates.duration_days as number) ?? current.duration_days;
    updates.end_date = computeEndDate(start, dur);
  }

  const finalEntries = Object.entries(updates);
  if (!finalEntries.length) { res.status(400).json({ error: 'No valid fields' }); return; }
  const sets = finalEntries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  const vals = finalEntries.map(([, v]) => v);
  const { rows } = await pool.query(
    `UPDATE tasks SET ${sets} WHERE id = $1 RETURNING *`,
    [req.params.id, ...vals]
  );
  if (!rows[0]) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(rows[0]);
});

// DELETE /api/tasks/:id
tasksRouter.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
  res.status(204).send();
});

function computeEndDate(startDate: string, durationDays: number): string {
  const d = new Date(startDate);
  d.setDate(d.getDate() + durationDays - 1);
  return d.toISOString().slice(0, 10);
}
