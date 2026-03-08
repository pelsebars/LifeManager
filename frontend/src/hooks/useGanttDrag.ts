/**
 * useGanttDrag
 *
 * Drag interactions for the Gantt are handled by react-calendar-timeline's
 * built-in onItemMove / onItemResize callbacks.
 *
 * This hook encapsulates the constraint logic that runs BEFORE a move/resize
 * is committed — e.g. warning when a locked task would exceed its deadline.
 */

import { useCallback } from 'react';
import type { Task } from '../types';

interface DragConstraintResult {
  allowed: boolean;
  warning?: string;
}

export function useGanttDrag() {
  /**
   * Check whether moving a task to newStartDate is allowed.
   * Returns { allowed, warning }.
   */
  const checkMove = useCallback((task: Task, newStartDate: string): DragConstraintResult => {
    const newEnd = addDays(newStartDate, task.duration_days - 1);
    if (task.is_locked && task.deadline && newEnd > task.deadline) {
      return {
        allowed: false,
        warning: `This task is locked. Moving it would push the end date (${newEnd}) past the deadline (${task.deadline}).`,
      };
    }
    if (!task.is_locked && task.deadline && newEnd > task.deadline) {
      return {
        allowed: true,
        warning: `End date (${newEnd}) will exceed deadline (${task.deadline}).`,
      };
    }
    return { allowed: true };
  }, []);

  /**
   * Check whether resizing the right edge to newEndDate is allowed.
   */
  const checkResizeRight = useCallback((task: Task, newEndDate: string): DragConstraintResult => {
    if (task.is_locked && task.deadline && newEndDate > task.deadline) {
      return {
        allowed: false,
        warning: `Locked task cannot extend past deadline (${task.deadline}).`,
      };
    }
    return { allowed: true };
  }, []);

  return { checkMove, checkResizeRight };
}

function addDays(date: string, n: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
