/**
 * GanttChart — Layer 2 of the Planning View.
 *
 * BL-07  Phase reference labels (e.g. "1A", "1B") on each task bar
 * BL-08  Lock icon on bars that have is_locked=true
 * BL-09  Hatched progress fill (consumed effort) + solid remaining fill
 * BL-10  SVG dependency arrows overlaid on the canvas
 * BL-12  Drag-to-move: shifts start/end, preserves effort + duration
 * BL-13  Drag-to-stretch: right/left resize adjusts duration, effort stays fixed
 * BL-14  Lock constraint: moveResizeValidator clamps locked tasks at deadline
 * BL-15  Visual warning banner when a drag violates a deadline or dependency
 * BL-16  Click to open TaskDetailPanel (via selectedTaskId in store)
 *
 * Multi-project collapsible Gantt: all projects shown simultaneously.
 * Collapsed project → single summary bar; expanded → flat task rows + phase markers.
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Timeline, {
  TimelineHeaders,
  SidebarHeader,
  DateHeader,
  type ReactCalendarItemRendererProps,
  type Id,
} from 'react-calendar-timeline';
import moment from 'moment';
import 'react-calendar-timeline/lib/Timeline.css';
import { usePlanningStore } from '../../store/planningStore';
import { useRoutineStore } from '../../store/routineStore';
import type { Task, Phase } from '../../types';

// ── Timeline geometry (must match props passed to <Timeline>) ────────────────
export const SIDEBAR_WIDTH   = 180;
const LINE_HEIGHT     = 44;
const ITEM_HEIGHT_RATIO = 0.72;
const HEADER_HEIGHT   = 60; // two DateHeader rows × ~30px
const HANDLE_WIDTH    = 12; // px — wide enough to grab comfortably

const DEFAULT_VISIBLE_START = moment().subtract(10, 'days').valueOf();
const DEFAULT_VISIBLE_END   = moment().add(35, 'days').valueOf();

interface Props {
  onVisibleTimeChange: (start: number, end: number, canvasWidth: number) => void;
  onAddTask: (projectId: string) => void;
  onAddPhase: (projectId: string) => void;
  onEditPhase: (phase: Phase) => void;
}

interface Arrow { fromTaskId: string; toTaskId: string }

function indexToLetter(i: number) { return String.fromCharCode(65 + i); }
function buildPhaseRef(order: number, idx: number) { return `${order}${indexToLetter(idx)}`; }

function timeToPixel(t: number, vStart: number, vEnd: number, w: number) {
  if (vEnd === vStart) return 0;
  return ((t - vStart) / (vEnd - vStart)) * w;
}

function rowCentreY(idx: number) {
  return HEADER_HEIGHT + idx * LINE_HEIGHT + LINE_HEIGHT / 2;
}

const BAR_COLOR: Record<string, string> = {
  completed:   '#a8d5a2',
  in_progress: '#4a9eff',
  deferred:    '#bbb',
  not_started: '#4a9eff',
};

type TLItem = {
  id: string;
  group: Id;
  title: string;
  start_time: number;
  end_time: number;
  canMove: boolean;
  canResize: false | 'left' | 'both';
};

type TLGroup = {
  id: Id;
  title: string;       // plain string; groupRenderer handles the visual
  taskRef?: string;    // set only for task rows (e.g. "1A")
  category?: 'work' | 'personal';
  menuOpen?: boolean;  // true when the "+" dropdown is open for this project row
};

export function GanttChart({ onVisibleTimeChange, onAddTask, onAddPhase, onEditPhase }: Props) {
  const {
    projects, phases, tasks,
    expandedProjects, toggleProject,
    updateTask, setSelectedTask, deleteProject,
  } = usePlanningStore();

  const { routines, create: createRoutine, delete: deleteRoutine, toggleOccurrence } = useRoutineStore();

  // Uncontrolled: Gantt owns its scroll position; notifies parent for LoadBar sync only
  const [visibleTime, setVisibleTime] = useState({
    start: DEFAULT_VISIBLE_START,
    end:   DEFAULT_VISIBLE_END,
  });

  // Container size — only update if the measured width is positive so a transient
  // zero from a ResizeObserver flush during a height-only change doesn't hide the SVG overlay.
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((e) => {
      const w = e[0].contentRect.width;
      if (w > 0) setContainerWidth(w);
    });
    ro.observe(containerRef.current);
    const initial = containerRef.current.clientWidth;
    if (initial > 0) setContainerWidth(initial);
    return () => ro.disconnect();
  }, []);
  const canvasWidth = containerWidth - SIDEBAR_WIDTH;

  // Smooth trackpad scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const delta = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : 0;
      if (delta === 0) return; // let the browser handle vertical scroll natively
      e.preventDefault();
      const scrollEl = el.querySelector('.rct-scroll') as HTMLElement | null;
      if (scrollEl) scrollEl.scrollLeft += delta * 0.6;
    };
    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', onWheel, { capture: true });
  }, []);

  // Category filter
  const [showWork,     setShowWork]     = useState(true);
  const [showPersonal, setShowPersonal] = useState(true);

  // BL-34: popup menu — tracks which project's "+" is open + the button's screen position
  const [addMenuProjectId, setAddMenuProjectId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const openAddMenu = useCallback((projectId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (addMenuProjectId === projectId) { setAddMenuProjectId(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom, left: rect.left });
    setAddMenuProjectId(projectId);
  }, [addMenuProjectId]);

  // Close the add-menu when clicking anywhere outside
  useEffect(() => {
    if (!addMenuProjectId) return;
    const handler = () => setAddMenuProjectId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [addMenuProjectId]);

  // BL-15: warning message (auto-dismisses after 4 s)
  const [warning, setWarning] = useState<string | null>(null);
  useEffect(() => {
    if (!warning) return;
    const id = setTimeout(() => setWarning(null), 4000);
    return () => clearTimeout(id);
  }, [warning]);

  // ── Build groups, items, and lookup maps ──────────────────────────────────
  const {
    groups,
    items,
    taskById,
    groupIndexById,
    phaseRefMap,
    phaseFirstRowIndex,
    dependentsOf,
    arrows,
  } = useMemo(() => {
    const groups: TLGroup[] = [];
    const items: TLItem[] = [];
    const taskById = new Map<string, Task>();
    const groupIndexById = new Map<string, number>(); // taskId → index in groups array
    const phaseRefMap = new Map<string, string>();
    const phaseFirstRowIndex = new Map<string, number>(); // phaseId → groups array index

    // ── Routine swimlanes (pinned above project rows) ─────────────────────────
    const visibleRoutines = routines.filter((r) =>
      (r.category === 'work' && showWork) || (r.category === 'personal' && showPersonal),
    );
    {
      // Section header always shown so the "+" button is always accessible
      groups.push({ id: '__routines_header__', title: 'Routines' });
      for (const routine of visibleRoutines) {
        const groupId = '__routine__' + routine.id;
        groups.push({ id: groupId, title: routine.name, category: routine.category });
        // One item per scheduled occurrence
        for (const date of routine.occurrences) {
          const start = moment(date).valueOf();
          const end   = moment(date).add(1, 'day').valueOf();
          items.push({
            id: `__occ__${routine.id}__${date}`,
            group: groupId,
            title: routine.name,
            start_time: start,
            end_time: end,
            canMove: false,
            canResize: false,
          });
        }
      }
    }

    for (const project of projects) {
      const isExpanded = expandedProjects.has(project.id);
      const projHeaderId = '__proj__' + project.id;

      // Project header group — title is plain string; groupRenderer handles visuals
      const headerGroupIndex = groups.length;
      groups.push({ id: projHeaderId, title: project.title, menuOpen: addMenuProjectId === project.id });

      if (!isExpanded) {
        // Summary bar spanning full project date range
        const projectPhases = phases[project.id] ?? [];
        const allProjectTasks: Task[] = projectPhases.flatMap((ph) => tasks[ph.id] ?? []);

        let sumStart: number;
        let sumEnd: number;
        if (allProjectTasks.length > 0) {
          sumStart = Math.min(...allProjectTasks.map((t) => moment(t.start_date).valueOf()));
          sumEnd = Math.max(...allProjectTasks.map((t) => moment(t.end_date).add(1, 'day').valueOf()));
        } else {
          sumStart = moment(project.start_date).valueOf();
          sumEnd = moment(project.target_end_date).add(1, 'day').valueOf();
        }

        items.push({
          id: '__sum__' + project.id,
          group: projHeaderId,
          title: project.title,
          start_time: sumStart,
          end_time: sumEnd,
          canMove: false,
          canResize: false,
        });
      } else {
        // Expanded: flat task rows per phase
        const rowsBefore = groups.length;
        const projectPhases = (phases[project.id] ?? [])
          .slice().sort((a: Phase, b: Phase) => a.order - b.order);

        for (const ph of projectPhases) {
          const phaseTasks = (tasks[ph.id] ?? [])
            .slice().sort((a: Task, b: Task) => a.start_date.localeCompare(b.start_date))
            .filter((t: Task) => {
              const cat = t.category ?? 'personal';
              return (cat === 'work' && showWork) || (cat === 'personal' && showPersonal);
            });

          let firstTaskInPhase = true;
          phaseTasks.forEach((t, idx) => {
            const groupIdx = groups.length;

            // Track first row index for phase markers
            if (firstTaskInPhase) {
              phaseFirstRowIndex.set(ph.id, groupIdx);
              firstTaskInPhase = false;
            }

            const ref = buildPhaseRef(ph.order, idx);
            phaseRefMap.set(t.id, ref);
            groupIndexById.set(t.id, groupIdx);
            taskById.set(t.id, t);

            groups.push({ id: t.id, title: t.title, taskRef: ref, category: t.category ?? 'personal' });

            items.push({
              id: t.id,
              group: t.id as Id,
              title: t.title,
              start_time: moment(t.start_date).valueOf(),
              end_time: moment(t.end_date).add(1, 'day').valueOf(),
              canMove: !t.is_locked,
              canResize: t.is_locked ? 'left' : 'both',
            });
          });
        }
        // If the filter hid all tasks, remove the project header so the row doesn't appear empty
        if (groups.length === rowsBefore) {
          groups.pop();
        }
      }

    }

    // Reverse dependency map: taskId → tasks that depend on it
    const dependentsOf = new Map<string, string[]>();
    for (const [, t] of taskById) {
      for (const depId of t.dependencies ?? []) {
        if (!dependentsOf.has(depId)) dependentsOf.set(depId, []);
        dependentsOf.get(depId)!.push(t.id);
      }
    }

    // Dependency arrows — only where both endpoints are visible (in expanded projects)
    const arrows: Arrow[] = [];
    for (const [, t] of taskById) {
      for (const depId of t.dependencies ?? []) {
        if (taskById.has(depId)) arrows.push({ fromTaskId: depId, toTaskId: t.id });
      }
    }

  }, [projects, phases, tasks, expandedProjects, toggleProject, addMenuProjectId, showWork, showPersonal, routines]);

  // ── BL-14: move/resize validator ──────────────────────────────────────────
  const moveResizeValidator = useCallback(
    (action: 'move' | 'resize', itemId: Id, time: number, edge?: 'left' | 'right'): number => {
      const idStr = String(itemId);
      if (idStr.startsWith('__sum__')) return time;

      const task = taskById.get(idStr);
      if (!task || !task.is_locked || !task.deadline) return time;

      const deadlineMs = moment(task.deadline).add(1, 'day').valueOf();

      if (action === 'move') {
        const newEndMs = time + (task.duration_days - 1) * 86_400_000;
        if (newEndMs >= deadlineMs) {
          return deadlineMs - task.duration_days * 86_400_000;
        }
      }
      if (action === 'resize' && edge === 'right') {
        if (time > deadlineMs) {
          setWarning(`"${task.title}" is locked — cannot extend past deadline ${task.deadline}`);
          return deadlineMs;
        }
      }
      return time;
    },
    [taskById],
  );

  // BL-36: delete project handler
  const handleDeleteProject = useCallback((projectId: string, projectTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Delete project "${projectTitle}"? This will permanently delete all phases and tasks. This cannot be undone.`
    );
    if (confirmed) deleteProject(projectId);
  }, [deleteProject]);

  // ── Group renderer — used instead of group.title so buttons get pointer events ──
  const handleAddRoutine = useCallback(async () => {
    const name = window.prompt('Routine name (e.g. GYM, Weekly review):');
    if (!name?.trim()) return;
    const effortStr = window.prompt('Effort in hours (e.g. 1.5):', '1');
    const effort_hours = Math.max(0.25, parseFloat(effortStr ?? '1') || 1);
    const catRaw = window.prompt('Category — type "work" or "personal":', 'personal');
    const category = catRaw?.trim() === 'work' ? 'work' : 'personal';
    await createRoutine({ name: name.trim(), category, effort_hours });
  }, [createRoutine]);

  const groupRenderer = useCallback(({ group }: { group: TLGroup }) => {
    const idStr = String(group.id);

    // Routines section header
    if (idStr === '__routines_header__') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', background: '#312e81', color: 'white', margin: '0 -4px', gap: 6, padding: '0 8px', fontSize: 12, fontWeight: 700 }}>
          <span style={{ flex: 1 }}>🔁 Routines</span>
          <button
            onClick={(e) => { e.stopPropagation(); handleAddRoutine(); }}
            title="Add routine"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.85)', fontSize: 20, lineHeight: 1, padding: '0 4px' }}
          >+</button>
        </div>
      );
    }

    // Routine row
    if (idStr.startsWith('__routine__')) {
      const routineId = idStr.replace('__routine__', '');
      const routine = routines.find((r) => r.id === routineId);
      return (
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingLeft: 12, gap: 4, fontSize: 11, color: '#555' }}>
          <span>{group.category === 'work' ? '💼' : '🌿'}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.title}</span>
          {routine && (
            <span style={{ fontSize: 10, color: '#aaa', marginRight: 2 }}>{routine.effort_hours}h</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete routine "${group.title}"?`)) deleteRoutine(routineId); }}
            title="Delete routine"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(200,100,100,0.6)', fontSize: 13, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}
          >🗑</button>
        </div>
      );
    }

    if (idStr.startsWith('__proj__')) {
      const projectId = idStr.replace('__proj__', '');
      const project = projects.find((p) => p.id === projectId);
      const isExpanded = expandedProjects.has(projectId);
      return (
        <div
          onClick={() => toggleProject(projectId)}
          style={{ display: 'flex', alignItems: 'center', height: '100%', background: '#1e293b', color: 'white', margin: '0 -4px', gap: 6, padding: '0 8px', cursor: 'pointer', fontSize: 12, fontWeight: 700, position: 'relative' }}
        >
          <span>{isExpanded ? '▼' : '▶'}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{project?.title}</span>
          {/* BL-34: "+" add menu — dropdown rendered via portal to escape overflow clipping */}
          <button
            onClick={(e) => openAddMenu(projectId, e)}
            title={`Add to ${project?.title}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.85)', fontSize: 20, lineHeight: 1, padding: '0 4px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
          >+</button>
          {/* BL-36: delete button */}
          <button
            onClick={(e) => handleDeleteProject(projectId, project?.title ?? '', e)}
            title="Delete project"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,100,100,0.7)', fontSize: 15, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
          >🗑</button>
        </div>
      );
    }
    // Task row
    return (
      <span style={{ fontSize: 11, color: '#555', paddingLeft: 8, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
        {group.taskRef && <span style={{ color: '#999', fontFamily: 'monospace', flexShrink: 0 }}>{group.taskRef}</span>}
        <span style={{ fontSize: 10, flexShrink: 0 }} title={group.category === 'work' ? 'Work' : 'Personal'}>
          {group.category === 'work' ? '💼' : '🌿'}
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.title}</span>
      </span>
    );
  }, [projects, expandedProjects, toggleProject, handleDeleteProject, openAddMenu, routines, handleAddRoutine, deleteRoutine]);

  // ── BL-12: drag-to-move ───────────────────────────────────────────────────
  const handleItemMove = useCallback(
    (itemId: Id, dragTime: number) => {
      const idStr = String(itemId);
      if (idStr.startsWith('__sum__')) return;
      const task = taskById.get(idStr);
      if (!task) return;

      const newStart = moment(dragTime).format('YYYY-MM-DD');
      const newEnd   = moment(dragTime).add(task.duration_days - 1, 'days').format('YYYY-MM-DD');

      for (const depId of task.dependencies ?? []) {
        const dep = taskById.get(depId);
        if (dep && newStart <= dep.end_date) {
          setWarning(`"${task.title}" starts before "${dep.title}" finishes — dependency may be violated`);
          break;
        }
      }
      for (const depId of (dependentsOf.get(task.id) ?? [])) {
        const dep = taskById.get(depId);
        if (dep && newEnd >= dep.start_date) {
          setWarning(`Moving "${task.title}" may push "${dep.title}" — check the dependency chain`);
          break;
        }
      }
      if (!task.is_locked && task.deadline && newEnd > task.deadline) {
        setWarning(`"${task.title}" will end after its deadline (${task.deadline})`);
      }

      updateTask(idStr, { start_date: newStart });
    },
    [taskById, dependentsOf, updateTask],
  );

  // ── BL-13: drag-to-stretch ────────────────────────────────────────────────
  const handleItemResize = useCallback(
    (itemId: Id, time: number, edge: 'left' | 'right') => {
      const idStr = String(itemId);
      if (idStr.startsWith('__sum__')) return;
      const task = taskById.get(idStr);
      if (!task) return;

      if (edge === 'right') {
        const newEnd = moment(time).subtract(1, 'day').format('YYYY-MM-DD');
        const dur    = Math.max(1, moment(newEnd).diff(moment(task.start_date), 'days') + 1);
        if (!task.is_locked && task.deadline && newEnd > task.deadline) {
          setWarning(`"${task.title}" will end after its deadline (${task.deadline})`);
        }
        updateTask(idStr, { duration_days: dur });
      } else {
        const newStart = moment(time).format('YYYY-MM-DD');
        const dur      = Math.max(1, moment(task.end_date).diff(moment(newStart), 'days') + 1);
        updateTask(idStr, { start_date: newStart, duration_days: dur });
      }
    },
    [taskById, updateTask],
  );

  // ── BL-16: click to open detail panel ────────────────────────────────────
  const handleItemClick = useCallback(
    (itemId: Id) => {
      const idStr = String(itemId);
      if (idStr.startsWith('__sum__')) {
        toggleProject(idStr.replace('__sum__', ''));
      } else if (idStr.startsWith('__occ__')) {
        // Occurrence clicks are handled directly in itemRenderer via onClick+stopPropagation.
        // This branch only fires if the click somehow wasn't stopped — ignore it.
        return;
      } else {
        setSelectedTask(idStr);
      }
    },
    [setSelectedTask, toggleProject, toggleOccurrence],
  );

  // Canvas click — add routine occurrence when clicking an empty part of a routine row.
  // Item clicks are handled in itemRenderer with stopPropagation, so this only fires
  // when clicking genuinely empty canvas space within a __routine__ row.
  const handleCanvasClick = useCallback(
    (groupId: Id, time: number) => {
      const idStr = String(groupId);
      if (!idStr.startsWith('__routine__')) return;
      const routineId = idStr.replace('__routine__', '');
      const date = moment(time).format('YYYY-MM-DD');
      toggleOccurrence(routineId, date).catch(() => {});
    },
    [toggleOccurrence],
  );

  const handleTimeChange = (
    start: number, end: number,
    updateScrollCanvas: (s: number, e: number) => void,
  ) => {
    updateScrollCanvas(start, end);
    setVisibleTime({ start, end });
    if (canvasWidth > 0) onVisibleTimeChange(start, end, canvasWidth);
  };

  // ── Custom item renderer (BL-07/08/09) ───────────────────────────────────
  const itemRenderer = useCallback(
    ({ item, itemContext, getItemProps, getResizeProps }: ReactCalendarItemRendererProps<TLItem>) => {
      const idStr = String(item.id);

      // Routine occurrence block
      if (idStr.startsWith('__occ__')) {
        const parts = idStr.replace('__occ__', '').split('__');
        const routineId = parts[0];
        const occDate   = parts[1];
        const routine = routines.find((r) => r.id === routineId);
        const color = routine?.category === 'work' ? '#1d6fa4' : '#7c3aed';
        const { style: itemStyle, ...rest } = getItemProps({});
        return (
          <div
            {...rest}
            // Stop propagation so the canvas-click handler doesn't also fire
            // (it receives a wrong offsetX from the item element, computing an
            // incorrect date and toggling the wrong occurrence).
            onClick={(e) => {
              e.stopPropagation();
              toggleOccurrence(routineId, occDate).catch(() => {});
            }}
            title={`${routine?.name} (${routine?.effort_hours}h) — click to remove`}
            style={{
              ...itemStyle,
              background: color,
              opacity: 0.75,
              borderRadius: 4,
              border: `2px solid ${color}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: 'white',
              fontWeight: 700,
              overflow: 'hidden',
            }}
          >
            {routine?.category === 'work' ? '💼' : '🌿'}
          </div>
        );
      }

      // Summary bar for collapsed project
      if (idStr.startsWith('__sum__')) {
        const { style: itemStyle, ...rest } = getItemProps({});
        return (
          <div
            {...rest}
            style={{
              ...itemStyle,
              background: '#475569',
              borderRadius: 5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: 11,
              overflow: 'hidden',
              border: '1px solid rgba(0,0,0,0.2)',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 8px' }}>
              {item.title}
            </span>
          </div>
        );
      }

      const task = taskById.get(idStr);
      if (!task) return null;

      const consumed = task.progress_pct / 100;
      const deadlineBreach = !!task.deadline && task.end_date > task.deadline;

      const deadlineCap =
        deadlineBreach    ? '#ef4444' :
        task.is_locked    ? '#ef4444' :
        task.deadline     ? '#f59e0b' :
        null;

      // BL-36: detect dependency violation during drag
      let depViolated = false;
      if (itemContext.dragging) {
        const newStartDate = moment(item.start_time).format('YYYY-MM-DD');
        for (const depId of task.dependencies ?? []) {
          const dep = taskById.get(depId);
          if (dep && newStartDate < dep.end_date) { depViolated = true; break; }
        }
      }

      const { style: itemStyle, ...rest } = getItemProps({});
      const { left: leftResizeProps, right: rightResizeProps } = getResizeProps({
        leftStyle:  { width: HANDLE_WIDTH, cursor: 'ew-resize', zIndex: 90 },
        rightStyle: { width: HANDLE_WIDTH, cursor: 'ew-resize', zIndex: 90 },
      });

      return (
        <div
          {...rest}
          style={{
            ...itemStyle,
            background: depViolated ? '#ef4444' : (BAR_COLOR[task.status] ?? '#4a9eff'),
            borderRadius: 4,
            border: '1px solid rgba(0,0,0,0.15)',
            overflow: 'hidden',
            cursor: 'grab',
          }}
        >
          {itemContext.useResizeHandle && <div {...leftResizeProps} />}
          {itemContext.useResizeHandle && <div {...rightResizeProps} />}

          {deadlineCap && (
            <div style={{
              position: 'absolute', top: 0, right: 0, bottom: 0,
              width: 6,
              background: deadlineCap,
              pointerEvents: 'none',
              zIndex: 2,
            }} />
          )}

          {consumed > 0 && (
            <div style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              width: `${consumed * 100}%`,
              background: 'repeating-linear-gradient(45deg,rgba(0,0,0,0.18),rgba(0,0,0,0.18) 3px,transparent 3px,transparent 7px)',
              borderRight: consumed < 1 ? '1px dashed rgba(0,0,0,0.25)' : 'none',
              pointerEvents: 'none',
            }} />
          )}
          <div style={{
            position: 'relative', zIndex: 1,
            display: 'flex', alignItems: 'center',
            height: '100%',
            paddingLeft: HANDLE_WIDTH + 2,
            paddingRight: HANDLE_WIDTH + 2,
            gap: 4,
            fontSize: 11, color: task.status === 'completed' ? '#2d6a29' : 'white',
            whiteSpace: 'nowrap', overflow: 'hidden',
            pointerEvents: 'none',
          }}>
            {task.is_locked && <span style={{ fontSize: 10 }}>🔒</span>}
            <span style={{ opacity: 0.7, fontFamily: 'monospace', fontSize: 10 }}>
              {phaseRefMap.get(task.id)}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</span>
            {task.progress_pct > 0 && task.status !== 'completed' && (
              <span style={{ marginLeft: 'auto', opacity: 0.8, fontSize: 10 }}>{task.progress_pct}%</span>
            )}
          </div>
        </div>
      );
    },
    [taskById, phaseRefMap, routines],
  );

  if (groups.length === 0) {
    return (
      <div style={{ padding: '2rem', color: '#888', textAlign: 'center' }}>
        No projects to display.
      </div>
    );
  }

  return (
    <>
    {/* Category filter toolbar */}
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '5px 8px 5px', paddingLeft: SIDEBAR_WIDTH + 8,
      borderBottom: '1px solid #e8e8e8',
      background: '#fafafa',
      fontSize: 12, color: '#555',
    }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Show:</span>
      {([['work', '💼 Work', showWork, setShowWork], ['personal', '🌿 Personal', showPersonal, setShowPersonal]] as const).map(([key, label, checked, setter]) => (
        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setter(e.target.checked)}
            style={{ accentColor: key === 'work' ? '#1d6fa4' : '#7c3aed', width: 13, height: 13 }}
          />
          <span style={{ opacity: checked ? 1 : 0.4 }}>{label}</span>
        </label>
      ))}
    </div>
    <div ref={containerRef} style={{ position: 'relative', height: HEADER_HEIGHT + groups.length * LINE_HEIGHT, overflow: 'hidden' }}>
      {/* BL-30: suppress react-calendar-timeline's selected-item highlight (red outline) and today-line */}
      <style>{`
        .rct-item.selected { box-shadow: none !important; border-color: transparent !important; }
        .rct-items .rct-item.selected { outline: none !important; }
        .rct-today-line { display: none !important; }
        .rct-cursor-line { display: none !important; }
        .rct-header-root { background: #f5f5f5 !important; }
        .rct-sidebar { border-right: 1px solid #ddd !important; box-sizing: border-box !important; }
        .rct-sidebar-header { border-right: 1px solid #ddd !important; box-sizing: border-box !important; }
      `}</style>
      <Timeline
        groups={groups}
        items={items}
        defaultTimeStart={moment(DEFAULT_VISIBLE_START)}
        defaultTimeEnd={moment(DEFAULT_VISIBLE_END)}
        onTimeChange={handleTimeChange}
        onItemMove={handleItemMove}
        onItemResize={handleItemResize}
        onItemClick={handleItemClick}
        onCanvasClick={handleCanvasClick}
        itemRenderer={itemRenderer}
        groupRenderer={groupRenderer}
        moveResizeValidator={moveResizeValidator}
        sidebarWidth={SIDEBAR_WIDTH}
        lineHeight={LINE_HEIGHT}
        itemHeightRatio={ITEM_HEIGHT_RATIO}
        stackItems={false}
        canChangeGroup={false}
        useResizeHandle
      >
        <TimelineHeaders>
          <SidebarHeader>
            {({ getRootProps }: { getRootProps: () => React.HTMLAttributes<HTMLDivElement> }) => {
              const rootProps = getRootProps();
              return (
                <div {...rootProps} style={{
                  ...rootProps.style,
                  background: '#f5f5f5',
                  borderRight: '1px solid #ddd',
                  boxSizing: 'border-box',
                  fontWeight: 600, fontSize: 11, color: '#666',
                  padding: '0 10px', display: 'flex', alignItems: 'center',
                }}>
                  Task
                </div>
              );
            }}
          </SidebarHeader>
          <DateHeader unit="month" />
          <DateHeader unit="day" labelFormat="D" />
        </TimelineHeaders>
      </Timeline>

      {/* BL-15: constraint warning banner */}
      {warning && (
        <div style={{
          position: 'absolute', top: HEADER_HEIGHT + 6,
          left: SIDEBAR_WIDTH + 8, right: 8, zIndex: 20,
          background: '#fffbeb', border: '1px solid #f59e0b',
          borderRadius: 5, padding: '6px 10px 6px 12px',
          fontSize: 12, color: '#92400e',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          <span>⚠</span>
          <span style={{ flex: 1 }}>{warning}</span>
          <button
            onClick={() => setWarning(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#b45309', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {/* BL-10: dependency arrows — own SVG with overflow:visible so nothing gets clipped */}
      {canvasWidth > 0 && (
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 202 }}>
          {arrows.map(({ fromTaskId, toTaskId }) => {
            const from = taskById.get(fromTaskId);
            const to   = taskById.get(toTaskId);
            if (!from || !to) return null;

            const fx = SIDEBAR_WIDTH + timeToPixel(moment(from.end_date).add(1, 'day').valueOf(), visibleTime.start, visibleTime.end, canvasWidth);
            const fy = rowCentreY(groupIndexById.get(fromTaskId) ?? 0);
            const tx = SIDEBAR_WIDTH + timeToPixel(moment(to.start_date).valueOf(), visibleTime.start, visibleTime.end, canvasWidth);
            const ty = rowCentreY(groupIndexById.get(toTaskId) ?? 0);

            if ((fx < SIDEBAR_WIDTH && tx < SIDEBAR_WIDTH) || (fx > SIDEBAR_WIDTH + canvasWidth && tx > SIDEBAR_WIDTH + canvasWidth)) return null;

            const cp = Math.max(Math.abs(tx - fx) * 0.4, 20);
            // Manual arrowhead (pointing right, horizontal entry) — avoids SVG marker reference issues
            const aLen = 8; const aW = 4;
            return (
              <g key={`${fromTaskId}-${toTaskId}`}>
                <path
                  d={`M ${fx} ${fy} C ${fx + cp} ${fy}, ${tx - cp} ${ty}, ${tx} ${ty}`}
                  fill="none" stroke="#f59e0b" strokeWidth="2" strokeOpacity="0.85"
                />
                <polygon
                  points={`${tx},${ty} ${tx - aLen},${ty - aW} ${tx - aLen},${ty + aW}`}
                  fill="#f59e0b" fillOpacity="0.85"
                />
              </g>
            );
          })}
        </svg>
      )}

      {/* Phase bracket markers SVG overlay */}
      {canvasWidth > 0 && (
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden', zIndex: 200 }}>
          <defs>
            <clipPath id="gantt-canvas-clip">
              <rect x={SIDEBAR_WIDTH} y={HEADER_HEIGHT} width={canvasWidth} height="100%" />
            </clipPath>
          </defs>
          <g clipPath="url(#gantt-canvas-clip)">
            {/* Phase bracket markers for expanded projects */}
            {projects.filter((p) => expandedProjects.has(p.id)).flatMap((project) => {
              const projectPhases = (phases[project.id] ?? [])
                .slice().sort((a: Phase, b: Phase) => a.order - b.order);

              return projectPhases.map((ph) => {
                const rowIndex = phaseFirstRowIndex.get(ph.id);
                if (rowIndex === undefined) return null;

                // Always derive span from actual tasks so the bracket matches the bars exactly
                const phaseTasks = tasks[ph.id] ?? [];
                if (phaseTasks.length === 0) return null;
                const resolvedStartDate = phaseTasks.slice().sort((a, b) => a.start_date.localeCompare(b.start_date))[0].start_date;
                const resolvedEndDate   = phaseTasks.slice().sort((a, b) => b.end_date.localeCompare(a.end_date))[0].end_date;

                const startX = SIDEBAR_WIDTH + timeToPixel(moment(resolvedStartDate).valueOf(), visibleTime.start, visibleTime.end, canvasWidth);
                const endX   = SIDEBAR_WIDTH + timeToPixel(moment(resolvedEndDate).add(1, 'day').valueOf(), visibleTime.start, visibleTime.end, canvasWidth);

                // Clamp: skip if entirely off-screen
                if (endX < SIDEBAR_WIDTH || startX > SIDEBAR_WIDTH + canvasWidth) return null;

                const clampedStartX = Math.max(startX, SIDEBAR_WIDTH);
                const clampedEndX   = Math.min(endX, SIDEBAR_WIDTH + canvasWidth);

                // Bracket sits at the very top of the first task row
                const rowTop   = HEADER_HEIGHT + rowIndex * LINE_HEIGHT;
                const lineY    = rowTop + 5;   // thin horizontal line y
                const tickBotY = lineY + 7;    // left tick drops down
                const arrowTipY = lineY + 12;  // downward arrow tip at right end
                const arrowW    = 7;           // half-width of arrowhead

                // Label badge — centred on visible portion of the bracket
                const midX = (clampedStartX + clampedEndX) / 2;
                const label = ph.title;
                const charW = 6.5; // approx px per char at fontSize 11
                const labelPad = 6;
                const labelW = label.length * charW + labelPad * 2;
                const labelH = 16;
                const labelX = Math.min(Math.max(midX - labelW / 2, clampedStartX), clampedEndX - labelW);
                const labelY = lineY - labelH - 2; // above the line

                return (
                  <g key={`phase-marker-${ph.id}`}>
                    {/* Horizontal bracket line */}
                    <line x1={clampedStartX} y1={lineY} x2={clampedEndX} y2={lineY}
                      stroke="#1e293b" strokeWidth="2" />

                    {/* Left vertical tick (only if start is visible) */}
                    {startX >= SIDEBAR_WIDTH && (
                      <line x1={startX} y1={lineY} x2={startX} y2={tickBotY}
                        stroke="#1e293b" strokeWidth="2" />
                    )}

                    {/* Right downward arrowhead (only if end is visible) */}
                    {endX <= SIDEBAR_WIDTH + canvasWidth && (
                      <polygon
                        points={`${endX},${arrowTipY} ${endX - arrowW},${lineY} ${endX + arrowW},${lineY}`}
                        fill="#1e293b"
                      />
                    )}

                    {/* Label badge above the line */}
                    <rect x={labelX} y={labelY} width={labelW} height={labelH} rx={3}
                      fill="#1e293b" />
                    <text
                      x={labelX + labelW / 2} y={labelY + labelH / 2}
                      fontSize={11} fontWeight="700" fill="white"
                      textAnchor="middle" dominantBaseline="central"
                    >
                      {label}
                    </text>
                  </g>
                );
              });
            })}
          </g>
        </svg>
      )}


      {/* BL-38: Clickable phase label HTML overlays — positioned over the SVG labels.
           HTML buttons receive pointer events where the SVG elements cannot. */}
      {canvasWidth > 0 && projects.filter((p) => expandedProjects.has(p.id)).flatMap((project) => {
        const projectPhases = (phases[project.id] ?? []).slice().sort((a: Phase, b: Phase) => a.order - b.order);
        return projectPhases.map((ph) => {
          const rowIndex = phaseFirstRowIndex.get(ph.id);
          if (rowIndex === undefined) return null;
          const phaseTasks = tasks[ph.id] ?? [];
          if (phaseTasks.length === 0) return null;
          const resolvedStartDate = phaseTasks.slice().sort((a, b) => a.start_date.localeCompare(b.start_date))[0].start_date;
          const resolvedEndDate = phaseTasks.slice().sort((a, b) => b.end_date.localeCompare(a.end_date))[0].end_date;
          const startX = SIDEBAR_WIDTH + timeToPixel(moment(resolvedStartDate).valueOf(), visibleTime.start, visibleTime.end, canvasWidth);
          const endX = SIDEBAR_WIDTH + timeToPixel(moment(resolvedEndDate).add(1, 'day').valueOf(), visibleTime.start, visibleTime.end, canvasWidth);
          if (endX < SIDEBAR_WIDTH || startX > SIDEBAR_WIDTH + canvasWidth) return null;
          const clampedStartX = Math.max(startX, SIDEBAR_WIDTH);
          const clampedEndX = Math.min(endX, SIDEBAR_WIDTH + canvasWidth);
          const rowTop = HEADER_HEIGHT + rowIndex * LINE_HEIGHT;
          const lineY = rowTop + 5;
          const labelH = 16;
          const label = ph.title;
          const charW = 6.5;
          const labelPad = 6;
          const labelW = label.length * charW + labelPad * 2;
          const midX = (clampedStartX + clampedEndX) / 2;
          const labelX = Math.min(Math.max(midX - labelW / 2, clampedStartX), clampedEndX - labelW);
          const labelY = lineY - labelH - 2;
          return (
            <button
              key={`phase-btn-${ph.id}`}
              onClick={() => onEditPhase(ph)}
              title={`Edit phase: ${ph.title}`}
              style={{
                position: 'absolute',
                left: labelX, top: labelY,
                width: labelW, height: labelH,
                background: 'transparent', border: 'none', cursor: 'pointer',
                zIndex: 85, padding: 0,
              }}
            />
          );
        });
      })}

    </div>
    {/* BL-34: "+" dropdown — portaled to document.body so it escapes all overflow clipping */}
    {addMenuProjectId && createPortal(
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: menuPos.top,
          left: menuPos.left,
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999,
          minWidth: 130,
          overflow: 'hidden',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <button
          onClick={() => { onAddTask(addMenuProjectId); setAddMenuProjectId(null); }}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#222' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >Add Task</button>
        <button
          onClick={() => { onAddPhase(addMenuProjectId); setAddMenuProjectId(null); }}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#222', borderTop: '1px solid #f0f0f0' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >Add Phase</button>
      </div>,
      document.body,
    )}
    </>
  );
}
