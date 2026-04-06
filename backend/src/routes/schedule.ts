/**
 * POST /api/schedule/apply — BL-18
 *
 * Single endpoint that handles all task mutations that affect the timeline:
 *   - Drag-to-move  (start_date changes)
 *   - Drag-to-stretch (duration_days changes)
 *   - Progress update (progress_pct changes)
 *   - Status change
 *
 * Flow:
 *   1. Apply the patch to the task (recomputing end_date as needed)
 *   2. Fetch all active workspace tasks
 *   3. Run computeCascade — shift dependents that now start too early
 *   4. Write all cascaded updates to DB (in the same transaction)
 *   5. Compute load bar for the next 45-day window
 *   6. Return { task, cascade, loadEntries }
 */

import { Router } from 'express';
import { pool } from '../db/pool';
import { requireAuth } from '../middleware/auth';
import { computeCascade, computeLoad, type Task, type DayProfile } from '../services/schedulingEngine';

export const scheduleRouter = Router();
scheduleRouter.use(requireAuth);

// ── helpers ──────────────────────────────────────────────────────────────────

function offsetDate(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const DEFAULT_PROFILES: Record<'workday' | 'weekend' | 'vacation', DayProfile> = {
  workday:  { day_type: 'workday',  free_hours: 3 },
  weekend:  { day_type: 'weekend',  free_hours: 6 },
  vacation: { day_type: 'vacation', free_hours: 8 },
};

function buildProfileMap(
  rows: { day_type: string; free_hours: string }[],
): Record<'workday' | 'weekend' | 'vacation', DayProfile> {
  const map = { ...DEFAULT_PROFILES };
  for (const r of rows) {
    const dt = r.day_type as 'workday' | 'weekend' | 'vacation';
    if (dt in map) map[dt] = { day_type: dt, free_hours: parseFloat(r.free_hours) };
  }
  return map;
}

const PATCHABLE = new Set([
  'start_date', 'duration_days', 'effort', 'progress_pct', 'status',
  'title', 'description', 'deadline', 'is_locked', 'category',
]);

// ── route ─────────────────────────────────────────────────────────────────────

scheduleRouter.post('/apply', async (req, res) => {
  const { taskId, patch } = req.body as { taskId: string; patch: Record<string, unknown> };
  const workspaceId = req.auth!.workspaceId;

  if (!taskId || !patch || typeof patch !== 'object') {
    res.status(400).json({ error: 'taskId and patch are required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch the current task (verify it belongs to this workspace)
    const { rows: [current] } = await client.query<{
      id: string; start_date: string; end_date: string; duration_days: string;
    }>(
      `SELECT t.id, t.start_date, t.end_date, t.duration_days
       FROM tasks t
       JOIN phases ph ON ph.id = t.phase_id
       JOIN projects p  ON p.id  = ph.project_id
       WHERE t.id = $1 AND p.workspace_id = $2`,
      [taskId, workspaceId],
    );
    if (!current) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Build the validated patch, recomputing end_date if dates/duration changed
    const safePatch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (PATCHABLE.has(k)) safePatch[k] = v;
    }

    if ('start_date' in safePatch || 'duration_days' in safePatch) {
      const start = (safePatch.start_date as string) ?? current.start_date;
      const dur   = Number((safePatch.duration_days as number) ?? current.duration_days);
      safePatch.end_date = offsetDate(start, dur - 1);
    }

    // 2. Apply the patch
    if (Object.keys(safePatch).length > 0) {
      const entries = Object.entries(safePatch);
      const sets    = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
      const vals    = entries.map(([, v]) => v);
      await client.query(
        `UPDATE tasks SET ${sets} WHERE id = $1`,
        [taskId, ...vals],
      );
    }

    // 2b. Update dependencies (junction table) if included in patch
    if ('dependencies' in patch && Array.isArray(patch.dependencies)) {
      await client.query('DELETE FROM task_dependencies WHERE task_id = $1', [taskId]);
      for (const depId of patch.dependencies as string[]) {
        await client.query(
          'INSERT INTO task_dependencies (task_id, depends_on_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [taskId, depId],
        );
      }
    }

    // 3. Fetch all active workspace tasks for cascade computation
    const { rows: allRows } = await client.query<Task & { dependencies: string[] }>(
      `SELECT t.id, t.start_date, t.end_date, t.duration_days,
              t.effort::float, t.progress_pct::int, t.status,
              t.deadline, t.is_locked,
              COALESCE(
                json_agg(td.depends_on_id) FILTER (WHERE td.depends_on_id IS NOT NULL),
                '[]'
              )::text AS dependencies_json
       FROM tasks t
       JOIN phases ph ON ph.id = t.phase_id
       JOIN projects p  ON p.id  = ph.project_id
       LEFT JOIN task_dependencies td ON td.task_id = t.id
       WHERE p.workspace_id = $1 AND p.status = 'active'
       GROUP BY t.id`,
      [workspaceId],
    );

    // Parse the JSON dependencies column
    const taskMap = new Map<string, Task>(
      allRows.map((r: Task & { dependencies_json?: string }) => {
        const t: Task = {
          ...r,
          effort:       Number(r.effort),
          duration_days: Number(r.duration_days),
          progress_pct:  Number(r.progress_pct),
          dependencies: JSON.parse((r as unknown as { dependencies_json: string }).dependencies_json ?? '[]'),
        };
        // Reflect the just-applied patch in the in-memory map
        if (r.id === taskId) Object.assign(t, safePatch);
        return [t.id, t];
      }),
    );

    // 4. Compute + apply cascade
    const cascadeUpdates = computeCascade(taskId, taskMap);
    for (const u of cascadeUpdates) {
      await client.query(
        'UPDATE tasks SET start_date = $2, end_date = $3 WHERE id = $1',
        [u.id, u.start_date, u.end_date],
      );
    }

    // 5. Re-fetch the updated rows to return canonical DB state
    const affectedIds = [taskId, ...cascadeUpdates.map((u) => u.id)];
    const { rows: updatedRows } = await client.query(
      `SELECT t.*,
              COALESCE(
                json_agg(td.depends_on_id) FILTER (WHERE td.depends_on_id IS NOT NULL),
                '[]'
              ) AS dependencies
       FROM tasks t
       LEFT JOIN task_dependencies td ON td.task_id = t.id
       WHERE t.id = ANY($1::uuid[])
       GROUP BY t.id`,
      [affectedIds],
    );

    // 6. Compute load bar (45-day window centred on today)
    const { rows: profileRows } = await client.query(
      'SELECT day_type, free_hours FROM day_profiles WHERE workspace_id = $1',
      [workspaceId],
    );
    const profiles  = buildProfileMap(profileRows);
    const today     = new Date().toISOString().slice(0, 10);
    const loadEntries = computeLoad(
      Array.from(taskMap.values()),
      { start: offsetDate(today, -10), end: offsetDate(today, 35) },
      profiles,
    );

    await client.query('COMMIT');

    res.json({
      task:        updatedRows.find((r) => r.id === taskId),
      cascade:     updatedRows.filter((r) => r.id !== taskId),
      loadEntries,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('schedule/apply error:', err);
    res.status(500).json({ error: 'Schedule apply failed' });
  } finally {
    client.release();
  }
});
