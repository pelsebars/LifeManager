import React, { useEffect, useRef, useState } from 'react';
import { useExecutionStore } from '../../store/executionStore';

export function StandupView() {
  const { messages, loading, error, loadTodayTasks, sendMessage, resetStandup } = useExecutionStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

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

  const isFirstMessage = messages.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Daily Standup</h2>
        {messages.length > 0 && (
          <button onClick={resetStandup} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #ccc', cursor: 'pointer', fontSize: 12 }}>
            Reset
          </button>
        )}
      </div>

      {/* Message thread */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '0.5rem' }}>
        {isFirstMessage && (
          <div style={{ color: '#888', textAlign: 'center', marginTop: '2rem' }}>
            <p>Start your daily standup by sending a message below.</p>
            <button
              onClick={() => sendMessage("Good morning, let's do the standup.")}
              style={{ padding: '8px 20px', background: '#4a9eff', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
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
              background: msg.role === 'user' ? '#4a9eff' : '#f0f0f0',
              color: msg.role === 'user' ? 'white' : '#333',
              fontSize: 14,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: '#f0f0f0', color: '#888', fontSize: 14 }}>
              Thinking…
            </div>
          </div>
        )}

        {error && <div style={{ color: '#f44336', fontSize: 13 }}>Error: {error}</div>}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #e0e0e0' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send)"
          rows={2}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', resize: 'none', fontSize: 14, fontFamily: 'inherit' }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          style={{ padding: '0 20px', background: '#4a9eff', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: (!input.trim() || loading) ? 0.5 : 1 }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
