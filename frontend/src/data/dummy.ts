/**
 * Static dummy data for Sprint 2 UI development.
 * Mirrors the seed script dates (base: 2026-03-09).
 * Replaced by live API data in Sprint 4 (BL-19).
 */

import type { Phase, Task, DayProfile } from '../types';

function d(offset: number): string {
  const dt = new Date('2026-03-09');
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString().slice(0, 10);
}

const TS = '2026-03-09T00:00:00Z';
const WS = 'ws-demo';
const USER = 'user-demo';

// ─────────────────────────────────────────────────────────────────────────────
// Day Profiles
// ─────────────────────────────────────────────────────────────────────────────

export const DUMMY_DAY_PROFILES: DayProfile[] = [
  { id: 'dp-1', workspace_id: WS, day_type: 'workday',  work_hours: 8, commute_hours: 1, free_hours: 3 },
  { id: 'dp-2', workspace_id: WS, day_type: 'weekend',  work_hours: 0, commute_hours: 0, free_hours: 6 },
  { id: 'dp-3', workspace_id: WS, day_type: 'vacation', work_hours: 0, commute_hours: 0, free_hours: 8 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Project 1 — Get Summer House Ready for Rental
// ─────────────────────────────────────────────────────────────────────────────

export const P1_ID = 'proj-summerhouse';

export const P1_PHASES: Phase[] = [
  { id: 'ph1-1', project_id: P1_ID, title: 'Assessment & Planning', order: 1, start_date: d(-7), end_date: d(10),  created_at: TS, updated_at: TS },
  { id: 'ph1-2', project_id: P1_ID, title: 'Repairs & Renovations',  order: 2, start_date: d(12), end_date: d(45), created_at: TS, updated_at: TS },
  { id: 'ph1-3', project_id: P1_ID, title: 'Marketing & Listing',    order: 3, start_date: d(33), end_date: d(55), created_at: TS, updated_at: TS },
];

export const P1_TASKS: Task[] = [
  // Phase 1
  {
    id: 't1a', phase_id: 'ph1-1', owner_id: USER,
    title: 'Survey property condition',
    description: 'Walk through every room and document issues.',
    effort: 3, duration_days: 3, start_date: d(-7), end_date: d(-5),
    deadline: null, is_locked: false, progress_pct: 60, status: 'in_progress',
    dependencies: [], created_at: TS, updated_at: TS,
  },
  {
    id: 't1b', phase_id: 'ph1-1', owner_id: USER,
    title: 'Get rental market quotes',
    description: 'Research comparable listings on Airbnb and Booking.com.',
    effort: 2, duration_days: 5, start_date: d(-7), end_date: d(-3),
    deadline: null, is_locked: false, progress_pct: 100, status: 'completed',
    dependencies: [], created_at: TS, updated_at: TS,
  },
  {
    id: 't1c', phase_id: 'ph1-1', owner_id: USER,
    title: 'Create renovation budget',
    effort: 4, duration_days: 7, start_date: d(0), end_date: d(6),
    deadline: null, is_locked: false, progress_pct: 0, status: 'not_started',
    dependencies: ['t1a', 't1b'], created_at: TS, updated_at: TS,
  },
  // Phase 2
  {
    id: 't2a', phase_id: 'ph1-2', owner_id: USER,
    title: 'Fix roof leak',
    description: 'Call contractor. Must complete before April.',
    effort: 8, duration_days: 2, start_date: d(12), end_date: d(13),
    deadline: d(24), is_locked: true, progress_pct: 0, status: 'not_started',
    dependencies: [], created_at: TS, updated_at: TS,
  },
  {
    id: 't2b', phase_id: 'ph1-2', owner_id: USER,
    title: 'Paint interior',
    effort: 20, duration_days: 5, start_date: d(17), end_date: d(21),
    deadline: null, is_locked: false, progress_pct: 0, status: 'not_started',
    dependencies: [], created_at: TS, updated_at: TS,
  },
  {
    id: 't2c', phase_id: 'ph1-2', owner_id: USER,
    title: 'Replace kitchen appliances',
    effort: 5, duration_days: 3, start_date: d(24), end_date: d(26),
    deadline: null, is_locked: false, progress_pct: 0, status: 'not_started',
    dependencies: ['t2a'], created_at: TS, updated_at: TS,
  },
  {
    id: 't2d', phase_id: 'ph1-2', owner_id: USER,
    title: 'Deep clean throughout',
    effort: 6, duration_days: 2, start_date: d(30), end_date: d(31),
    deadline: null, is_locked: false, progress_pct: 0, status: 'not_started',
    dependencies: ['t2b', 't2c'], created_at: TS, updated_at: TS,
  },
  // Phase 3
  {
    id: 't3a', phase_id: 'ph1-3', owner_id: USER,
    title: 'Take listing photos',
    effort: 3, duration_days: 1, start_date: d(33), end_date: d(33),
    deadline: null, is_locked: false, progress_pct: 0, status: 'not_started',
    dependencies: ['t2d'], created_at: TS, updated_at: TS,
  },
  {
    id: 't3b', phase_id: 'ph1-3', owner_id: USER,
    title: 'Write listing description',
    effort: 2, duration_days: 3, start_date: d(33), end_date: d(35),
    deadline: null, is_locked: false, progress_pct: 0, status: 'not_started',
    dependencies: [], created_at: TS, updated_at: TS,
  },
  {
    id: 't3c', phase_id: 'ph1-3', owner_id: USER,
    title: 'Post on rental platforms',
    effort: 2, duration_days: 1, start_date: d(37), end_date: d(37),
    deadline: d(42), is_locked: true, progress_pct: 0, status: 'not_started',
    dependencies: ['t3a', 't3b'], created_at: TS, updated_at: TS,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Project 2 — Summer Holiday Planning
// ─────────────────────────────────────────────────────────────────────────────

export const P2_ID = 'proj-holiday';

export const P2_PHASES: Phase[] = [
  { id: 'ph2-1', project_id: P2_ID, title: 'Destination & Dates', order: 1, start_date: d(0),  end_date: d(14),  created_at: TS, updated_at: TS },
  { id: 'ph2-2', project_id: P2_ID, title: 'Bookings',            order: 2, start_date: d(12), end_date: d(28),  created_at: TS, updated_at: TS },
  { id: 'ph2-3', project_id: P2_ID, title: 'Preparation',         order: 3, start_date: d(85), end_date: d(112), created_at: TS, updated_at: TS },
];

export const P2_TASKS: Task[] = [
  {
    id: 't4a', phase_id: 'ph2-1', owner_id: USER,
    title: 'Research destinations',
    description: 'Greece, Croatia, or Portugal — shortlist three options.',
    effort: 3, duration_days: 7, start_date: d(0), end_date: d(6),
    deadline: null, is_locked: false, progress_pct: 40, status: 'in_progress',
    dependencies: [], created_at: TS, updated_at: TS,
  },
  {
    id: 't4b', phase_id: 'ph2-1', owner_id: USER,
    title: 'Agree on dates with family',
    effort: 1, duration_days: 3, start_date: d(2), end_date: d(4),
    deadline: null, is_locked: false, progress_pct: 0, status: 'not_started',
    dependencies: [], created_at: TS, updated_at: TS,
  },
  {
    id: 't5a', phase_id: 'ph2-2', owner_id: USER,
    title: 'Book flights',
    effort: 2, duration_days: 1, start_date: d(12), end_date: d(12),
    deadline: d(24), is_locked: true, progress_pct: 0, status: 'not_started',
    dependencies: ['t4a', 't4b'], created_at: TS, updated_at: TS,
  },
  {
    id: 't5b', phase_id: 'ph2-2', owner_id: USER,
    title: 'Book accommodation',
    effort: 2, duration_days: 2, start_date: d(14), end_date: d(15),
    deadline: null, is_locked: false, progress_pct: 0, status: 'not_started',
    dependencies: ['t5a'], created_at: TS, updated_at: TS,
  },
  {
    id: 't5c', phase_id: 'ph2-2', owner_id: USER,
    title: 'Book car rental',
    effort: 1, duration_days: 1, start_date: d(16), end_date: d(16),
    deadline: null, is_locked: false, progress_pct: 0, status: 'not_started',
    dependencies: ['t5a'], created_at: TS, updated_at: TS,
  },
  {
    id: 't6a', phase_id: 'ph2-3', owner_id: USER,
    title: 'Buy travel insurance',
    effort: 1, duration_days: 1, start_date: d(85), end_date: d(85),
    deadline: null, is_locked: false, progress_pct: 0, status: 'not_started',
    dependencies: [], created_at: TS, updated_at: TS,
  },
  {
    id: 't6b', phase_id: 'ph2-3', owner_id: USER,
    title: 'Pack and prepare bags',
    effort: 4, duration_days: 3, start_date: d(109), end_date: d(111),
    deadline: null, is_locked: false, progress_pct: 0, status: 'not_started',
    dependencies: [], created_at: TS, updated_at: TS,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Project 3 — Kids' School Play
// ─────────────────────────────────────────────────────────────────────────────

export const P3_ID = 'proj-play';

export const P3_PHASES: Phase[] = [
  { id: 'ph3-1', project_id: P3_ID, title: 'Planning',     order: 1, start_date: d(-14), end_date: d(-1),  created_at: TS, updated_at: TS },
  { id: 'ph3-2', project_id: P3_ID, title: 'Rehearsals',   order: 2, start_date: d(0),   end_date: d(42),  created_at: TS, updated_at: TS },
  { id: 'ph3-3', project_id: P3_ID, title: 'Performance',  order: 3, start_date: d(53),  end_date: d(54),  created_at: TS, updated_at: TS },
];

export const P3_TASKS: Task[] = [
  {
    id: 't7a', phase_id: 'ph3-1', owner_id: USER,
    title: 'Choose the play',
    effort: 2, duration_days: 5, start_date: d(-14), end_date: d(-10),
    deadline: null, is_locked: false, progress_pct: 100, status: 'completed',
    dependencies: [], created_at: TS, updated_at: TS,
  },
  {
    id: 't7b', phase_id: 'ph3-1', owner_id: USER,
    title: 'Cast children in roles',
    effort: 3, duration_days: 3, start_date: d(-7), end_date: d(-5),
    deadline: null, is_locked: false, progress_pct: 100, status: 'completed',
    dependencies: [], created_at: TS, updated_at: TS,
  },
  {
    id: 't8a', phase_id: 'ph3-2', owner_id: USER,
    title: 'Write script adaptation',
    description: 'Shorten original script to 45 minutes.',
    effort: 8, duration_days: 10, start_date: d(0), end_date: d(9),
    deadline: null, is_locked: false, progress_pct: 30, status: 'in_progress',
    dependencies: ['t7b'], created_at: TS, updated_at: TS,
  },
  {
    id: 't8b', phase_id: 'ph3-2', owner_id: USER,
    title: 'First full rehearsal',
    effort: 3, duration_days: 1, start_date: d(14), end_date: d(14),
    deadline: null, is_locked: false, progress_pct: 0, status: 'not_started',
    dependencies: ['t8a'], created_at: TS, updated_at: TS,
  },
  {
    id: 't8c', phase_id: 'ph3-2', owner_id: USER,
    title: 'Costume design & sourcing',
    effort: 6, duration_days: 14, start_date: d(3), end_date: d(16),
    deadline: null, is_locked: false, progress_pct: 0, status: 'not_started',
    dependencies: [], created_at: TS, updated_at: TS,
  },
  {
    id: 't8d', phase_id: 'ph3-2', owner_id: USER,
    title: 'Build props and set pieces',
    effort: 10, duration_days: 14, start_date: d(10), end_date: d(23),
    deadline: null, is_locked: false, progress_pct: 0, status: 'not_started',
    dependencies: [], created_at: TS, updated_at: TS,
  },
  {
    id: 't8e', phase_id: 'ph3-2', owner_id: USER,
    title: 'Dress rehearsal',
    effort: 4, duration_days: 1, start_date: d(42), end_date: d(42),
    deadline: null, is_locked: false, progress_pct: 0, status: 'not_started',
    dependencies: ['t8b', 't8c', 't8d'], created_at: TS, updated_at: TS,
  },
  {
    id: 't9a', phase_id: 'ph3-3', owner_id: USER,
    title: 'Set up venue',
    effort: 4, duration_days: 1, start_date: d(53), end_date: d(53),
    deadline: d(53), is_locked: true, progress_pct: 0, status: 'not_started',
    dependencies: ['t8e'], created_at: TS, updated_at: TS,
  },
  {
    id: 't9b', phase_id: 'ph3-3', owner_id: USER,
    title: 'Performance day',
    effort: 5, duration_days: 1, start_date: d(54), end_date: d(54),
    deadline: d(54), is_locked: true, progress_pct: 0, status: 'not_started',
    dependencies: ['t9a'], created_at: TS, updated_at: TS,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Aggregated exports
// ─────────────────────────────────────────────────────────────────────────────

export const DUMMY_PROJECTS: import('../types').Project[] = [
  {
    id: P1_ID, workspace_id: WS, owner_id: USER,
    title: 'Get Summer House Ready for Rental',
    description: 'Prepare the summer house in Skagen for short-term rental by June.',
    start_date: d(-7), target_end_date: d(85), status: 'active',
    created_at: TS, updated_at: TS,
  },
  {
    id: P2_ID, workspace_id: WS, owner_id: USER,
    title: 'Summer Holiday Planning',
    description: 'Two-week family holiday in southern Europe, departing early July.',
    start_date: d(0), target_end_date: d(115), status: 'active',
    created_at: TS, updated_at: TS,
  },
  {
    id: P3_ID, workspace_id: WS, owner_id: USER,
    title: "Kids' School Play",
    description: "Parent-volunteer production of Roald Dahl's \"James and the Giant Peach\" for year 4.",
    start_date: d(-14), target_end_date: d(54), status: 'active',
    created_at: TS, updated_at: TS,
  },
];

export const DUMMY_PHASES: Record<string, Phase[]> = {
  [P1_ID]: P1_PHASES,
  [P2_ID]: P2_PHASES,
  [P3_ID]: P3_PHASES,
};

export const DUMMY_TASKS: Record<string, Task[]> = {
  'ph1-1': P1_TASKS.filter(t => t.phase_id === 'ph1-1'),
  'ph1-2': P1_TASKS.filter(t => t.phase_id === 'ph1-2'),
  'ph1-3': P1_TASKS.filter(t => t.phase_id === 'ph1-3'),
  'ph2-1': P2_TASKS.filter(t => t.phase_id === 'ph2-1'),
  'ph2-2': P2_TASKS.filter(t => t.phase_id === 'ph2-2'),
  'ph2-3': P2_TASKS.filter(t => t.phase_id === 'ph2-3'),
  'ph3-1': P3_TASKS.filter(t => t.phase_id === 'ph3-1'),
  'ph3-2': P3_TASKS.filter(t => t.phase_id === 'ph3-2'),
  'ph3-3': P3_TASKS.filter(t => t.phase_id === 'ph3-3'),
};
