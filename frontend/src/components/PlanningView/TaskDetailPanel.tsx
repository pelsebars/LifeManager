/**
 * TaskDetailPanel — BL-16
 *
 * Slide-in panel that opens when a task bar is clicked.
 * Allows editing: title, effort, duration_days, deadline, progress_pct, status, is_locked.
 */

import { useState, useEffect } from 'react';
import type { Task } from '../../types';

const STATUS_OPTIONS: Task['status'][] = [
  'not_started', 'in_progress', 'completed', 'deferred',
];

const STATUS_LABEL: Record<Task['status'], string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed:   'Completed',
  deferred:    'Deferred',
};

interface Props {
  task: Task;
  phaseRef: string;
  onSave: (id: string, patch: Partial<Task>) => void;
  onClose: () => void;
}

export function TaskDetailPanel({ task, phaseRef, onSave, onClose }: Props) {
  // Local form state — reset when the task changes
  const [title, setTitle]           = useState(task.title);
  const [effort, setEffort]         = useState(String(task.effort));
  const [duration, setDuration]     = useState(String(task.duration_days));
  const [deadline, setDeadline]     = useState(task.deadline ?? '');
  const [progress, setProgress]     = useState(task.progress_pct);
  const [status, setStatus]         = useState<Task['status']>(task.status);
  const [isLocked, setIsLocked]     = useState(task.is_locked);
  const [dirty, setDirty]           = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setEffort(String(task.effort));
    setDuration(String(task.duration_days));
    setDeadline(task.deadline ?? '');
    setProgress(task.progress_pct);
    setStatus(task.status);
    setIsLocked(task.is_locked);
    setDirty(false);
  }, [task.id]);

  const mark = () => setDirty(true);

  const handleSave = () => {
    const effortVal   = Math.max(0.25, parseFloat(effort) || task.effort);
    const durationVal = Math.max(1,    parseInt(duration, 10) || task.duration_days);
    onSave(task.id, {
      title:        title.trim() || task.title,
      effort:       effortVal,
      duration_days: durationVal,
      deadline:     deadline || null,
      progress_pct: progress,
      status,
      is_locked:    isLocked,
    });
    setDirty(false);
  };

  // Computed daily load for this task
  const effortVal   = Math.max(0.25, parseFloat(effort) || task.effort);
  const durationVal = Math.max(1,    parseInt(duration, 10) || task.duration_days);
  const dailyLoad   = (effortVal / durationVal).toFixed(2);

  const remainingEffort = (effortVal * (1 - progress / 100)).toFixed(1);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.15)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
        width: 320, background: 'white',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid #e8e8e8',
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#fafafa',
        }}>
          <span style={{
            fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
            background: '#e8f4ff', color: '#1d6fa4',
            padding: '2px 6px', borderRadius: 4,
          }}>
            {phaseRef}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#222', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888', lineHeight: 1, padding: 2 }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Dates row (read-only) */}
        <div style={{ padding: '8px 16px', background: '#f5f9ff', borderBottom: '1px solid #e8e8e8', fontSize: 11, color: '#666' }}>
          <span>{task.start_date}</span>
          <span style={{ margin: '0 6px', color: '#bbb' }}>→</span>
          <span>{task.end_date}</span>
          {task.deadline && (
            <span style={{ marginLeft: 10, color: task.end_date > task.deadline ? '#ef4444' : '#888' }}>
              {task.is_locked ? '🔒' : '⏰'} deadline {task.deadline}
            </span>
          )}
        </div>

        {/* Form body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Title */}
          <label style={labelStyle}>
            Title
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); mark(); }}
              style={inputStyle}
            />
          </label>

          {/* Status */}
          <label style={labelStyle}>
            Status
            <select value={status} onChange={(e) => { setStatus(e.target.value as Task['status']); mark(); }} style={inputStyle}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </label>

          {/* Progress */}
          <label style={labelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Progress</span>
              <span style={{ fontWeight: 600, color: '#333' }}>{progress}%</span>
            </div>
            <input
              type="range" min={0} max={100} step={5}
              value={progress}
              onChange={(e) => { setProgress(Number(e.target.value)); mark(); }}
              style={{ width: '100%', accentColor: '#4a9eff' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa', marginTop: 2 }}>
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </label>

          <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0', margin: 0 }} />

          {/* Effort + Duration side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={labelStyle}>
              Effort (hrs)
              <input
                type="number" min={0.25} step={0.25}
                value={effort}
                onChange={(e) => { setEffort(e.target.value); mark(); }}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Duration (days)
              <input
                type="number" min={1} step={1}
                value={duration}
                onChange={(e) => { setDuration(e.target.value); mark(); }}
                style={inputStyle}
              />
            </label>
          </div>

          {/* Computed load hint */}
          <div style={{ fontSize: 11, color: '#888', background: '#f8f8f8', borderRadius: 4, padding: '6px 10px' }}>
            <strong>{dailyLoad} hrs/day</strong> planned load
            {' · '}
            <strong>{remainingEffort} hrs</strong> remaining
          </div>

          {/* Deadline */}
          <label style={labelStyle}>
            Deadline
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="date"
                value={deadline}
                onChange={(e) => { setDeadline(e.target.value); mark(); }}
                style={{ ...inputStyle, flex: 1 }}
              />
              {deadline && (
                <button
                  onClick={() => { setDeadline(''); mark(); }}
                  style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid #ddd', background: 'white', cursor: 'pointer', color: '#888' }}
                >
                  Clear
                </button>
              )}
            </div>
          </label>

          {/* Lock toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#444' }}>
            <input
              type="checkbox"
              checked={isLocked}
              onChange={(e) => { setIsLocked(e.target.checked); mark(); }}
              style={{ width: 15, height: 15, accentColor: '#4a9eff' }}
            />
            <span>🔒 Hard deadline (task cannot move past deadline)</span>
          </label>

          {/* Dependencies (read-only for now) */}
          {task.dependencies.length > 0 && (
            <div style={{ fontSize: 11, color: '#888' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Depends on</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {task.dependencies.map((depId) => (
                  <span key={depId} style={{ background: '#f0f0f0', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace' }}>
                    {depId}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid #e8e8e8',
          display: 'flex', gap: 8, background: '#fafafa',
        }}>
          <button
            onClick={handleSave}
            disabled={!dirty}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 6,
              border: 'none', background: dirty ? '#4a9eff' : '#d0e8ff',
              color: dirty ? 'white' : '#8ab8e0',
              fontWeight: 600, fontSize: 13,
              cursor: dirty ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >
            Save
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 6,
              border: '1px solid #ddd', background: 'white',
              color: '#555', fontSize: 13, cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 5,
  fontSize: 12, fontWeight: 600, color: '#555',
};

const inputStyle: React.CSSProperties = {
  padding: '6px 8px', borderRadius: 5,
  border: '1px solid #ddd', fontSize: 13, color: '#222',
  outline: 'none', width: '100%', boxSizing: 'border-box',
};
