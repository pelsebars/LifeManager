/**
 * GanttChart — Layer 2 of the Planning View.
 *
 * Built on react-calendar-timeline.
 * Adds on top:
 *   BL-07  Phase reference labels (e.g. "1A", "1B") on each task bar
 *   BL-08  Lock icon on bars that have is_locked=true
 *   BL-09  Hatched progress fill (consumed effort) + solid remaining fill
 *   BL-10  SVG dependency arrows overlaid on the canvas
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

// ── Timeline geometry constants (must match props passed to <Timeline>) ──────
const SIDEBAR_WIDTH = 180;
const LINE_HEIGHT = 44;
const ITEM_HEIGHT_RATIO = 0.72;
// Two DateHeader rows × ~30px each
const HEADER_HEIGHT = 60;

interface Props {
  projectId: string;
}

interface Arrow {
  fromTaskId: string;
  toTaskId: string;
}

// Map 0-based index within phase to a letter suffix: 0→A, 1→B, …
function indexToLetter(i: number): string {
  return String.fromCharCode(65 + i);
}

// Build a label like "2C" from phase order and task index within phase
function buildPhaseRef(phaseOrder: number, taskIndex: number): string {
  return `${phaseOrder}${indexToLetter(taskIndex)}`;
}

function timeToPixel(
  time: number,
  visibleStart: number,
  visibleEnd: number,
  canvasWidth: number,
): number {
  if (visibleEnd === visibleStart) return 0;
  return ((time - visibleStart) / (visibleEnd - visibleStart)) * canvasWidth;
}

function rowCentreY(groupIndex: number): number {
  return HEADER_HEIGHT + groupIndex * LINE_HEIGHT + LINE_HEIGHT / 2;
}

// Status colours for task bars
const BAR_COLOR: Record<string, string> = {
  completed:   '#a8d5a2',
  in_progress: '#4a9eff',
  deferred:    '#bbb',
  not_started: '#4a9eff',
};

export function GanttChart({ projectId }: Props) {
  const { phases, tasks, selectedPhaseId, updateTask } = usePlanningStore();

  const projectPhases = (phases[projectId] ?? [])
    .slice()
    .sort((a: Phase, b: Phase) => a.order - b.order);

  const visiblePhases = selectedPhaseId
    ? projectPhases.filter((ph: Phase) => ph.id === selectedPhaseId)
    : projectPhases;

  // All tasks in display order, grouped by phase
  const allTasks: Task[] = visiblePhases.flatMap((ph: Phase) =>
    (tasks[ph.id] ?? []).slice().sort(
      (a: Task, b: Task) => a.start_date.localeCompare(b.start_date),
    ),
  );

  // Build lookup maps
  const taskById = new Map(allTasks.map((t) => [t.id, t]));
  const groupIndexById = new Map(allTasks.map((t, i) => [t.id, i]));

  // Phase reference map: task id → "2C" label
  const phaseRefMap = new Map<string, string>();
  visiblePhases.forEach((ph: Phase) => {
    const phaseTasks = (tasks[ph.id] ?? []).slice().sort(
      (a: Task, b: Task) => a.start_date.localeCompare(b.start_date),
    );
    phaseTasks.forEach((t: Task, idx: number) => {
      phaseRefMap.set(t.id, buildPhaseRef(ph.order, idx));
    });
  });

  // Dependency arrows: only between tasks currently visible
  const arrows: Arrow[] = [];
  for (const task of allTasks) {
    for (const depId of task.dependencies) {
      if (groupIndexById.has(depId) && groupIndexById.has(task.id)) {
        arrows.push({ fromTaskId: depId, toTaskId: task.id });
      }
    }
  }

  // Visible time window — updated on pan/zoom
  const defaultStart = moment().subtract(10, 'days');
  const defaultEnd = moment().add(35, 'days');
  const [visibleTime, setVisibleTime] = useState({
    start: defaultStart.valueOf(),
    end: defaultEnd.valueOf(),
  });

  // Container ref for measuring canvas width
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(containerRef.current);
    setContainerWidth(containerRef.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  const canvasWidth = containerWidth - SIDEBAR_WIDTH;

  // react-calendar-timeline groups & items
  const groups = allTasks.map((t) => ({
    id: t.id,
    title: (
      <span style={{ fontSize: 11, color: '#555' }}>
        <span style={{ color: '#999', marginRight: 4, fontFamily: 'monospace' }}>
          {phaseRefMap.get(t.id)}
        </span>
        {t.title}
      </span>
    ),
  }));

  const itemRenderer = useCallback(
    ({ item, getItemProps }: ReactCalendarItemRendererProps<(typeof items)[number]>) => {
      const task = taskById.get(item.id as string);
      if (!task) return null;

      const consumed = task.progress_pct / 100;
      const isDeadlineBreached =
        !!task.deadline && task.end_date > task.deadline;

      const { style: itemStyle, ...restItemProps } = getItemProps({});

      return (
        <div
          {...restItemProps}
          style={{
            ...itemStyle,
            background: BAR_COLOR[task.status] ?? '#4a9eff',
            borderRadius: 4,
            border: isDeadlineBreached ? '2px solid #ef4444' : '1px solid rgba(0,0,0,0.15)',
            overflow: 'hidden',
            cursor: 'pointer',
          }}
        >
          {/* BL-09: hatched fill showing consumed effort */}
          {consumed > 0 && (
            <div
              style={{
                position: 'absolute', top: 0, left: 0, bottom: 0,
                width: `${consumed * 100}%`,
                background:
                  'repeating-linear-gradient(45deg, rgba(0,0,0,0.18), rgba(0,0,0,0.18) 3px, transparent 3px, transparent 7px)',
                borderRight: consumed < 1 ? '1px dashed rgba(0,0,0,0.25)' : 'none',
              }}
            />
          )}

          {/* Label row */}
          <div style={{
            position: 'relative', zIndex: 1,
            display: 'flex', alignItems: 'center',
            height: '100%', paddingLeft: 6, paddingRight: 4, gap: 4,
            fontSize: 11, color: task.status === 'completed' ? '#2d6a29' : 'white',
            whiteSpace: 'nowrap', overflow: 'hidden',
          }}>
            {/* BL-08: lock icon */}
            {task.is_locked && (
              <span style={{ fontSize: 10, opacity: 0.9 }}>🔒</span>
            )}
            <span style={{ opacity: 0.7, fontFamily: 'monospace', fontSize: 10 }}>
              {phaseRefMap.get(task.id)}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {task.title}
            </span>
            {task.progress_pct > 0 && task.status !== 'completed' && (
              <span style={{ marginLeft: 'auto', opacity: 0.8, fontSize: 10 }}>
                {task.progress_pct}%
              </span>
            )}
          </div>
        </div>
      );
    },
    [taskById, phaseRefMap],
  );

  const items = allTasks.map((t) => ({
    id: t.id,
    group: t.id as Id,
    title: t.title,
    start_time: moment(t.start_date).valueOf(),
    end_time: moment(t.end_date).add(1, 'day').valueOf(),
    canMove: !t.is_locked,
    canResize: (t.is_locked ? 'left' : 'both') as 'left' | 'both',
  }));

  const handleItemMove = async (itemId: Id, dragTime: number) => {
    const newStart = moment(dragTime).format('YYYY-MM-DD');
    await updateTask(String(itemId), { start_date: newStart });
  };

  const handleItemResize = async (itemId: Id, time: number, edge: 'left' | 'right') => {
    const task = taskById.get(String(itemId));
    if (!task) return;
    if (edge === 'right') {
      const newEnd = moment(time).subtract(1, 'day').format('YYYY-MM-DD');
      const dur = Math.max(1, moment(newEnd).diff(moment(task.start_date), 'days') + 1);
      await updateTask(String(itemId), { duration_days: dur });
    } else {
      const newStart = moment(time).format('YYYY-MM-DD');
      await updateTask(String(itemId), { start_date: newStart });
    }
  };

  const handleTimeChange = (
    start: number,
    end: number,
    updateScrollCanvas: (s: number, e: number) => void,
  ) => {
    updateScrollCanvas(start, end);
    setVisibleTime({ start, end });
  };

  if (allTasks.length === 0) {
    return (
      <div style={{ padding: '2rem', color: '#888', textAlign: 'center' }}>
        No tasks to display.{selectedPhaseId ? ' Click a phase in the ribbon to filter, or click again to show all.' : ''}
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
        itemRenderer={itemRenderer}
        sidebarWidth={SIDEBAR_WIDTH}
        lineHeight={LINE_HEIGHT}
        itemHeightRatio={ITEM_HEIGHT_RATIO}
        stackItems={false}
        canChangeGroup={false}
      >
        <TimelineHeaders>
          <SidebarHeader>
            {({ getRootProps }: { getRootProps: () => React.HTMLAttributes<HTMLDivElement> }) => (
              <div
                {...getRootProps()}
                style={{
                  background: '#f5f5f5', borderRight: '1px solid #ddd',
                  fontWeight: 600, fontSize: 11, color: '#666',
                  padding: '0 10px', display: 'flex', alignItems: 'center',
                }}
              >
                Task
              </div>
            )}
          </SidebarHeader>
          <DateHeader unit="month" />
          <DateHeader unit="day" labelFormat="D" />
        </TimelineHeaders>
      </Timeline>

      {/* BL-10: Dependency arrows SVG overlay */}
      {canvasWidth > 0 && arrows.length > 0 && (
        <svg
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none', overflow: 'hidden',
          }}
        >
          <defs>
            <marker
              id="dep-arrow"
              markerWidth="7" markerHeight="6"
              refX="7" refY="3"
              orient="auto"
            >
              <polygon points="0 0, 7 3, 0 6" fill="#f59e0b" opacity="0.9" />
            </marker>
            {/* Clip to canvas area only — don't draw over the sidebar */}
            <clipPath id="gantt-canvas-clip">
              <rect
                x={SIDEBAR_WIDTH}
                y={HEADER_HEIGHT}
                width={canvasWidth}
                height="100%"
              />
            </clipPath>
          </defs>

          <g clipPath="url(#gantt-canvas-clip)">
            {arrows.map(({ fromTaskId, toTaskId }) => {
              const fromTask = taskById.get(fromTaskId);
              const toTask = taskById.get(toTaskId);
              if (!fromTask || !toTask) return null;

              const fromGroupIdx = groupIndexById.get(fromTaskId) ?? 0;
              const toGroupIdx = groupIndexById.get(toTaskId) ?? 0;

              // Arrow starts at the right edge of the prerequisite task bar
              const fromX = SIDEBAR_WIDTH + timeToPixel(
                moment(fromTask.end_date).add(1, 'day').valueOf(),
                visibleTime.start, visibleTime.end, canvasWidth,
              );
              const fromY = rowCentreY(fromGroupIdx);

              // Arrow ends at the left edge of the dependent task bar
              const toX = SIDEBAR_WIDTH + timeToPixel(
                moment(toTask.start_date).valueOf(),
                visibleTime.start, visibleTime.end, canvasWidth,
              );
              const toY = rowCentreY(toGroupIdx);

              // Skip arrows where both endpoints are off-screen
              if (
                (fromX < SIDEBAR_WIDTH && toX < SIDEBAR_WIDTH) ||
                (fromX > SIDEBAR_WIDTH + canvasWidth && toX > SIDEBAR_WIDTH + canvasWidth)
              ) return null;

              // Cubic bezier: control points curve horizontally
              const dx = Math.abs(toX - fromX);
              const cpOffset = Math.max(dx * 0.4, 20);
              const path = `M ${fromX} ${fromY} C ${fromX + cpOffset} ${fromY}, ${toX - cpOffset} ${toY}, ${toX} ${toY}`;

              return (
                <path
                  key={`${fromTaskId}-${toTaskId}`}
                  d={path}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeOpacity="0.85"
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
