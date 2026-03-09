# LifeManager — Product Specification

## Problem Statement

Modern life involves many concurrent "projects" running simultaneously — from planning a family dinner to preparing a summer house for rental. The challenge is not a lack of planning tools, but a lack of a unified view that:

- Shows all projects and their tasks together in one realistic timeline
- Makes the load on any given day visible and actionable
- Acts as a daily assistant that keeps execution on track
- Handles the natural slippage of real life gracefully

The goal of LifeManager is to be a personal life assistant that knows your plans and actively helps you execute them — combining the structure of project management with the cadence of agile standups.

---

## Core Concepts

### Two Domains

**Planning Domain** — where you structure goals, phases, and tasks on a timeline.
**Execution Domain** — where you manage daily progress, handle slippage, and stay on track.

---

## Data Model

### Project (Goal)
A project is a top-level goal with a defined start and end. Examples: "Get summer house ready for rental", "Plan kids' dinner", "Summer holiday".

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| title | string | |
| description | text | optional |
| start_date | date | |
| target_end_date | date | |
| owner_id | UUID | user who created it |
| workspace_id | UUID | for multi-user sharing |
| status | enum | active / completed / archived |

---

### Phase
A phase is a high-level chunk of a project — a natural stage of work. Phases are meant to be quick to scratch down and easy to reason about at a glance.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| project_id | UUID | parent project |
| title | string | e.g. "Plan what we're having" |
| order | integer | sequence within project |
| start_date | date | derived or manually set |
| end_date | date | derived or manually set |

---

### Task
A task is an atomic action that belongs to a phase. Tasks are the unit of execution.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| phase_id | UUID | parent phase |
| title | string | |
| description | text | optional |
| effort | decimal | total hours of active work required |
| duration_days | integer | calendar days over which effort is spread |
| start_date | date | when the task begins on the timeline |
| end_date | date | derived from start_date + duration_days |
| deadline | date | nullable — hard constraint, cannot end after this |
| is_locked | boolean | true if deadline is a hard constraint |
| progress_pct | integer | 0–100, % of effort consumed |
| status | enum | not_started / in_progress / completed / deferred |
| owner_id | UUID | defaults to project owner |
| dependencies | UUID[] | list of task IDs that must complete first |

**Key distinction:** `effort` is the actual work hours required. `duration_days` is how many calendar days it spans. A task can have 2 hours of effort spread over 14 days. This distinction is central to the load calculation.

---

### Day Profile (Capacity)
Defines how many productive hours are available on a given day type.

| Field | Type | Notes |
|---|---|---|
| day_type | enum | workday / weekend / vacation |
| work_hours | decimal | hours in professional work (default: 8) |
| commute_hours | decimal | hours lost to commute (default: 1) |
| free_hours | decimal | hours available for personal projects (default: 3) |

Day profiles can be overridden per calendar date (e.g. a specific day off, or a heavy-travel day).

---

### User & Workspace

Every data object belongs to a **workspace**. A workspace can have multiple users. This is the foundation for sharing.

| Field | Notes |
|---|---|
| workspace_id | shared context for a household or group |
| user roles | owner / editor / viewer per workspace |

Cross-user dependencies (Task B owned by User A depends on Task C owned by User B) are supported at the data model level.

---

## Planning Domain — UI

### The Planning View

The primary planning view has three horizontal layers:

**Layer 1 — Phase Ribbon (top)**
A horizontal flow showing: `START → Phase 1 → Phase 2 → Phase 3 → GOAL`
Phases are shown as labelled nodes. This gives an immediate high-level orientation. Clicking a phase filters the Gantt below to that phase's tasks.

**Layer 2 — Gantt (middle)**
Tasks are displayed as horizontal bars on a date axis. Each task bar shows:
- Task name and phase reference (e.g. "1A", "1B")
- A **lock icon** if the task has a hard deadline constraint
- An **internal progress fill** showing how much effort has been consumed vs. remaining (hatched fill = consumed effort, solid = remaining). This makes it immediately visible whether a task is ahead of or behind schedule.
- **Dependency arrows** connecting tasks that have dependencies

**Layer 3 — Load Bar (bottom)**
A continuous bar running along the same date axis showing the ratio of planned effort to available free hours per day. Colour coded:
- **Green** — load is within available capacity
- **Yellow** — load is tight; less buffer than desired
- **Red** — overloaded; more effort planned than time available

The load bar is the primary signal for whether your life plan is realistic.

---

### Gantt Interactions

**Drag to move** — grab a task bar and slide it along the timeline. Effort and duration are preserved. Dependencies update their positions accordingly. If moving a task would violate a deadline constraint, the system warns visually.

**Drag to stretch** — grab either end of a task bar and drag to extend or compress duration. Effort remains fixed; daily load for that task decreases as you stretch it. This is the primary tool for relieving an overloaded (red) day.

**Lock behaviour** — a locked task (hard deadline) cannot be dragged past its deadline date on the right end. It can be stretched leftward or moved earlier.

