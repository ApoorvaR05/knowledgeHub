import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { validationResult } from 'express-validator';
import pool from '../db/pool';
import { signToken } from '../utils/jwt';

export const register = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }

  const { email, password } = req.body as { email: string; password: string };

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role',
    [email, passwordHash],
  );

  const user = result.rows[0] as { id: number; email: string; role: string };
  res.status(201).json({ token: signToken({ id: String(user.id), email: user.email, role: user.role as 'admin' | 'user' }), user });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }

  const { email, password } = req.body as { email: string; password: string };

  const result = await pool.query(
    'SELECT id, email, role, password_hash FROM users WHERE email = $1',
    [email],
  );

  if (result.rows.length === 0) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const user = result.rows[0] as {
    id: number;
    email: string;
    role: string;
    password_hash: string;
  };

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken({ id: String(user.id), email: user.email, role: user.role as 'admin' | 'user' });
  res.status(200).json({ token, user: { id: user.id, email: user.email, role: user.role } });
};

export const me = async (req: Request, res: Response): Promise<void> => {
  const result = await pool.query(
    'SELECT id, email, role, created_at FROM users WHERE id = $1',
    [req.user!.id],
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.status(200).json({ user: result.rows[0] });
};
