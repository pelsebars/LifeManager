/**
 * LoadBar — Layer 3 of the Planning View.
 *
 * BL-11: Colour-coded capacity bar beneath the Gantt on the same date axis.
 *   Green  = load ≤ 80% of available free hours
 *   Yellow = load between 80–100%
 *   Red    = overloaded
 *
 * BL-28: Uses user-defined day profiles for capacity.
 *
 * The bar is aligned with the Gantt timeline — it shares the same sidebar
 * offset on the left, and day segments are positioned proportionally to
 * visibleTimeStart/End so scrolling or zooming the Gantt keeps them in sync.
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import moment from 'moment';
import { usePlanningStore } from '../../store/planningStore';
import { useRoutineStore } from '../../store/routineStore';
import { SIDEBAR_WIDTH } from './GanttChart';
import type { Task, Routine, DayProfile, LoadEntry } from '../../types';

interface Props {
  visibleTimeStart: number;
  visibleTimeEnd: number;
  ganttCanvasWidth?: number; // exact canvas width from the Gantt — use this for pixel-perfect alignment
}

const STATUS_COLOR: Record<LoadEntry['status'], string> = {
  green:  '#4caf50',
  yellow: '#ff9800',
  red:    '#ef4444',
};

function getDayType(dateStr: string): 'workday' | 'weekend' {
  const dow = new Date(dateStr + 'T12:00:00').getDay(); // midday avoids DST edge cases
  return dow === 0 || dow === 6 ? 'weekend' : 'workday';
}

type Band = 'work' | 'personal';

/** Count working days (Mon–Fri) between two YYYY-MM-DD dates (inclusive). */
function countWeekdays(start: string, end: string): number {
  let count = 0;
  const cur = moment(start);
  const last = moment(end);
  while (cur.isSameOrBefore(last, 'day')) {
    const dow = cur.day();
    if (dow !== 0 && dow !== 6) count++;
    cur.add(1, 'day');
  }
  return count;
}

function computeLoad(tasks: Task[], days: string[], profiles: DayProfile[], band: Band, routines: Routine[]): LoadEntry[] {
  const profileMap: Record<string, number> = {};
  for (const p of profiles) {
    // work band → work_hours capacity; personal band → free_hours capacity
    // NUMERIC columns come back as strings from node-postgres — coerce to Number
    profileMap[p.day_type] = band === 'work' ? Number(p.work_hours ?? 8) : Number(p.free_hours ?? 3);
  }

  const bandTasks = tasks.filter((t) => (t.category ?? 'personal') === band);
  // Routine occurrences contribute to the same capacity pool as their category
  const bandRoutines = routines.filter((r) => r.category === band);

  return days.map((date) => {
    const dayType   = getDayType(date);
    const isWeekend = dayType === 'weekend';

    // Work band has zero capacity on weekends
    const available = (band === 'work' && isWeekend)
      ? 0
      : (profileMap[dayType] ?? (band === 'work' ? 8 : 3));

    // Work tasks skip weekends: effort is spread over weekdays only.
    const planned = (band === 'work' && isWeekend) ? 0 : bandTasks
      .filter((t) => t.status !== 'completed' && t.status !== 'deferred')
      .filter((t) => date >= t.start_date.slice(0, 10) && date <= t.end_date.slice(0, 10))
      .reduce((sum, t) => {
        const remaining = Number(t.effort) * (1 - t.progress_pct / 100);
        if (band === 'work') {
          const wd = countWeekdays(t.start_date.slice(0, 10), t.end_date.slice(0, 10));
          return sum + (wd > 0 ? remaining / wd : 0);
        }
        return sum + remaining / t.duration_days;
      }, 0);

    // Add routine effort for any occurrence on this date
    // NOTE: effort_hours is a NUMERIC column — node-postgres returns it as a string,
    // so we coerce to Number to avoid "0 + '1.5'" = "01.5" string concatenation.
    const routinePlanned = bandRoutines.reduce((sum, r) => {
      return r.occurrences.includes(date) ? sum + Number(r.effort_hours) : sum;
    }, 0);

    const ratio  = available > 0 ? (planned + routinePlanned) / available : ((planned + routinePlanned) > 0 ? Infinity : 0);
    const status: LoadEntry['status'] =
      ratio <= 0.8 ? 'green' : ratio <= 1.0 ? 'yellow' : 'red';

    return { date, planned_hours: planned + routinePlanned, available_hours: available, status };
  });
}

