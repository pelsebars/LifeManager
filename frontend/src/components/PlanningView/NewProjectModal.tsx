/**
 * NewProjectModal — BL-35
 *
 * Slide-in panel for creating a new project.
 * Follows the same portal + backdrop pattern as TaskDetailPanel.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';

export interface NewProjectData {
  title: string;
  description: string;
  start_date: string;
  target_end_date: string;
}

interface Props {
  onCreate: (data: NewProjectData) => Promise<void>;
  onClose: () => void;
}

const today = new Date().toISOString().slice(0, 10);
const oneMonthOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 5,
  fontSize: 12, fontWeight: 600, color: '#555',
};

const inputStyle: React.CSSProperties = {
  padding: '6px 8px', borderRadius: 5,
  border: '1px solid #ddd', fontSize: 13, color: '#222',
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

export function NewProjectModal({ onCreate, onClose }: Props) {
  const [title, setTitle]           = useState('');
  const [description, setDesc]      = useState('');
  const [startDate, setStartDate]   = useState(today);
  const [endDate, setEndDate]       = useState(oneMonthOut);
  const [saving, setSaving]         = useState(false);

  const canSave = title.trim().length > 0 && startDate && endDate;

  const handleCreate = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onCreate({ title: title.trim(), description, start_date: startDate, target_end_date: endDate });
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.15)' }} />

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
          background: '#f0fdf4',
        }}>
          <span style={{
            fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
            background: '#dcfce7', color: '#166534',
            padding: '2px 6px', borderRadius: 4,
          }}>NEW</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#222', flex: 1 }}>New Project</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888', lineHeight: 1, padding: 2 }}>×</button>
        </div>

        {/* Form body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

          <label style={labelStyle}>
            Title
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project title…"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Description
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Optional description…"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </label>

          <label style={labelStyle}>
            Start date
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </label>

          <label style={labelStyle}>
            Target end date
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
          </label>

        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e8e8e8', display: 'flex', gap: 8, background: '#fafafa' }}>
          <button
            onClick={handleCreate}
            disabled={!canSave || saving}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
              background: canSave && !saving ? '#4a9eff' : '#d0e8ff',
              color: canSave && !saving ? 'white' : '#8ab8e0',
              fontWeight: 600, fontSize: 13,
              cursor: canSave && !saving ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >
            {saving ? 'Creating…' : 'Create project'}
          </button>
          <button onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd', background: 'white', color: '#555', fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
