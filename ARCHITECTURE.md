# LifeManager — Architecture Document

## Overview

LifeManager is a personal project/task planning tool with a React frontend, a Node.js/Express backend, and a PostgreSQL database. It is orchestrated via Docker Compose and designed for single-user or small-team use.

---

## Infrastructure

| Layer      | Technology                          | Port  |
|------------|-------------------------------------|-------|
| Database   | PostgreSQL 16 (postgres:16-alpine)  | 5432  |
| Backend    | Node.js 20 + Express + TypeScript   | 3001  |
| Frontend   | React 18 + Vite + TypeScript        | 5173  |

Docker Compose manages all three services. The backend is the only service that talks to the database; the frontend talks only to the backend API.

---

## Database Schema

All tables are created by `backend/src/db/migrations/001_init.sql`. Migrations are tracked in a `schema_migrations` table and applied via `npm run migrate`.

### Tables

#### `workspaces`
Multi-tenant root entity. Every user, project, day_profile, and day_override belongs to a workspace.

| Column     | Type      | Notes                    |
|------------|-----------|--------------------------|
| id         | UUID PK   |                          |
| name       | text      |                          |
| created_at | timestampz|                          |

#### `users`
Authentication principal. Created atomically with their workspace on `/auth/register`.

| Column       | Type    | Notes                              |
|--------------|---------|------------------------------------|
| id           | UUID PK |                                    |
| workspace_id | UUID FK | → workspaces                       |
| email        | text    | unique                             |
| password_hash| text    | bcrypt                             |
| role         | enum    | owner / editor / viewer            |
| created_at   | timestampz |                                 |

#### `projects`
Top-level work unit. Belongs to a workspace and has an optional owner (user).

| Column          | Type    | Notes                              |
|-----------------|---------|------------------------------------|
| id              | UUID PK |                                    |
| workspace_id    | UUID FK |                                    |
| owner_id        | UUID FK | → users (nullable)                 |
| title           | text    |                                    |
| description     | text    |                                    |
| start_date      | date    | YYYY-MM-DD                         |
| target_end_date | date    | YYYY-MM-DD                         |
| status          | enum    | active / completed / archived      |
| created_at      | timestampz |                                 |
| updated_at      | timestampz |                                 |

#### `phases`
Ordered stages within a project. Provide logical grouping in the Gantt and dependency management.

| Column     | Type    | Notes                              |
|------------|---------|------------------------------------|
| id         | UUID PK |                                    |
| project_id | UUID FK | → projects (CASCADE DELETE)        |
| title      | text    |                                    |
| order      | integer | display/sort order within project  |
| start_date | date    | optional; derived from tasks       |
| end_date   | date    | optional; derived from tasks       |
| created_at | timestampz |                                 |
| updated_at | timestampz |                                 |

#### `tasks`
Atomic work items. Belong to a phase.

Key design: **effort ≠ duration**.
- `effort` = total hours of work required (e.g. 6h).
- `duration_days` = calendar days the task occupies (e.g. 10 days).
- `daily_load = effort / duration_days` — hours contributed per calendar day to the load bar.

| Column        | Type      | Notes                                   |
|---------------|-----------|-----------------------------------------|
| id            | UUID PK   |                                         |
| phase_id      | UUID FK   | → phases (CASCADE DELETE)               |
| owner_id      | UUID FK   | → users (nullable)                      |
| title         | text      |                                         |
| description   | text      |                                         |
| effort        | numeric   | total work hours                        |
| duration_days | integer   | calendar-day span                       |
| start_date    | date      |                                         |
| end_date      | date      | = start_date + duration_days − 1        |
| deadline      | date      | optional hard constraint                |
| is_locked     | boolean   | true = cannot drag end past deadline    |
| progress_pct  | integer   | 0–100                                   |
| status        | enum      | not_started / in_progress / completed / deferred |
| dependencies  | uuid[]    | array of task IDs that must finish first|
| created_at    | timestampz |                                        |
| updated_at    | timestampz |                                        |

#### `task_dependencies` (logical, stored as array column)
Dependencies are stored as a `uuid[]` column on `tasks.dependencies` rather than a junction table. This keeps queries simple and dependency checks fast.