**Progress update** — clicking a task opens a detail panel where effort consumed can be updated, moving the internal progress fill.

---

## Execution Domain — The Daily Standup

The execution domain is a conversational interface powered by an LLM. It mirrors the rhythm of an agile daily standup.

### Standup Flow

The standup is initiated each morning (or on demand). The assistant:

1. **Reviews yesterday** — identifies tasks that were scheduled for yesterday but not marked complete. For each, it prompts: should this be shifted forward (preserving remaining effort), deferred to a future date, or dropped?

2. **Presents today** — shows the tasks that fall on today's date line across all active projects. Frames them in the context of the overall project: "You're currently 2 days behind on Phase 2 of Summer House. Today's tasks are X and Y."

3. **Flags risks** — highlights any upcoming deadline constraints that are at risk given current progress or load.

4. **Confirms the plan** — the user agrees to today's task list and the standup closes.

### During the Day

- Tasks can be marked complete from a simple "today view" or from the Gantt
- Completing a task triggers a **dependency cascade**: any tasks that were blocked by the completed task are automatically unblocked and their start dates confirmed
- Partially completing a task updates the progress fill and recalculates the load bar

### Rescheduling Logic

When a task slips, the system reschedules intelligently:
- Remaining effort is preserved (only the un-consumed portion)
- Duration is adjusted to maintain the same daily load rate, unless that would breach a deadline
- Dependent tasks shift accordingly
- If rescheduling is impossible without breaching a deadline, the user is warned and asked to resolve the conflict manually or via the assistant

---

## AI / LLM Layer

The LLM is a dedicated **Assistant Service** — a clean internal API that all LLM interactions route through. It is not scattered across individual UI endpoints.

Responsibilities of the Assistant Service:
- Powering the daily standup conversation
- Generating rescheduling suggestions when tasks slip
- Answering natural language questions about the plan ("Am I on track for the summer house?")
- Helping decompose a new goal into phases and tasks on request

The Assistant Service has read access to the full project/task/capacity data for the user's workspace. It does not write directly — all changes are proposed to the user and confirmed before being applied.

**LLM provider:** Anthropic Claude API (claude-sonnet for standup conversations, claude-haiku for lightweight classification tasks).

---

## Calendar Integration

Read-only integration with external calendars via **iCal / CalDAV** — the open standard supported by Google Calendar, Apple Calendar, Outlook, and most other calendar systems.

- External calendar events are imported as **time blocks** on the relevant dates
- Time blocks reduce the available free hours for those dates, directly affecting the load bar calculation
- External events are read-only — LifeManager does not write back to external calendars in MVP

This makes the capacity model significantly more accurate without requiring bespoke integrations per calendar provider.

---

## Multi-User & Sharing

- All data lives within a **workspace** (e.g. a household)
- Multiple users can be members of a workspace with owner or editor roles
- Projects can be **personal** (visible only to the owner) or **shared** (visible to all workspace members)
- Cross-user task dependencies are supported: Task B (owned by User A) can depend on Task C (owned by User B)
- Each user sees the other's load bar in a shared view, enabling coordination ("Can you help me with X?" becomes visible in the timeline)

---

## Architectural Principles (No-Regret Decisions)

These decisions must be reflected in the scaffold from day one:

1. **Full task model from the start** — effort, duration, start, end, deadline, dependencies, owner, progress. Do not simplify the schema and add fields later.

2. **Multi-user data model from the start** — every object has an owner_id and workspace_id, even in single-user mode. Sharing must not require a schema rewrite.

3. **Effort ≠ Duration as a first-class concept** — the scheduling engine, load calculation, and drag interactions all depend on this distinction being consistently applied everywhere.

4. **Time/calendar as the backbone** — the scheduling engine is a distinct, testable backend service. It is not embedded in UI logic or individual API endpoints.

5. **LLM as a service layer** — all AI interactions route through a single Assistant Service. New AI touchpoints are added by extending this service, not by adding ad-hoc LLM calls.

6. **iCal/CalDAV as the calendar standard** — do not build provider-specific integrations. One standard covers all major calendar systems.

---

## Suggested Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React + TypeScript | Component model suits Gantt/calendar UI; strong ecosystem for drag interactions |
| Gantt / Calendar UI | Custom canvas or DHTMLX Gantt / react-big-calendar | Evaluate open-source options before building custom |
| Backend | Node.js + Express (or Python + FastAPI) | Clean REST API; FastAPI has strong typing if Python preferred |
| Database | PostgreSQL | Relational model handles tasks, dependencies, users cleanly |
| LLM | Anthropic Claude API | claude-sonnet for conversations, claude-haiku for lightweight tasks |
| Calendar Sync | ical.js | Parse iCal/CalDAV feeds in JavaScript |
| Container | Docker + Docker Compose | Single command to run the full stack locally on macOS |

---

## MVP Scope

The following are in scope for v1:

