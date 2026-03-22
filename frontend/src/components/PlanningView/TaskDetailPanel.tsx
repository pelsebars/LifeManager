/**
 * TaskDetailPanel — BL-16
 *
 * Slide-in panel that opens when a task bar is clicked.
 * Allows editing: title, effort, duration_days, deadline, progress_pct, status, is_locked.
 * Create mode also supports selecting dependencies from all tasks across all projects.
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Task, Phase, TaskCategory } from '../../types';

const STATUS_OPTIONS: Task['status'][] = [
  'not_started', 'in_progress', 'completed', 'deferred',
];

const STATUS_LABEL: Record<Task['status'], string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed:   'Completed',
  deferred:    'Deferred',
};

export type TaskOption = { id: string; label: string };
export type TaskOptionGroup = { groupLabel: string; options: TaskOption[] };

export type NewTaskData = {
  phase_id: string;
  title: string;
  category: TaskCategory;
  effort: number;
  duration_days: number;
  start_date: string;
  deadline: string | null;
  is_locked: boolean;
  dependencies: string[];
};

interface EditProps {
  mode?: 'edit';
  task: Task;
  phaseRef: string;
  phases?: never;
  taskOptionGroups?: TaskOptionGroup[];
  onSave: (id: string, patch: Partial<Task>) => void;
  onCreate?: never;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

interface CreateProps {
  mode: 'create';
  task?: never;
  phaseRef?: never;
  phases: Phase[];
  taskOptionGroups: TaskOptionGroup[];
  onSave?: never;
  onCreate: (data: NewTaskData) => void;
  onClose: () => void;
  /** Pre-fill fields when activating a backlog item (BL-46) */
  prefill?: { title?: string; category?: TaskCategory; effort?: number };
}

type Props = EditProps | CreateProps;

const today = new Date().toISOString().slice(0, 10);

