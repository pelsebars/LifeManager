import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';

export const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  const { email, password, workspaceName } = req.body;
  if (!email || !password || !workspaceName) {
    res.status(400).json({ error: 'email, password, and workspaceName are required' });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [workspace] } = await client.query(
      'INSERT INTO workspaces (name) VALUES ($1) RETURNING id',
      [workspaceName]
    );
    const hash = await bcrypt.hash(password, 12);
    const { rows: [user] } = await client.query(
      'INSERT INTO users (workspace_id, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, workspace_id, role',
      [workspace.id, email, hash, 'owner']
    );
    await client.query('COMMIT');
    const token = signToken(user);
    res.status(201).json({ token });
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.constraint === 'users_email_key') {
      res.status(409).json({ error: 'Email already registered' });
    } else {
      res.status(500).json({ error: 'Registration failed' });
    }
  } finally {
    client.release();
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query(
    'SELECT id, workspace_id, role, password_hash FROM users WHERE email = $1',
    [email]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  res.json({ token: signToken(user) });
});

function signToken(user: { id: string; workspace_id: string; role: string }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign(
    { userId: user.id, workspaceId: user.workspace_id, role: user.role },
    secret,
    { expiresIn: '7d' }
  );
}
