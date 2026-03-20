/**
 * EditPhasePanel — BL-38/39/40
 *
 * Slide-in portal panel for editing a phase's title or deleting a phase.
 * Mirrors the visual style of TaskDetailPanel.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Phase } from '../../types';

interface Props {
  phase: Phase;
  onSave: (id: string, patch: Partial<Phase>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function EditPhasePanel({ phase, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(phase.title);
  const dirty = title.trim() !== phase.title;

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(phase.id, { title: title.trim() });
  };

  const handleDelete = () => {
    if (window.confirm(`Delete phase "${phase.title}"? All tasks in this phase will be deleted. This cannot be undone.`)) {
      onDelete(phase.id);
    }
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.15)' }}
      />

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
          background: '#fafafa',
        }}>
          <span style={{
            fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
            background: '#f0f7ff', color: '#1d6fa4',
            padding: '2px 6px', borderRadius: 4,
          }}>
            PHASE
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#222', flex: 1 }}>
            Edit Phase
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888', lineHeight: 1, padding: 2 }}
          >
            ×
          </button>
        </div>

        {/* Form body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={labelStyle}>
            Title
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Phase title…"
              style={inputStyle}
            />
          </label>

          <div style={{ fontSize: 11, color: '#aaa', background: '#f8f8f8', borderRadius: 4, padding: '6px 10px' }}>
            Order: {phase.order}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e8e8e8', display: 'flex', gap: 8, background: '#fafafa' }}>
          <button
            onClick={handleDelete}
            style={{
              padding: '8px 14px', borderRadius: 6, border: 'none',
              background: '#fee2e2', color: '#dc2626',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            Delete
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || !title.trim()}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
              background: (dirty && title.trim()) ? '#4a9eff' : '#d0e8ff',
              color: (dirty && title.trim()) ? 'white' : '#8ab8e0',
              fontWeight: 600, fontSize: 13,
              cursor: (dirty && title.trim()) ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >
            Save
          </button>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd', background: 'white', color: '#555', fontSize: 13, cursor: 'pointer' }}
          >
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