export function TaskDetailPanel(props: Props) {
  const isCreate = props.mode === 'create';

  // Form state
  const prefill = isCreate ? (props as CreateProps).prefill : undefined;
  const [title, setTitle]         = useState(isCreate ? (prefill?.title ?? '') : props.task.title);
  const [phaseId, setPhaseId]     = useState(isCreate ? (props.phases[props.phases.length - 1]?.id ?? '') : '');
  const [startDate, setStartDate] = useState(isCreate ? today : '');
  const [effort, setEffort]       = useState(isCreate ? String(prefill?.effort ?? 1) : String(props.task.effort));
  const [duration, setDuration]   = useState(isCreate ? '1' : String(props.task.duration_days));
  const [deadline, setDeadline]   = useState(isCreate ? '' : (props.task.deadline ?? ''));
  const [progress, setProgress]   = useState(isCreate ? 0 : props.task.progress_pct);
  const [status, setStatus]       = useState<Task['status']>(isCreate ? 'not_started' : props.task.status);
  const [isLocked, setIsLocked]   = useState(isCreate ? false : props.task.is_locked);
  const [category, setCategory]   = useState<TaskCategory>(isCreate ? (prefill?.category ?? 'personal') : (props.task.category ?? 'personal'));

  // Dependency state — initialise from task in edit mode
  const [deps, setDeps]           = useState<string[]>(isCreate ? [] : props.task.dependencies ?? []);
  const [depSelect, setDepSelect] = useState('');

  useEffect(() => {
    if (isCreate) return;
    const t = props.task;
    setTitle(t.title);
    setEffort(String(t.effort));
    setDuration(String(t.duration_days));
    setDeadline(t.deadline ?? '');
    setProgress(t.progress_pct);
    setStatus(t.status);
    setIsLocked(t.is_locked);
    setCategory(t.category ?? 'personal');
    setDeps(t.dependencies ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreate ? null : props.task?.id]);

  const effortVal   = Math.max(0.25, parseFloat(effort) || 1);
  const durationVal = Math.max(1, parseInt(duration, 10) || 1);
  const dailyLoad   = (effortVal / durationVal).toFixed(2);

  // All available task options flattened (for label lookup)
  const allOptions: TaskOption[] = (props.taskOptionGroups ?? []).flatMap((g) => g.options);

  const addDep = () => {
    if (!depSelect || deps.includes(depSelect)) return;
    setDeps([...deps, depSelect]);
    setDepSelect('');
  };

  const removeDep = (id: string) => {
    setDeps(deps.filter((d) => d !== id));
  };

  const handleSave = () => {
    if (isCreate) {
      if (!title.trim()) return;
      props.onCreate({
        phase_id:      phaseId,
        title:         title.trim(),
        category,
        effort:        effortVal,
        duration_days: durationVal,
        start_date:    startDate || today,
        deadline:      deadline || null,
        is_locked:     isLocked,
        dependencies:  deps,
      });
    } else {
      props.onSave(props.task.id, {
        title:         title.trim() || props.task.title,
        category,
        effort:        effortVal,
        duration_days: durationVal,
        deadline:      deadline || null,
        progress_pct:  progress,
        status,
        is_locked:     isLocked,
        dependencies:  deps,
      });
    }
  };

  const canSave = title.trim().length > 0 && (!isCreate || props.phases.length > 0);

  return createPortal(
    <>
      {/* Backdrop */}
      <div onClick={props.onClose} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.15)' }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1000,
        width: 340, background: 'white',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid #e8e8e8',
          display: 'flex', alignItems: 'center', gap: 8,
          background: isCreate ? '#f0fdf4' : '#fafafa',
        }}>
          <span style={{
            fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
            background: isCreate ? '#dcfce7' : '#e8f4ff',
            color: isCreate ? '#166534' : '#1d6fa4',
            padding: '2px 6px', borderRadius: 4,
          }}>
            {isCreate ? 'NEW' : props.phaseRef}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#222', flex: 1 }}>
            {isCreate ? 'Add task' : props.task.title}
          </span>
          <button onClick={props.onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888', lineHeight: 1, padding: 2 }}>×</button>
        </div>

        {/* Dates row — read-only in edit mode */}
        {!isCreate && (
          <div style={{ padding: '8px 16px', background: '#f5f9ff', borderBottom: '1px solid #e8e8e8', fontSize: 11, color: '#666' }}>
            <span>{props.task.start_date}</span>
            <span style={{ margin: '0 6px', color: '#bbb' }}>→</span>
            <span>{props.task.end_date}</span>
            {props.task.deadline && (
              <span style={{ marginLeft: 10, color: props.task.end_date > props.task.deadline ? '#ef4444' : '#888' }}>
                {props.task.is_locked ? '🔒' : '⏰'} deadline {props.task.deadline}
              </span>
            )}
          </div>
        )}

        {/* Form body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Phase selector — create mode only */}
          {isCreate && (
            props.phases.length === 0 ? (
              <div style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', borderRadius: 5, padding: '8px 10px', border: '1px solid #f59e0b' }}>
                No phases yet. Use <strong>+ → Add Phase</strong> to create one first.
              </div>
            ) : (
              <label style={labelStyle}>
                Phase
                <select value={phaseId} onChange={(e) => setPhaseId(e.target.value)} style={inputStyle}>
                  {props.phases.map((ph) => (
                    <option key={ph.id} value={ph.id}>{ph.order}. {ph.title}</option>
                  ))}
                </select>
              </label>
            )
          )}

          {/* Title */}
          <label style={labelStyle}>
            Title
            <input
              autoFocus={isCreate}
              value={title}
              onChange={(e) => { setTitle(e.target.value); }}
              placeholder={isCreate ? 'Task title…' : undefined}
              style={inputStyle}
            />
          </label>

          {/* Category toggle */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</div>
            <div style={{ display: 'flex', borderRadius: 6, border: '1px solid #e0e0e0', overflow: 'hidden' }}>
              {(['work', 'personal'] as TaskCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    background: category === cat ? (cat === 'work' ? '#1d6fa4' : '#7c3aed') : 'white',
                    color: category === cat ? 'white' : '#888',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {cat === 'work' ? '💼 Work' : '🌿 Personal'}
                </button>
              ))}
            </div>
          </div>

          {/* Start date — create mode only */}
          {isCreate && (
            <label style={labelStyle}>
              Start date
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
            </label>
          )}

          {/* Status — edit mode only */}
          {!isCreate && (
            <label style={labelStyle}>
              Status
              <select value={status} onChange={(e) => { setStatus(e.target.value as Task['status']); }} style={inputStyle}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </label>
          )}

          {/* Progress — edit mode only */}
          {!isCreate && (
            <label style={labelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Progress</span>
                <span style={{ fontWeight: 600, color: '#333' }}>{progress}%</span>
              </div>
              <input type="range" min={0} max={100} step={5} value={progress}
                onChange={(e) => { setProgress(Number(e.target.value)); }}
                style={{ width: '100%', accentColor: '#4a9eff' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa', marginTop: 2 }}>
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </label>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0', margin: 0 }} />

          {/* Effort + Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={labelStyle}>
              Effort (hrs)
              <input type="number" min={0.25} step={0.25} value={effort}
                onChange={(e) => { setEffort(e.target.value); }} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Duration (days)
              <input type="number" min={1} step={1} value={duration}
                onChange={(e) => { setDuration(e.target.value); }} style={inputStyle} />
            </label>
          </div>

          <div style={{ fontSize: 11, color: '#888', background: '#f8f8f8', borderRadius: 4, padding: '6px 10px' }}>
            <strong>{dailyLoad} hrs/day</strong> planned load
          </div>

          {/* Deadline */}
          <label style={labelStyle}>
            Deadline
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="date" value={deadline}
                onChange={(e) => { setDeadline(e.target.value); }}
                style={{ ...inputStyle, flex: 1 }} />
              {deadline && (
                <button onClick={() => { setDeadline(''); }}
                  style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid #ddd', background: 'white', cursor: 'pointer', color: '#888' }}>
                  Clear
                </button>
              )}
            </div>
          </label>

          {/* Lock toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#444' }}>
            <input type="checkbox" checked={isLocked}
              onChange={(e) => { setIsLocked(e.target.checked); }}
              style={{ width: 15, height: 15, accentColor: '#4a9eff' }} />
            <span>🔒 Hard deadline</span>
          </label>

          <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0', margin: 0 }} />

          {/* Dependencies — editable in both create and edit mode */}
          {(props.taskOptionGroups ?? []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Dependencies</span>

              {/* Picker row */}
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  value={depSelect}
                  onChange={(e) => setDepSelect(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                >
                  <option value="">— pick a task —</option>
                  {(props.taskOptionGroups ?? []).map((g) => (
                    <optgroup key={g.groupLabel} label={g.groupLabel}>
                      {g.options
                        .filter((o) => !deps.includes(o.id) && (!isCreate ? o.id !== props.task?.id : true))
                        .map((o) => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  onClick={addDep}
                  disabled={!depSelect}
                  style={{
                    padding: '6px 12px', borderRadius: 5, border: 'none',
                    background: depSelect ? '#4a9eff' : '#e0e0e0',
                    color: depSelect ? 'white' : '#aaa',
                    fontWeight: 600, fontSize: 13,
                    cursor: depSelect ? 'pointer' : 'default',
                    flexShrink: 0,
                  }}
                >Add</button>
              </div>

              {/* Dependency chips list */}
              {deps.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {deps.map((id) => {
                    const opt = allOptions.find((o) => o.id === id);
                    return (
                      <div key={id} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: '#f0f7ff', borderRadius: 5,
                        padding: '5px 8px', fontSize: 12, color: '#1d6fa4',
                      }}>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {opt?.label ?? id}
                        </span>
                        <button
                          onClick={() => removeDep(id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b9ec4', fontSize: 16, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
                        >×</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e8e8e8', display: 'flex', gap: 8, background: '#fafafa' }}>
          {!isCreate && (props as EditProps).onDelete && (
            <button
              onClick={() => {
                if (window.confirm('Delete this task? This cannot be undone.')) {
                  (props as EditProps).onDelete!((props as EditProps).task.id);
                }
              }}
              style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#dc2626', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
              background: canSave ? '#4a9eff' : '#d0e8ff',
              color: canSave ? 'white' : '#8ab8e0',
              fontWeight: 600, fontSize: 13,
              cursor: canSave ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >
            {isCreate ? 'Add task' : 'Save'}
          </button>
          <button onClick={props.onClose}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd', background: 'white', color: '#555', fontSize: 13, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </>,
    document.body,
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