export function LoadBar({ visibleTimeStart, visibleTimeEnd, ganttCanvasWidth }: Props) {
  const { phases, tasks, dayProfiles } = usePlanningStore();
  const { routines } = useRoutineStore();
  // Load bar shows combined load across ALL projects — that's the point of it.
  // The selected project (projectId) only drives the Gantt above; capacity is global.
  const allTasks: Task[] = Object.values(phases).flat().flatMap((ph) => tasks[ph.id] ?? []);

  // Measure our own container width so we can match the Gantt's pixel scale
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((e) => setContainerWidth(e[0].contentRect.width));
    ro.observe(containerRef.current);
    setContainerWidth(containerRef.current.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Use the Gantt's exact canvas width when available (avoids scrollbar-width drift).
  // Fall back to measuring our own container on first render before the Gantt has scrolled.
  const canvasWidth = (ganttCanvasWidth != null && ganttCanvasWidth > 0)
    ? ganttCanvasWidth
    : Math.max(0, containerWidth - SIDEBAR_WIDTH - 1);

  // Build a day array covering the entire visible window
  const days = useMemo(() => {
    const result: string[] = [];
    const cur = moment(visibleTimeStart).startOf('day');
    const end = moment(visibleTimeEnd).startOf('day');
    while (cur.isSameOrBefore(end)) {
      result.push(cur.format('YYYY-MM-DD'));
      cur.add(1, 'day');
    }
    return result;
  }, [visibleTimeStart, visibleTimeEnd]);

  const workEntries = useMemo(
    () => computeLoad(allTasks, days, dayProfiles, 'work', routines),
    [allTasks, days, dayProfiles, routines],
  );
  const personalEntries = useMemo(
    () => computeLoad(allTasks, days, dayProfiles, 'personal', routines),
    [allTasks, days, dayProfiles, routines],
  );

  // Convert a moment timestamp → canvas pixel (relative to canvas left edge)
  const msPerPx = canvasWidth > 0 ? (visibleTimeEnd - visibleTimeStart) / canvasWidth : 1;
  function toX(ms: number) { return (ms - visibleTimeStart) / msPerPx; }

  function renderBand(entries: LoadEntry[]) {
    if (!canvasWidth) return null;
    return entries.map((entry) => {
      const dayStart = moment(entry.date).valueOf();
      const left  = toX(dayStart);
      const width = toX(moment(entry.date).add(1, 'day').valueOf()) - left;
      return (
        <div
          key={entry.date}
          title={`${entry.date}  ${entry.planned_hours.toFixed(1)}h / ${entry.available_hours}h`}
          style={{
            position: 'absolute', top: 0, bottom: 0, left, width,
            background: STATUS_COLOR[entry.status],
            opacity: entry.planned_hours < 0.05 ? 0.12 : 0.8,
          }}
        />
      );
    });
  }

  const workOverload    = workEntries.filter((e) => e.status === 'red').length;
  const personalOverload = personalEntries.filter((e) => e.status === 'red').length;

  const BAND_HEIGHT = 14;
  const LABEL_STYLE: React.CSSProperties = {
    width: SIDEBAR_WIDTH + 1,
    boxSizing: 'border-box',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 8,
    background: '#f5f5f5',
    borderRight: '1px solid #ddd',
    borderLeft: '1px solid #e0e0e0',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: '#999',
  };
  const CANVAS_STYLE: React.CSSProperties = {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRight: '1px solid #e0e0e0',
  };

  return (
    <div ref={containerRef} style={{ userSelect: 'none' }}>

      {/* Two-band bar */}
      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #e0e0e0', borderRadius: 6, overflow: 'hidden' }}>

        {/* Work band */}
        <div style={{ display: 'flex', height: BAND_HEIGHT, borderBottom: '1px solid #e8e8e8' }}>
          <div style={{ ...LABEL_STYLE, color: workOverload > 0 ? '#ef4444' : '#999' }}>
            💼 WORK
          </div>
          <div style={CANVAS_STYLE}>{renderBand(workEntries)}</div>
        </div>

        {/* Personal band */}
        <div style={{ display: 'flex', height: BAND_HEIGHT }}>
          <div style={{ ...LABEL_STYLE, color: personalOverload > 0 ? '#ef4444' : '#999' }}>
            🌿 LIFE
          </div>
          <div style={CANVAS_STYLE}>{renderBand(personalEntries)}</div>
        </div>

      </div>

      {/* Legend + alerts */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingLeft: SIDEBAR_WIDTH + 4 }}>
        <div style={{ display: 'flex', gap: '1rem', fontSize: 11, color: '#777' }}>
          <span><span style={{ color: STATUS_COLOR.green }}>■</span> Under</span>
          <span><span style={{ color: STATUS_COLOR.yellow }}>■</span> Tight</span>
          <span><span style={{ color: STATUS_COLOR.red }}>■</span> Over</span>
        </div>
        <div style={{ fontSize: 11, color: '#888', display: 'flex', gap: 10 }}>
          {workOverload > 0 && <span style={{ color: '#ef4444' }}>⚠ {workOverload} work day{workOverload > 1 ? 's' : ''} overloaded</span>}
          {personalOverload > 0 && <span style={{ color: '#ef4444' }}>⚠ {personalOverload} life day{personalOverload > 1 ? 's' : ''} overloaded</span>}
        </div>
      </div>

    </div>
  );
}