- Full data model (projects, phases, tasks with all attributes)
- Planning view: phase ribbon + Gantt + load bar
- Drag to move and drag to stretch interactions
- Daily standup (LLM-powered conversational interface)
- Task completion with dependency cascade
- Capacity model: day type profiles (workday / weekend / vacation)
- Single user (workspace model in place, sharing UI deferred)
- Docker Compose local deployment on macOS

The following are explicitly deferred post-MVP:

- Multi-user sharing UI (data model supports it; invite flow and shared views come later)
- External calendar integration (iCal/CalDAV read-only feed)
- Per-day capacity overrides
- Mobile view

---

## Open Questions (to revisit)

- Which Gantt library to use, or whether to build a custom canvas-based component
- Whether the standup is a chat-style UI or a more structured wizard
- Notification / reminder mechanism (push, email, or in-app only)

---

## Backlog

Tasks are ordered by priority. Claude Code should work top to bottom, marking items `[x]` when complete. Each item should be committed to git before moving to the next.

### Sprint 1 — App Shell & Static Planning View

- [x] **BL-01** Scaffold React + TypeScript frontend running in Docker (Vite, basic routing, empty pages for Planning and Standup views)
- [x] **BL-02** Scaffold Node.js + Express backend running in Docker with a `/health` endpoint
- [x] **BL-03** Set up PostgreSQL in Docker Compose; confirm all three services start with `docker compose up`
- [x] **BL-04** Implement full database schema (projects, phases, tasks, day_profiles, users, workspaces) per the data model in this spec
- [x] **BL-05** Seed the database with realistic dummy data (2–3 projects, each with 2–3 phases and 3–5 tasks) for UI development

### Sprint 2 — Planning View UI

- [ ] **BL-06** Build the Phase Ribbon component — horizontal flow of START → Phase nodes → GOAL, driven by dummy data
- [ ] **BL-07** Build the Gantt component — horizontal task bars on a date axis, labelled with phase reference (e.g. "1A"), driven by dummy data
- [ ] **BL-08** Add lock icon to Gantt bars for tasks with a hard deadline constraint
- [ ] **BL-09** Add internal progress fill to Gantt bars (hatched fill for consumed effort, solid for remaining)
- [ ] **BL-10** Add dependency arrows between connected tasks on the Gantt
- [ ] **BL-11** Build the Load Bar component — colour-coded (green/yellow/red) capacity bar beneath the Gantt on the same date axis, calculated from dummy data

### Sprint 3 — Gantt Interactions

- [ ] **BL-12** Implement drag-to-move on task bars (preserves effort and duration; shifts start/end dates)
- [ ] **BL-13** Implement drag-to-stretch on task bar ends (preserves effort; adjusts duration and recalculates daily load)
- [ ] **BL-14** Enforce lock constraint on drag — locked tasks cannot be dragged past their deadline date
- [ ] **BL-15** Visual warning when a drag would violate a deadline or dependency order
- [ ] **BL-16** Task detail panel — opens on click; allows editing title, effort, duration, deadline, progress

### Sprint 4 — Backend & Real Data

- [ ] **BL-17** REST API: CRUD endpoints for projects, phases, and tasks
- [ ] **BL-18** REST API: scheduling engine endpoint — given a task change (move, stretch, complete), return updated positions for all affected tasks and recalculated load bar values
- [ ] **BL-19** Connect Planning view to live API (replace dummy data with real database data)
- [ ] **BL-20** Persist Gantt interactions (drag-to-move, drag-to-stretch, progress update) to the database via the API

### Sprint 5 — Execution & Standup

- [ ] **BL-21** Build "Today View" — simple list of tasks crossing today's date line, across all active projects, with mark-complete buttons
- [ ] **BL-22** Implement dependency cascade — marking a task complete unblocks dependent tasks and updates their status
- [ ] **BL-23** Set up Anthropic Claude API client as a dedicated Assistant Service module in the backend
- [ ] **BL-24** Build Daily Standup UI — chat-style conversational interface in the Standup view
- [ ] **BL-25** Implement standup flow: review yesterday's incomplete tasks → present today's tasks → flag deadline risks → confirm plan
- [ ] **BL-26** Implement rescheduling logic in the Assistant Service — suggest shifts when tasks slip, propose changes for user confirmation before writing to database

### Sprint 6 — Capacity Model

- [ ] **BL-27** Build Day Profile settings UI — configure free hours for workday / weekend / vacation day types
- [ ] **BL-28** Wire day profiles into the load bar calculation (replace hardcoded capacity with user-defined profiles)
- [ ] **BL-29** Apply capacity model in the standup — flag days where load exceeds available free hours

### Post-MVP (do not build yet)

- [ ] **BL-30** Multi-user sharing UI — workspace invite flow, shared project visibility, cross-user load view
- [ ] **BL-31** External calendar integration — iCal/CalDAV read-only feed, imported as time blocks affecting capacity
- [ ] **BL-32** Per-day capacity overrides — individual date exceptions to day type defaults
- [ ] **BL-33** Mobile-responsive view
