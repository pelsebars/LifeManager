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
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
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
import type { Task, Phase } from '../../types';

// ── Timeline geometry (must match props passed to <Timeline>) ────────────────
const SIDEBAR_WIDTH   = 180;
const LINE_HEIGHT     = 44;
const ITEM_HEIGHT_RATIO = 0.72;
const HEADER_HEIGHT   = 60; // two DateHeader rows × ~30px

interface Props { projectId: string }

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
  canResize: 'left' | 'both';
};

export function GanttChart({ projectId }: Props) {
  const { phases, tasks, selectedPhaseId, updateTask, setSelectedTask } = usePlanningStore();

  const projectPhases = (phases[projectId] ?? [])
    .slice().sort((a: Phase, b: Phase) => a.order - b.order);

  const visiblePhases = selectedPhaseId
    ? projectPhases.filter((ph: Phase) => ph.id === selectedPhaseId)
    : projectPhases;

  const allTasks: Task[] = visiblePhases.flatMap((ph: Phase) =>
    (tasks[ph.id] ?? []).slice().sort(
      (a: Task, b: Task) => a.start_date.localeCompare(b.start_date),
    ),
  );

  const taskById        = new Map(allTasks.map((t) => [t.id, t]));
  const groupIndexById  = new Map(allTasks.map((t, i) => [t.id, i]));

  // Reverse dependency map: taskId → tasks that depend on it
  const dependentsOf = new Map<string, string[]>();
  for (const t of allTasks) {
    for (const depId of t.dependencies) {
      if (!dependentsOf.has(depId)) dependentsOf.set(depId, []);
      dependentsOf.get(depId)!.push(t.id);
    }
  }

  // Phase reference labels
  const phaseRefMap = new Map<string, string>();
  visiblePhases.forEach((ph: Phase) => {
    (tasks[ph.id] ?? [])
      .slice().sort((a: Task, b: Task) => a.start_date.localeCompare(b.start_date))
      .forEach((t: Task, idx: number) => phaseRefMap.set(t.id, buildPhaseRef(ph.order, idx)));
  });

  // Dependency arrows
  const arrows: Arrow[] = [];
  for (const t of allTasks) {
    for (const depId of t.dependencies) {
      if (groupIndexById.has(depId)) arrows.push({ fromTaskId: depId, toTaskId: t.id });
    }
  }

  // Visible time + container size
  const defaultStart = moment().subtract(10, 'days');
  const defaultEnd   = moment().add(35, 'days');
  const [visibleTime, setVisibleTime] = useState({ start: defaultStart.valueOf(), end: defaultEnd.valueOf() });
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((e) => setContainerWidth(e[0].contentRect.width));
    ro.observe(containerRef.current);
    setContainerWidth(containerRef.current.clientWidth);
    return () => ro.disconnect();
  }, []);
  const canvasWidth = containerWidth - SIDEBAR_WIDTH;

  // BL-15: warning message (auto-dismisses after 4 s)
  const [warning, setWarning] = useState<string | null>(null);
  useEffect(() => {
    if (!warning) return;
    const id = setTimeout(() => setWarning(null), 4000);
    return () => clearTimeout(id);
  }, [warning]);

  // ── BL-14: move/resize validator ──────────────────────────────────────────
  const moveResizeValidator = useCallback(
    (action: 'move' | 'resize', itemId: Id, time: number, edge?: 'left' | 'right'): number => {
      const task = taskById.get(String(itemId));
      if (!task || !task.is_locked || !task.deadline) return time;

      const deadlineMs = moment(task.deadline).add(1, 'day').valueOf(); // exclusive end

      if (action === 'move') {
        const newEndMs = time + (task.duration_days - 1) * 86_400_000;
        if (newEndMs >= deadlineMs) {
          // Clamp start so end lands exactly on deadline
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

  // ── BL-12: drag-to-move ───────────────────────────────────────────────────
  const handleItemMove = useCallback(
    (itemId: Id, dragTime: number) => {
      const task = taskById.get(String(itemId));
      if (!task) return;

      const newStart = moment(dragTime).format('YYYY-MM-DD');
      const newEnd   = moment(dragTime).add(task.duration_days - 1, 'days').format('YYYY-MM-DD');

      // BL-15: check dependency ordering
      for (const depId of task.dependencies) {
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
      // BL-15: soft deadline warning for unlocked tasks
      if (!task.is_locked && task.deadline && newEnd > task.deadline) {
        setWarning(`"${task.title}" will end after its deadline (${task.deadline})`);
      }

      updateTask(String(itemId), { start_date: newStart });
    },
    [taskById, dependentsOf, updateTask],
  );

  // ── BL-13: drag-to-stretch ────────────────────────────────────────────────
  const handleItemResize = useCallback(
    (itemId: Id, time: number, edge: 'left' | 'right') => {
      const task = taskById.get(String(itemId));
      if (!task) return;

      if (edge === 'right') {
        // end_time from react-calendar-timeline is exclusive (+1 day), so subtract
        const newEnd = moment(time).subtract(1, 'day').format('YYYY-MM-DD');
        const dur    = Math.max(1, moment(newEnd).diff(moment(task.start_date), 'days') + 1);
        // Effort stays fixed → daily load changes automatically via the load bar
        if (!task.is_locked && task.deadline && newEnd > task.deadline) {
          setWarning(`"${task.title}" will end after its deadline (${task.deadline})`);
        }
        updateTask(String(itemId), { duration_days: dur });
      } else {
        const newStart = moment(time).format('YYYY-MM-DD');
        const dur      = Math.max(1, moment(task.end_date).diff(moment(newStart), 'days') + 1);
        updateTask(String(itemId), { start_date: newStart, duration_days: dur });
      }
    },
    [taskById, updateTask],
  );

  // ── BL-16: click to open detail panel ────────────────────────────────────
  const handleItemClick = useCallback(
    (itemId: Id) => setSelectedTask(String(itemId)),
    [setSelectedTask],
  );

  const handleTimeChange = (
    start: number, end: number,
    updateScrollCanvas: (s: number, e: number) => void,
  ) => { updateScrollCanvas(start, end); setVisibleTime({ start, end }); };

  // ── Custom item renderer (BL-07/08/09) ───────────────────────────────────
  const itemRenderer = useCallback(
    ({ item, getItemProps }: ReactCalendarItemRendererProps<TLItem>) => {
      const task = taskById.get(String(item.id));
      if (!task) return null;

      const consumed = task.progress_pct / 100;
      const deadlineBreach = !!task.deadline && task.end_date > task.deadline;
      const { style: itemStyle, ...rest } = getItemProps({});

      return (
        <div
          {...rest}
          style={{
            ...itemStyle,
            background: BAR_COLOR[task.status] ?? '#4a9eff',
            borderRadius: 4,
            border: deadlineBreach ? '2px solid #ef4444' : '1px solid rgba(0,0,0,0.15)',
            overflow: 'hidden',
            cursor: 'pointer',
          }}
        >
          {/* BL-09: hatched fill = consumed effort */}
          {consumed > 0 && (
            <div style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              width: `${consumed * 100}%`,
              background: 'repeating-linear-gradient(45deg,rgba(0,0,0,0.18),rgba(0,0,0,0.18) 3px,transparent 3px,transparent 7px)',
              borderRight: consumed < 1 ? '1px dashed rgba(0,0,0,0.25)' : 'none',
            }} />
          )}
          {/* Label */}
          <div style={{
            position: 'relative', zIndex: 1,
            display: 'flex', alignItems: 'center',
            height: '100%', paddingLeft: 6, paddingRight: 4, gap: 4,
            fontSize: 11, color: task.status === 'completed' ? '#2d6a29' : 'white',
            whiteSpace: 'nowrap', overflow: 'hidden',
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
    [taskById, phaseRefMap],
  );

  const items: TLItem[] = allTasks.map((t) => ({
    id: t.id,
    group: t.id as Id,
    title: t.title,
    start_time: moment(t.start_date).valueOf(),
    end_time:   moment(t.end_date).add(1, 'day').valueOf(),
    canMove:    !t.is_locked,
    canResize:  (t.is_locked ? 'left' : 'both') as 'left' | 'both',
  }));

  const groups = allTasks.map((t) => ({
    id: t.id,
    title: (
      <span style={{ fontSize: 11, color: '#555' }}>
        <span style={{ color: '#999', marginRight: 4, fontFamily: 'monospace' }}>{phaseRefMap.get(t.id)}</span>
        {t.title}
      </span>
    ),
  }));

  if (allTasks.length === 0) {
    return (
      <div style={{ padding: '2rem', color: '#888', textAlign: 'center' }}>
        No tasks to display.{selectedPhaseId ? ' Click the active phase again to show all.' : ''}
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <Timeline
        groups={groups}
        items={items}
        defaultTimeStart={defaultStart}
        defaultTimeEnd={defaultEnd}
        onTimeChange={handleTimeChange}
        onItemMove={handleItemMove}
        onItemResize={handleItemResize}
        onItemClick={handleItemClick}
        itemRenderer={itemRenderer}
        moveResizeValidator={moveResizeValidator}
        sidebarWidth={SIDEBAR_WIDTH}
        lineHeight={LINE_HEIGHT}
        itemHeightRatio={ITEM_HEIGHT_RATIO}
        stackItems={false}
        canChangeGroup={false}
      >
        <TimelineHeaders>
          <SidebarHeader>
            {({ getRootProps }: { getRootProps: () => React.HTMLAttributes<HTMLDivElement> }) => (
              <div {...getRootProps()} style={{ background: '#f5f5f5', borderRight: '1px solid #ddd', fontWeight: 600, fontSize: 11, color: '#666', padding: '0 10px', display: 'flex', alignItems: 'center' }}>
                Task
              </div>
            )}
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

      {/* BL-10: dependency arrows SVG overlay */}
      {canvasWidth > 0 && arrows.length > 0 && (
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'hidden' }}>
          <defs>
            <marker id="dep-arrow" markerWidth="7" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 7 3, 0 6" fill="#f59e0b" opacity="0.9" />
            </marker>
            <clipPath id="gantt-canvas-clip">
              <rect x={SIDEBAR_WIDTH} y={HEADER_HEIGHT} width={canvasWidth} height="100%" />
            </clipPath>
          </defs>
          <g clipPath="url(#gantt-canvas-clip)">
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
              return (
                <path key={`${fromTaskId}-${toTaskId}`}
                  d={`M ${fx} ${fy} C ${fx + cp} ${fy}, ${tx - cp} ${ty}, ${tx} ${ty}`}
                  fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.85"
                  markerEnd="url(#dep-arrow)"
                />
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
