/**
 * Seed script — inserts realistic dummy data for UI development.
 *
 * Projects:
 *   1. Get Summer House Ready for Rental  (3 phases, 10 tasks)
 *   2. Summer Holiday Planning             (3 phases,  7 tasks)
 *   3. Kids' School Play                   (3 phases,  9 tasks)
 *
 * Run with:  npm run seed
 * Idempotent: exits early if the demo user already exists.
 */

import bcrypt from 'bcrypt';
import { pool } from './pool';

async function seed() {
  const client = await pool.connect();
  try {
    // ── guard: skip if already seeded ───────────────────────────────────────
    const { rows: existing } = await client.query(
      "SELECT id FROM users WHERE email = 'demo@lifemanager.app'"
    );
    if (existing.length > 0) {
      console.log('Seed data already present — skipping.');
      return;
    }

    await client.query('BEGIN');

    // ── workspace & user ────────────────────────────────────────────────────
    const { rows: [ws] } = await client.query(
      "INSERT INTO workspaces (name) VALUES ('Hansen Household') RETURNING id"
    );
    const wsId: string = ws.id;

    const passwordHash = await bcrypt.hash('demo1234', 12);
    const { rows: [user] } = await client.query(
      `INSERT INTO users (workspace_id, email, password_hash, role)
       VALUES ($1, 'demo@lifemanager.app', $2, 'owner') RETURNING id`,
      [wsId, passwordHash]
    );
    const userId: string = user.id;

    // ── day profiles ────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO day_profiles (workspace_id, day_type, work_hours, commute_hours, free_hours)
       VALUES ($1, 'workday',  8.0, 1.0, 3.0),
              ($1, 'weekend',  0.0, 0.0, 6.0),
              ($1, 'vacation', 0.0, 0.0, 8.0)`,
      [wsId]
    );

    // ── helper ──────────────────────────────────────────────────────────────
    // Returns YYYY-MM-DD for today + offsetDays
    function d(offsetDays: number): string {
      const dt = new Date('2026-03-08');
      dt.setDate(dt.getDate() + offsetDays);
      return dt.toISOString().slice(0, 10);
    }

    async function insertTask(params: {
      phaseId: string;
      title: string;
      description?: string;
      effort: number;
      durationDays: number;
      startOffset: number;
      deadline?: string;
      isLocked?: boolean;
      progressPct?: number;
      status?: string;
    }): Promise<string> {
      const start = d(params.startOffset);
      const end = d(params.startOffset + params.durationDays - 1);
      const { rows: [t] } = await client.query(
        `INSERT INTO tasks
           (phase_id, owner_id, title, description, effort, duration_days,
            start_date, end_date, deadline, is_locked, progress_pct, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [
          params.phaseId,
          userId,
          params.title,
          params.description ?? null,
          params.effort,
          params.durationDays,
          start,
          end,
          params.deadline ?? null,
          params.isLocked ?? false,
          params.progressPct ?? 0,
          params.status ?? 'not_started',
        ]
      );
      return t.id as string;
    }

    async function addDep(taskId: string, dependsOnId: string) {
      await client.query(
        'INSERT INTO task_dependencies (task_id, depends_on_id) VALUES ($1, $2)',
        [taskId, dependsOnId]
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // PROJECT 1 — Get Summer House Ready for Rental
    // ════════════════════════════════════════════════════════════════════════
    const { rows: [p1] } = await client.query(
      `INSERT INTO projects (workspace_id, owner_id, title, description, start_date, target_end_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [
        wsId, userId,
        'Get Summer House Ready for Rental',
        'Prepare the summer house in Skagen for short-term rental by June.',
        d(-7), d(85),
      ]
    );

    // Phase 1 — Assessment & Planning
    const { rows: [ph1_1] } = await client.query(
      `INSERT INTO phases (project_id, title, "order", start_date, end_date)
       VALUES ($1,'Assessment & Planning',1,$2,$3) RETURNING id`,
      [p1.id, d(-7), d(10)]
    );
    const t1a = await insertTask({ phaseId: ph1_1.id, title: 'Survey property condition', description: 'Walk through every room and document issues.', effort: 3, durationDays: 3, startOffset: -7, progressPct: 60, status: 'in_progress' });
    const t1b = await insertTask({ phaseId: ph1_1.id, title: 'Get rental market quotes', description: 'Research comparable listings on Airbnb and Booking.com.', effort: 2, durationDays: 5, startOffset: -7, progressPct: 100, status: 'completed' });
    const t1c = await insertTask({ phaseId: ph1_1.id, title: 'Create renovation budget', effort: 4, durationDays: 7, startOffset: 0 });
    await addDep(t1c, t1a);
    await addDep(t1c, t1b);

    // Phase 2 — Repairs & Renovations
    const { rows: [ph1_2] } = await client.query(
      `INSERT INTO phases (project_id, title, "order", start_date, end_date)
       VALUES ($1,'Repairs & Renovations',2,$2,$3) RETURNING id`,
      [p1.id, d(12), d(45)]
    );
    const t2a = await insertTask({ phaseId: ph1_2.id, title: 'Fix roof leak', description: 'Call contractor. Must complete before April.', effort: 8, durationDays: 2, startOffset: 12, deadline: d(24), isLocked: true, status: 'not_started' });
    const t2b = await insertTask({ phaseId: ph1_2.id, title: 'Paint interior', effort: 20, durationDays: 5, startOffset: 17, status: 'not_started' });
    const t2c = await insertTask({ phaseId: ph1_2.id, title: 'Replace kitchen appliances', effort: 5, durationDays: 3, startOffset: 24 });
    await addDep(t2c, t2a);
    const t2d = await insertTask({ phaseId: ph1_2.id, title: 'Deep clean throughout', effort: 6, durationDays: 2, startOffset: 30 });
    await addDep(t2d, t2b);
    await addDep(t2d, t2c);

    // Phase 3 — Marketing & Listing
    const { rows: [ph1_3] } = await client.query(
      `INSERT INTO phases (project_id, title, "order", start_date, end_date)
       VALUES ($1,'Marketing & Listing',3,$2,$3) RETURNING id`,
      [p1.id, d(33), d(55)]
    );
    const t3a = await insertTask({ phaseId: ph1_3.id, title: 'Take listing photos', effort: 3, durationDays: 1, startOffset: 33 });
    await addDep(t3a, t2d);
    const t3b = await insertTask({ phaseId: ph1_3.id, title: 'Write listing description', effort: 2, durationDays: 3, startOffset: 33 });
    const t3c = await insertTask({ phaseId: ph1_3.id, title: 'Post on rental platforms', effort: 2, durationDays: 1, startOffset: 37, deadline: d(42), isLocked: true });
    await addDep(t3c, t3a);
    await addDep(t3c, t3b);

    // ════════════════════════════════════════════════════════════════════════
    // PROJECT 2 — Summer Holiday Planning
    // ════════════════════════════════════════════════════════════════════════
    const { rows: [p2] } = await client.query(
      `INSERT INTO projects (workspace_id, owner_id, title, description, start_date, target_end_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [
        wsId, userId,
        'Summer Holiday Planning',
        'Two-week family holiday in southern Europe, departing early July.',
        d(0), d(115),
      ]
    );

    // Phase 1 — Destination & Dates
    const { rows: [ph2_1] } = await client.query(
      `INSERT INTO phases (project_id, title, "order", start_date, end_date)
       VALUES ($1,'Destination & Dates',1,$2,$3) RETURNING id`,
      [p2.id, d(0), d(14)]
    );
    const t4a = await insertTask({ phaseId: ph2_1.id, title: 'Research destinations', description: 'Greece, Croatia, or Portugal — shortlist three options.', effort: 3, durationDays: 7, startOffset: 0, progressPct: 40, status: 'in_progress' });
    const t4b = await insertTask({ phaseId: ph2_1.id, title: 'Agree on dates with family', effort: 1, durationDays: 3, startOffset: 2 });

    // Phase 2 — Bookings
    const { rows: [ph2_2] } = await client.query(
      `INSERT INTO phases (project_id, title, "order", start_date, end_date)
       VALUES ($1,'Bookings',2,$2,$3) RETURNING id`,
      [p2.id, d(12), d(28)]
    );
    const t5a = await insertTask({ phaseId: ph2_2.id, title: 'Book flights', effort: 2, durationDays: 1, startOffset: 12, deadline: d(24), isLocked: true });
    await addDep(t5a, t4a);
    await addDep(t5a, t4b);
    const t5b = await insertTask({ phaseId: ph2_2.id, title: 'Book accommodation', effort: 2, durationDays: 2, startOffset: 14 });
    await addDep(t5b, t5a);
    const t5c = await insertTask({ phaseId: ph2_2.id, title: 'Book car rental', effort: 1, durationDays: 1, startOffset: 16 });
    await addDep(t5c, t5a);

    // Phase 3 — Preparation
    const { rows: [ph2_3] } = await client.query(
      `INSERT INTO phases (project_id, title, "order", start_date, end_date)
       VALUES ($1,'Preparation',3,$2,$3) RETURNING id`,
      [p2.id, d(85), d(112)]
    );
    await insertTask({ phaseId: ph2_3.id, title: 'Buy travel insurance', effort: 1, durationDays: 1, startOffset: 85 });
    await insertTask({ phaseId: ph2_3.id, title: 'Pack and prepare bags', effort: 4, durationDays: 3, startOffset: 109 });

    // ════════════════════════════════════════════════════════════════════════
    // PROJECT 3 — Kids' School Play
    // ════════════════════════════════════════════════════════════════════════
    const { rows: [p3] } = await client.query(
      `INSERT INTO projects (workspace_id, owner_id, title, description, start_date, target_end_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [
        wsId, userId,
        "Kids' School Play",
        'Parent-volunteer production of Roald Dahl\'s "James and the Giant Peach" for year 4.',
        d(-14), d(54),
      ]
    );

    // Phase 1 — Planning
    const { rows: [ph3_1] } = await client.query(
      `INSERT INTO phases (project_id, title, "order", start_date, end_date)
       VALUES ($1,'Planning',1,$2,$3) RETURNING id`,
      [p3.id, d(-14), d(-1)]
    );
    await insertTask({ phaseId: ph3_1.id, title: 'Choose the play', effort: 2, durationDays: 5, startOffset: -14, progressPct: 100, status: 'completed' });
    const t7b = await insertTask({ phaseId: ph3_1.id, title: 'Cast children in roles', effort: 3, durationDays: 3, startOffset: -7, progressPct: 100, status: 'completed' });

    // Phase 2 — Rehearsals
    const { rows: [ph3_2] } = await client.query(
      `INSERT INTO phases (project_id, title, "order", start_date, end_date)
       VALUES ($1,'Rehearsals',2,$2,$3) RETURNING id`,
      [p3.id, d(0), d(42)]
    );
    const t8a = await insertTask({ phaseId: ph3_2.id, title: 'Write script adaptation', description: 'Shorten original script to 45 minutes.', effort: 8, durationDays: 10, startOffset: 0, progressPct: 30, status: 'in_progress' });
    await addDep(t8a, t7b);
    const t8b = await insertTask({ phaseId: ph3_2.id, title: 'First full rehearsal', effort: 3, durationDays: 1, startOffset: 14 });
    await addDep(t8b, t8a);
    const t8c = await insertTask({ phaseId: ph3_2.id, title: 'Costume design & sourcing', effort: 6, durationDays: 14, startOffset: 3 });
    const t8d = await insertTask({ phaseId: ph3_2.id, title: 'Build props and set pieces', effort: 10, durationDays: 14, startOffset: 10 });
    const t8e = await insertTask({ phaseId: ph3_2.id, title: 'Dress rehearsal', effort: 4, durationDays: 1, startOffset: 42 });
    await addDep(t8e, t8b);
    await addDep(t8e, t8c);
    await addDep(t8e, t8d);

    // Phase 3 — Performance
    const { rows: [ph3_3] } = await client.query(
      `INSERT INTO phases (project_id, title, "order", start_date, end_date)
       VALUES ($1,'Performance',3,$2,$3) RETURNING id`,
      [p3.id, d(53), d(54)]
    );
    const t9a = await insertTask({ phaseId: ph3_3.id, title: 'Set up venue', effort: 4, durationDays: 1, startOffset: 53, deadline: d(53), isLocked: true });
    await addDep(t9a, t8e);
    const t9b = await insertTask({ phaseId: ph3_3.id, title: 'Performance day', effort: 5, durationDays: 1, startOffset: 54, deadline: d(54), isLocked: true });
    await addDep(t9b, t9a);

    // suppress unused var warnings — variables used only for addDep calls above
    void [t5b, t5c, t8a, t8b, t8c, t8d, t9b];

    await client.query('COMMIT');
    console.log('Seed complete.');
    console.log('  Login: demo@lifemanager.app / demo1234');
    console.log(`  Workspace: Hansen Household (${wsId})`);
    console.log('  Projects seeded: 3');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