#### `day_profiles`
Per-workspace capacity model. One row per `day_type` per workspace.

| Column        | Type    | Notes                               |
|---------------|---------|-------------------------------------|
| id            | UUID PK |                                     |
| workspace_id  | UUID FK |                                     |
| day_type      | enum    | workday / weekend / vacation        |
| work_hours    | numeric | available work hours                |
| commute_hours | numeric | commute time (reduces free hours)   |
| free_hours    | numeric | discretionary free time             |

#### `day_overrides`
Per-date capacity overrides (schema present; UI deferred in MVP). Allow one-off exceptions to the day_profile model.

---

## Backend Routes

All routes are prefixed `/api` and defined in `backend/src/routes/`.

### Authentication (`/api/auth`)
- `POST /auth/register` — create workspace + user atomically; returns JWT
- `POST /auth/login` — verify credentials; returns JWT

JWT tokens have 7-day expiry, stored in browser `localStorage`. Protected routes use `requireAuth` middleware from `backend/src/middleware/auth.ts`.

### Projects (`/api/projects`)
- `GET /projects` — list all projects for workspace (includes embedded phases array)
- `GET /projects/:id` — get single project
- `POST /projects` — create project
- `PATCH /projects/:id` — update project fields
- `DELETE /projects/:id` — delete project + all phases/tasks (CASCADE)

### Phases (`/api/phases`)
- `GET /phases?project_id=:id` — list phases for a project
- `POST /phases` — create phase
- `PATCH /phases/:id` — update phase
- `DELETE /phases/:id` — delete phase + tasks (CASCADE)

### Tasks (`/api/tasks`)
- `GET /tasks?phase_id=:id` — list tasks for a phase
- `GET /tasks?date=:date` — list tasks active on a given date (enriched with phase/project context)
- `POST /tasks` — create task
- `PATCH /tasks/:id` — update task fields
- `DELETE /tasks/:id` — delete task

### Scheduling Engine (`/api/schedule`)
- `POST /schedule/apply` — apply a patch to a task and run the cascade scheduling engine; returns `{ task, cascade, loadEntries }`

The scheduling engine is a pure-function module at `backend/src/services/schedulingEngine.ts` with no Express or DB imports — it takes task data and returns proposed date changes.

### Day Profiles (`/api/day-profiles`)
- `GET /day-profiles` — list workspace day profiles
- `PUT /day-profiles/:dayType` — upsert a day profile

### Assistant (`/api/assistant`)
- `POST /assistant/standup` — multi-turn standup conversation using claude-sonnet-4-6
- `POST /assistant/query` — one-shot natural-language project query

All Claude API calls are routed exclusively through `backend/src/services/assistantService.ts`. No other file imports `@anthropic-ai/sdk`.

---

## Frontend Component Tree

```
App
└── PlanningView                      # main planning screen
    ├── GanttChart                    # react-calendar-timeline based Gantt
    │   ├── groupRenderer             # sidebar row labels (project header / task row)
    │   ├── itemRenderer              # task bars (BL-07/08/09/36)
    │   ├── SVG overlay               # dependency arrows + phase bracket markers
    │   ├── HTML phase label buttons  # clickable transparent overlays (BL-38)
    │   └── "+" popup menus           # add task / add phase (BL-34)
    ├── LoadBar                       # 45-day color-coded capacity strip
    ├── TaskDetailPanel (edit)        # slide-in edit panel for existing tasks
    ├── TaskDetailPanel (create)      # slide-in create panel for new tasks
    └── EditPhasePanel                # slide-in edit panel for phases (BL-38/39/40)

App
└── StandupView                       # daily standup chat with Claude
```

---

## Frontend Store Structure

Zustand is used for all frontend state. There are two stores.

### `planningStore` (`frontend/src/store/planningStore.ts`)

