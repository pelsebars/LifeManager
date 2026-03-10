import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { assistantService } from '../services/assistantService';
import { rescheduleTask, type Task as EngineTask } from '../services/schedulingEngine';
import { pool } from '../db/pool';

export const assistantRouter = Router();
assistantRouter.use(requireAuth);

// POST /api/assistant/standup — start or continue a standup conversation
assistantRouter.post('/standup', async (req, res) => {
  const { messages, date } = req.body;
  const workspaceId = req.auth!.workspaceId;
  const today = date ?? new Date().toISOString().slice(0, 10);

  // BL-29: fetch day profiles for capacity-aware standup
  const { rows: profileRows } = await pool.query(
    'SELECT day_type, free_hours FROM day_profiles WHERE workspace_id = $1',
    [workspaceId]
  );
  const profileMap: Record<string, number> = { workday: 3, weekend: 6, vacation: 8 };
  for (const r of profileRows) profileMap[r.day_type] = parseFloat(r.free_hours);

  // BL-29: compute next-7-days capacity risks using all active workspace tasks
  const { rows: upcomingTasks } = await pool.query(
    `SELECT t.id, t.effort::float, t.duration_days::int, t.progress_pct::int, t.start_date, t.end_date, t.status
     FROM tasks t
     JOIN phases ph ON ph.id = t.phase_id
     JOIN projects p  ON p.id  = ph.project_id
     WHERE p.workspace_id = $1 AND p.status = 'active'
       AND t.status NOT IN ('completed', 'deferred')`,
    [workspaceId]
  );

  const overloadedDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    const available = profileMap[dow === 0 || dow === 6 ? 'weekend' : 'workday'];
    const planned = upcomingTasks
      .filter((t: { start_date: string; end_date: string; effort: number; duration_days: number; progress_pct: number }) =>
        ds >= t.start_date && ds <= t.end_date)
      .reduce((sum: number, t: { effort: number; duration_days: number; progress_pct: number }) =>
        sum + (t.effort * (1 - t.progress_pct / 100)) / t.duration_days, 0);
    if (planned > available) overloadedDays.push(ds);
  }

  // Fetch context: today's tasks + yesterday's incomplete tasks
  const { rows: todayTasks } = await pool.query(
    `SELECT t.title, t.status, t.progress_pct, t.effort, t.duration_days, ph.title AS phase_title, p.title AS project_title
     FROM tasks t
     JOIN phases ph ON ph.id = t.phase_id
     JOIN projects p ON p.id = ph.project_id
     WHERE p.workspace_id = $1 AND $2::date BETWEEN t.start_date AND t.end_date
     ORDER BY t.start_date`,
    [workspaceId, today]
  );

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const { rows: incompleteRows } = await pool.query(
    `SELECT t.id, t.title, t.status, t.progress_pct,
            t.effort::float, t.duration_days::int, t.start_date, t.end_date,
            t.deadline, t.is_locked,
            ph.title AS phase_title, p.title AS project_title
     FROM tasks t
     JOIN phases ph ON ph.id = t.phase_id
     JOIN projects p ON p.id = ph.project_id
     WHERE p.workspace_id = $1 AND $2::date BETWEEN t.start_date AND t.end_date
       AND t.status NOT IN ('completed', 'deferred')
     ORDER BY t.start_date`,
    [workspaceId, yesterday.toISOString().slice(0, 10)]
  );

  // BL-26: compute reschedule proposals for each slipped task
  const slippedTasks = incompleteRows.map((row) => {
    const engineTask: EngineTask = {
      id: row.id,
      start_date: row.start_date,
      end_date: row.end_date,
      effort: Number(row.effort),
      duration_days: Number(row.duration_days),
      progress_pct: Number(row.progress_pct),
      status: row.status,
      deadline: row.deadline,
      is_locked: row.is_locked,
      dependencies: [],
    };
    const proposed = rescheduleTask(engineTask, today);
    return {
      id: row.id,
      title: row.title,
      phase_title: row.phase_title,
      project_title: row.project_title,
      original_end: row.end_date,
      proposed_start_date: proposed.start_date,
      proposed_end_date: proposed.end_date,
      warning: proposed.warning,
    };
  });

  const reply = await assistantService.standup({
    messages: messages ?? [],
    todayTasks,
    incompleteTasks: incompleteRows,
    today,
    overloadedDays,
    capacityProfiles: profileMap,
  });

  res.json({ reply, slippedTasks });
});

// POST /api/assistant/query — natural language question about the plan
assistantRouter.post('/query', async (req, res) => {
  const { question } = req.body;
  const workspaceId = req.auth!.workspaceId;

  const { rows: projects } = await pool.query(
    `SELECT p.title, p.status, p.start_date, p.target_end_date,
       json_agg(json_build_object(
         'phase', ph.title,
         'tasks', (
           SELECT json_agg(json_build_object(
             'title', t.title, 'status', t.status, 'progress_pct', t.progress_pct,
             'start_date', t.start_date, 'end_date', t.end_date
           ))
           FROM tasks t WHERE t.phase_id = ph.id
         )
       ) ORDER BY ph."order") AS phases
     FROM projects p
     LEFT JOIN phases ph ON ph.project_id = p.id
     WHERE p.workspace_id = $1 AND p.status = 'active'
     GROUP BY p.id`,
    [workspaceId]
  );

  const reply = await assistantService.query({ question, projects });
  res.json({ reply });
});
