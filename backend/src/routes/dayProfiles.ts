import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';

export const dayProfilesRouter = Router();
dayProfilesRouter.use(requireAuth);

dayProfilesRouter.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM day_profiles WHERE workspace_id = $1',
    [req.auth!.workspaceId]
  );
  res.json(rows);
});

dayProfilesRouter.put('/:dayType', async (req, res) => {
  const { work_hours, commute_hours, free_hours } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO day_profiles (workspace_id, day_type, work_hours, commute_hours, free_hours)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (workspace_id, day_type) DO UPDATE
       SET work_hours = EXCLUDED.work_hours,
           commute_hours = EXCLUDED.commute_hours,
           free_hours = EXCLUDED.free_hours
     RETURNING *`,
    [req.auth!.workspaceId, req.params.dayType, work_hours, commute_hours, free_hours]
  );
  res.json(rows[0]);
});
