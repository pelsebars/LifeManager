import React, { useEffect, useMemo } from 'react';
import Timeline, { TimelineHeaders, SidebarHeader, DateHeader } from 'react-calendar-timeline';
import moment from 'moment';
import 'react-calendar-timeline/lib/Timeline.css';
import { usePlanningStore } from '../../store/planningStore';
import type { Task } from '../../types';

interface Props {
  projectId: string;
}

// react-calendar-timeline group and item shapes
interface TLGroup {
  id: string;
  title: React.ReactNode;
}

interface TLItem {
  id: string;
  group: string;
  title: React.ReactNode;
  start_time: number;
  end_time: number;
  canMove: boolean;
  canResize: boolean | 'both' | 'left' | 'right';
  itemProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function GanttChart({ projectId }: Props) {
  const { phases, tasks, selectedPhaseId, loadTasks, updateTask } = usePlanningStore();
  const projectPhases = phases[projectId] ?? [];

  // Load tasks for all phases of this project
  useEffect(() => {
    projectPhases.forEach((ph) => loadTasks(ph.id));
  }, [projectPhases.length, loadTasks]);

  const visiblePhases = selectedPhaseId
    ? projectPhases.filter((ph) => ph.id === selectedPhaseId)
    : projectPhases;

  const allTasks: Task[] = visiblePhases.flatMap((ph) => tasks[ph.id] ?? []);

  // Build timeline groups (one per task) and items
  const groups: TLGroup[] = allTasks.map((t) => ({
    id: t.id,
    title: <span style={{ fontSize: 12 }}>{t.title}</span>,
  }));

  const items: TLItem[] = allTasks.map((t) => {
    const consumed = t.progress_pct / 100;
    return {
      id: t.id,
      group: t.id,
      title: (
        <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', paddingLeft: 6, fontSize: 11 }}>
          {/* Hatched fill for consumed effort */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${consumed * 100}%`,
            background: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 4px, transparent 4px, transparent 8px)',
          }} />
          {t.is_locked && <span style={{ marginRight: 4 }}>🔒</span>}
          <span style={{ position: 'relative', zIndex: 1 }}>{t.title}</span>
        </div>
      ),
      start_time: moment(t.start_date).valueOf(),
      end_time: moment(t.end_date).add(1, 'day').valueOf(),
      canMove: !t.is_locked,
      canResize: t.is_locked ? 'left' : 'both',
      itemProps: {
        style: {
          background: t.status === 'completed' ? '#a8d5a2' : '#4a9eff',
          border: t.deadline && t.end_date > t.deadline ? '2px solid red' : undefined,
          borderRadius: 4,
        },
      },
    };
  });

  const defaultTimeStart = useMemo(() => moment().subtract(7, 'days'), []);
  const defaultTimeEnd = useMemo(() => moment().add(30, 'days'), []);

  const handleItemMove = async (itemId: string, dragTime: number) => {
    const task = allTasks.find((t) => t.id === itemId);
    if (!task) return;
    const newStart = moment(dragTime).format('YYYY-MM-DD');
    await updateTask(itemId, { start_date: newStart });
  };

  const handleItemResize = async (itemId: string, time: number, edge: 'left' | 'right') => {
    const task = allTasks.find((t) => t.id === itemId);
    if (!task) return;
    if (edge === 'right') {
      const newEnd = moment(time).format('YYYY-MM-DD');
      const start = moment(task.start_date);
      const end = moment(newEnd);
      const newDuration = Math.max(1, end.diff(start, 'days') + 1);
      await updateTask(itemId, { duration_days: newDuration });
    } else {
      const newStart = moment(time).format('YYYY-MM-DD');
      await updateTask(itemId, { start_date: newStart });
    }
  };

  if (groups.length === 0) {
    return <div style={{ padding: '1rem', color: '#888' }}>No tasks to display. Select a phase or add tasks.</div>;
  }

  return (
    <Timeline
      groups={groups}
      items={items}
      defaultTimeStart={defaultTimeStart}
      defaultTimeEnd={defaultTimeEnd}
      onItemMove={handleItemMove}
      onItemResize={handleItemResize}
      lineHeight={40}
      itemHeightRatio={0.75}
      stackItems={false}
    >
      <TimelineHeaders>
        <SidebarHeader>
          {({ getRootProps }: { getRootProps: () => React.HTMLAttributes<HTMLDivElement> }) => <div {...getRootProps()} style={{ background: '#f0f0f0', fontWeight: 600, fontSize: 12, padding: '0 8px', display: 'flex', alignItems: 'center' }}>Task</div>}
        </SidebarHeader>
        <DateHeader unit="month" />
        <DateHeader unit="day" labelFormat="D" />
      </TimelineHeaders>
    </Timeline>
  );
}