State:
- `projects: Project[]` — all projects for the workspace
- `phases: Record<string, Phase[]>` — keyed by `project_id`
- `tasks: Record<string, Task[]>` — keyed by `phase_id`
- `dayProfiles: DayProfile[]` — workday / weekend / vacation capacity
- `loadEntries: LoadEntry[]` — latest load bar values from API
- `selectedProjectId`, `selectedPhaseId`, `selectedTaskId` — current selection
- `loading`, `error` — async status
- `expandedProjects: Set<string>` — persisted to localStorage

Actions:
- `loadDummyData()` — load static seed data (offline/dev mode)
- `loadProjects()` — fetch all projects + phases + all tasks from API
- `loadProjectTasks(projectId)` — refresh tasks for one project
- `loadPhases(projectId)` / `loadTasks(phaseId)` — granular refresh
- `loadDayProfiles()` / `saveDayProfile()` — capacity model CRUD
- `createProject()` / `deleteProject()` — project lifecycle
- `createPhase()` / `updatePhase()` / `deletePhase()` — phase lifecycle
- `createTask()` / `updateTask()` / `deleteTask()` — task lifecycle
- `toggleProject(id)` — expand/collapse project in Gantt
- `selectProject()` / `selectPhase()` / `setSelectedTask()` — selection

`updateTask` is optimistic: it immediately updates local state for snappy drag feedback, then calls `POST /schedule/apply` to get the cascade result and definitive DB state.

All write actions support an **offline mode**: when no JWT token is in `localStorage`, data is created locally with generated IDs instead of calling the API.

### `executionStore` (`frontend/src/store/executionStore.ts`)
- `messages` — standup conversation history
- `todayTasks` — tasks active today
- `slippedTasks` — tasks the AI flagged as slipped
- Actions: `sendMessage`, `loadTodayTasks`, `applyReschedule`

---

## Key Design Decisions

### Effort vs Duration
Tasks have two separate time-related fields: `effort` (work hours) and `duration_days` (calendar span). This intentional separation lets a background task span many days with low daily load. The load bar shows `effort / duration_days` per day, not `effort` per day.

### Scheduling Engine as Pure Functions
All scheduling and load-calculation logic lives in `backend/src/services/schedulingEngine.ts` as pure functions with no side effects or I/O. This makes the engine unit-testable and separable from the web layer. The frontend has a local mirror in `src/hooks/useLoadCalculation.ts` for zero-latency UI updates during drag operations.

### Optimistic Updates
`updateTask` applies changes to local Zustand state immediately (for snappy drag-and-drop), then fires the API call in the background. If the API returns cascade changes, those are merged in. If the API is unreachable, the optimistic state stands.

### Offline / Demo Mode
All write actions in the store check for a JWT token before calling the API. Without a token, they create objects locally with generated IDs. This allows full UI development without a running backend.

### Multi-Project Gantt
All projects are displayed simultaneously in a single `react-calendar-timeline` instance. Projects can be expanded (flat task rows + phase markers) or collapsed (single summary bar). `react-calendar-timeline` groups and items are rebuilt in a `useMemo` whenever projects/phases/tasks/expandedProjects change.

### Phase Markers as SVG + HTML Hybrid
Phase bracket markers (horizontal lines, ticks, labels) are drawn in an SVG overlay with `pointerEvents: 'none'` so they don't interfere with Gantt drag operations. Clickable transparent HTML `<button>` elements are positioned over the SVG labels using the same coordinate calculations, giving pointer events without disrupting the drag layer.

### Claude API Integration
- `claude-sonnet-4-6` is used for standup conversation and natural-language project queries — tasks requiring high quality and multi-turn context.
- `claude-haiku-4-5-20251001` is used for lightweight single-shot classification tasks (cost-efficient).
- All SDK calls are isolated in `backend/src/services/assistantService.ts`; no other file imports `@anthropic-ai/sdk`.

### Authentication
JWT (jsonwebtoken), 7-day expiry, stored in `localStorage` as `token`. Register atomically creates both workspace and user. The `requireAuth` middleware validates the token on every protected route.

### Database Migrations
Plain SQL files in `backend/src/db/migrations/` (e.g. `001_init.sql`). The migration runner (`npm run migrate`) applies files in order and records each in `schema_migrations`, making runs idempotent.
