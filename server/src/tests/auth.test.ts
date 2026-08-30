/**
 * Integration tests for /api/auth routes.
 * The DB pool is fully mocked — no real database connection required.
 */

// Set env vars BEFORE importing anything that reads them at module load time.
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';

import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../index';
import { signToken } from '../utils/jwt';

// ─── Mock the DB pool ────────────────────────────────────────────────────────
jest.mock('../db/pool', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pool = require('../db/pool').default as { query: jest.Mock };

beforeAll(() => {
  // Absorb the startup `pool.query('SELECT 1')` fired by app.listen
  pool.query.mockResolvedValue({ rows: [] });
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterAll(() => {
  jest.restoreAllMocks();
});

afterEach(() => {
  // Reset to a safe default after each test so stray calls never throw
  pool.query.mockReset();
  pool.query.mockResolvedValue({ rows: [] });
});

// ─── POST /api/auth/register ─────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('201 – happy path: creates and returns user', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })                                  // email check → not taken
      .mockResolvedValueOnce({                                               // INSERT → new row
        rows: [{ id: 1, email: 'alice@example.com', role: 'user' }],
      });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      id: 1,
      email: 'alice@example.com',
      role: 'user',
    });
  });

  it('409 – duplicate email', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // email already taken

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Email already in use' });
  });

  it('422 – password too short', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'short' });

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('422 – invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('200 – valid credentials: returns token and user', async () => {
    // Use cost 1 to keep tests fast
    const hash = await bcrypt.hash('password123', 1);
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'alice@example.com', role: 'user', password_hash: hash }],
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({
      id: 1,
      email: 'alice@example.com',
      role: 'user',
    });
  });

  it('401 – wrong password', async () => {
    const hash = await bcrypt.hash('correct-password', 1);
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'alice@example.com', role: 'user', password_hash: hash }],
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('401 – unknown email', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // user not found

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid credentials' });
  });

  it('422 – missing password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  it('200 – valid JWT: returns user profile', async () => {
    const token = signToken({ id: 1, email: 'alice@example.com', role: 'user' });
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 1,
        email: 'alice@example.com',
        role: 'user',
        created_at: '2024-01-01T00:00:00.000Z',
      }],
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: 1,
      email: 'alice@example.com',
      role: 'user',
    });
  });

  it('401 – no token provided', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('401 – invalid/malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer this-is-not-a-valid-jwt');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });
});
