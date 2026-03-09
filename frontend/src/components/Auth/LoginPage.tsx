import { useState } from 'react';
import { api } from '../../api/client';

interface Props {
  onSuccess: () => void;
}

export function LoginPage({ onSuccess }: Props) {
  const [mode, setMode]                 = useState<'login' | 'register'>('login');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [workspaceName, setWorkspace]   = useState('');
  const [error, setError]               = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let token: string;
      if (mode === 'login') {
        ({ token } = await api.auth.login({ email, password }));
      } else {
        ({ token } = await api.auth.register({ email, password, workspaceName }));
      }
      localStorage.setItem('token', token);
      onSuccess();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f0f4f8', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: 'white', borderRadius: 12, padding: '2rem 2.5rem',
        width: 360, boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.5px' }}>
            LifeManager
          </div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            Your personal life planning assistant
          </div>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', marginBottom: '1.5rem', borderBottom: '2px solid #f0f0f0' }}>
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); }}
              style={{
                flex: 1, padding: '8px 0', border: 'none', background: 'none',
                fontWeight: mode === m ? 700 : 400,
                color: mode === m ? '#4a9eff' : '#888',
                borderBottom: mode === m ? '2px solid #4a9eff' : '2px solid transparent',
                marginBottom: -2, cursor: 'pointer', fontSize: 14, transition: 'all 0.15s',
              }}
            >
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'register' && (
            <label style={labelStyle}>
              Workspace name
              <input
                type="text" required placeholder="e.g. Hansen Household"
                value={workspaceName} onChange={(e) => setWorkspace(e.target.value)}
                style={inputStyle}
              />
            </label>
          )}

          <label style={labelStyle}>
            Email
            <input
              type="email" required placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Password
            <input
              type="password" required placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </label>

          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', background: '#fef2f2', borderRadius: 5, padding: '8px 10px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4, padding: '10px 0', borderRadius: 8, border: 'none',
              background: loading ? '#93c5fd' : '#4a9eff', color: 'white',
              fontWeight: 700, fontSize: 14, cursor: loading ? 'default' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {mode === 'login' && (
          <div style={{ marginTop: 16, fontSize: 11, color: '#aaa', textAlign: 'center' }}>
            Demo: demo@lifemanager.app / demo1234
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: 12, fontWeight: 600, color: '#555',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd',
  fontSize: 14, color: '#222', outline: 'none', width: '100%', boxSizing: 'border-box',
};
