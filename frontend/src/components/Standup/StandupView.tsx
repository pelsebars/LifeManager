import React, { useEffect, useRef, useState } from 'react';
import { useExecutionStore } from '../../store/executionStore';
import type { TodayTask, SlippedTask } from '../../types';

// ── Sub-components ────────────────────────────────────────────────────────────

function TodayTaskCard({ task, onComplete }: { task: TodayTask; onComplete: () => void }) {
  const isDone = task.status === 'completed';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderRadius: 8,
      background: isDone ? '#f0fdf4' : 'white',
      border: `1px solid ${isDone ? '#86efac' : '#e5e7eb'}`,
      transition: 'all 0.2s',
    }}>
      <button
        onClick={onComplete}
        disabled={isDone}
        title={isDone ? 'Completed' : 'Mark complete'}
        style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${isDone ? '#22c55e' : '#9ca3af'}`,
          background: isDone ? '#22c55e' : 'transparent',
          cursor: isDone ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 12, fontWeight: 700,
        }}
      >
        {isDone ? '✓' : ''}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: isDone ? '#6b7280' : '#111', textDecoration: isDone ? 'line-through' : 'none' }}>
          {task.title}
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
          {task.project_title} · {task.phase_title}
          {task.progress_pct > 0 && !isDone && ` · ${task.progress_pct}% done`}
        </div>
      </div>
      <div style={{
        fontSize: 11, padding: '2px 7px', borderRadius: 10,
        background: statusBg(task.status), color: statusFg(task.status),
        fontWeight: 600, whiteSpace: 'nowrap',
      }}>
        {task.status.replace('_', ' ')}
      </div>
    </div>
  );
}

function SlippedTaskCard({
  task, onAccept, onDismiss,
}: { task: SlippedTask; onAccept: () => void; onDismiss: () => void }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 8,
      background: '#fffbeb', border: '1px solid #fde68a',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
        Slipped: {task.title}
      </div>
      <div style={{ fontSize: 12, color: '#78716c', marginBottom: 8 }}>
        {task.project_title} · {task.phase_title}
        {' · '}Was due {task.original_end}
        {' → '}Proposed: {task.proposed_start_date} – {task.proposed_end_date}
      </div>
      {task.warning && (
        <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 8 }}>{task.warning}</div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onAccept}
          style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#f59e0b', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          Accept proposal
        </button>
        <button
          onClick={onDismiss}
          style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', fontSize: 12, cursor: 'pointer' }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StandupView() {
  const {
    messages, loading, error,
    todayTasks, slippedTasks,
    loadTodayTasks, completeTodayTask, applyReschedule, dismissSlipped,
    sendMessage, resetStandup,
  } = useExecutionStore();

  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => { loadTodayTasks(); }, [loadTodayTasks]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const pendingTasks  = todayTasks.filter((t) => t.status !== 'completed');
  const completedCount = todayTasks.filter((t) => t.status === 'completed').length;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Left panel: Today View + Slipped tasks ── */}
      <div style={{
        width: 320, flexShrink: 0, borderRight: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        padding: '1rem',
      }}>
        {/* Today header */}
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Today — {today}
          </div>
          {todayTasks.length > 0 && (
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              {completedCount}/{todayTasks.length} done
            </div>
          )}
        </div>

        {/* BL-21: Today task list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.5rem' }}>
          {todayTasks.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '1.5rem 0' }}>
              {localStorage.getItem('token')
                ? 'No tasks scheduled for today.'
                : 'Sign in to see today\'s tasks.'}
            </div>
          ) : (
            todayTasks.map((t) => (
              <TodayTaskCard
                key={t.id}
                task={t}
                onComplete={() => completeTodayTask(t.id)}
              />
            ))
          )}
        </div>

        {/* BL-26: Slipped task proposals */}
        {slippedTasks.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Slipped ({slippedTasks.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {slippedTasks.map((t) => (
                <SlippedTaskCard
                  key={t.id}
                  task={t}
                  onAccept={() => applyReschedule(t.id, t.proposed_start_date)}
                  onDismiss={() => dismissSlipped(t.id)}
                />
              ))}
            </div>
          </>
        )}

        {pendingTasks.length === 0 && todayTasks.length > 0 && slippedTasks.length === 0 && (
          <div style={{ marginTop: 12, fontSize: 13, color: '#22c55e', fontWeight: 600, textAlign: 'center' }}>
            All done for today!
          </div>
        )}
      </div>

      {/* ── Right panel: Standup Chat ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Chat header */}
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Daily Standup</span>
            <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>Powered by Claude</span>
          </div>
          {messages.length > 0 && (
            <button
              onClick={resetStandup}
              style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #d1d5db', cursor: 'pointer', fontSize: 12, background: 'white' }}
            >
              Reset
            </button>
          )}
        </div>

        {/* BL-24: Message thread */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>

          {/* BL-25: Start standup prompt */}
          {messages.length === 0 && (
            <div style={{ color: '#6b7280', textAlign: 'center', marginTop: '3rem' }}>
              <div style={{ fontSize: 14, marginBottom: '1rem' }}>
                {slippedTasks.length > 0
                  ? `${slippedTasks.length} task${slippedTasks.length > 1 ? 's' : ''} slipped from yesterday. Start the standup to review.`
                  : 'Ready to start your daily standup.'}
              </div>
              <button
                onClick={() => sendMessage("Good morning, let's do the standup.")}
                style={{ padding: '10px 24px', background: '#4a9eff', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
              >
                Start Standup
              </button>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.role === 'user' ? '#4a9eff' : '#f3f4f6',
                color: msg.role === 'user' ? 'white' : '#111',
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: '#f3f4f6', color: '#6b7280', fontSize: 14 }}>
                Thinking…
              </div>
            </div>
          )}

          {error && <div style={{ color: '#ef4444', fontSize: 13 }}>Error: {error}</div>}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '0.5rem' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
            rows={2}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'none', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{
              padding: '0 20px', background: '#4a9eff', color: 'white', border: 'none',
              borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
              opacity: (!input.trim() || loading) ? 0.5 : 1,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function statusBg(status: string) {
  switch (status) {
    case 'completed':   return '#dcfce7';
    case 'in_progress': return '#dbeafe';
    case 'deferred':    return '#f3f4f6';
    default:            return '#f3f4f6';
  }
}

function statusFg(status: string) {
  switch (status) {
    case 'completed':   return '#15803d';
    case 'in_progress': return '#1d4ed8';
    case 'deferred':    return '#6b7280';
    default:            return '#6b7280';
  }
}
