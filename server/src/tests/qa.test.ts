/**
 * Tests for Q&A Pair Management API.
 * DB pool and openaiClient are fully mocked.
 */

process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';

import request from 'supertest';
import app from '../index';
import { signToken } from '../utils/jwt';

// ─── Mock pool ────────────────────────────────────────────────────────────────
jest.mock('../db/pool', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

// ─── Mock openaiClient ────────────────────────────────────────────────────────
jest.mock('../services/openaiClient', () => ({
  __esModule: true,
  default: {
    embeddings: {
      create: jest.fn(),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pool = require('../db/pool').default as { query: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const openaiMock = require('../services/openaiClient').default as {
  embeddings: { create: jest.Mock };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const adminToken = signToken({ id: 1, email: 'admin@example.com', role: 'admin' });
const userToken = signToken({ id: 2, email: 'user@example.com', role: 'user' });

const fakeEmbedding = Array.from({ length: 1536 }, () => 0.1);

beforeEach(() => {
  pool.query.mockReset();
  pool.query.mockResolvedValue({ rows: [] });
  openaiMock.embeddings.create.mockReset();
  openaiMock.embeddings.create.mockResolvedValue({
    data: [{ embedding: fakeEmbedding }],
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

// ─── POST /api/qa ─────────────────────────────────────────────────────────────
describe('POST /api/qa', () => {
  it('201 – creates a QA pair and returns it', async () => {
    const qaPair = {
      id: 1,
      question: 'What is TypeScript?',
      answer: 'A typed superset of JavaScript.',
      created_by: 1,
      created_at: '2024-01-01T00:00:00Z',
    };
    pool.query.mockResolvedValueOnce({ rows: [qaPair] });

    const res = await request(app)
      .post('/api/qa')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ question: 'What is TypeScript?', answer: 'A typed superset of JavaScript.' });

    expect(res.status).toBe(201);
    expect(res.body.qaPair).toEqual(qaPair);
    expect(openaiMock.embeddings.create).toHaveBeenCalledWith({
      model: 'text-embedding-ada-002',
      input: 'What is TypeScript?',
    });
  });

  it('422 – missing question', async () => {
    const res = await request(app)
      .post('/api/qa')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ answer: 'Some answer' });

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('422 – missing answer', async () => {
    const res = await request(app)
      .post('/api/qa')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ question: 'Some question?' });

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('401 – no token', async () => {
    const res = await request(app)
      .post('/api/qa')
      .send({ question: 'Q?', answer: 'A.' });

    expect(res.status).toBe(401);
  });

  it('403 – non-admin cannot create', async () => {
    const res = await request(app)
      .post('/api/qa')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ question: 'Q?', answer: 'A.' });

    expect(res.status).toBe(403);
  });
});

// ─── GET /api/qa ──────────────────────────────────────────────────────────────
describe('GET /api/qa', () => {
  it('200 – returns qaPairs with pagination meta', async () => {
    const qaPairs = [
      { id: 1, question: 'Q1', answer: 'A1', created_by: 1, created_at: '2024-01-01T00:00:00Z' },
      { id: 2, question: 'Q2', answer: 'A2', created_by: 1, created_at: '2024-01-02T00:00:00Z' },
    ];
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: qaPairs });

    const res = await request(app)
      .get('/api/qa')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.qaPairs).toEqual(qaPairs);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });

  it('200 – respects page and limit query params', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '50' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/qa?page=2&limit=10')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(50);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(10);
  });

  it('401 – no token', async () => {
    const res = await request(app).get('/api/qa');
    expect(res.status).toBe(401);
  });
});

// ─── PUT /api/qa/:id ──────────────────────────────────────────────────────────
describe('PUT /api/qa/:id', () => {
  it('200 – updates and returns the QA pair', async () => {
    const updated = {
      id: 1,
      question: 'Updated question?',
      answer: 'Updated answer.',
      created_by: 1,
      created_at: '2024-01-01T00:00:00Z',
    };
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // existence check
      .mockResolvedValueOnce({ rows: [updated] });   // UPDATE returning

    const res = await request(app)
      .put('/api/qa/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ question: 'Updated question?', answer: 'Updated answer.' });

    expect(res.status).toBe(200);
    expect(res.body.qaPair).toEqual(updated);
    expect(openaiMock.embeddings.create).toHaveBeenCalledWith({
      model: 'text-embedding-ada-002',
      input: 'Updated question?',
    });
  });

  it('404 – QA pair not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // existence check returns nothing

    const res = await request(app)
      .put('/api/qa/999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ question: 'Q?', answer: 'A.' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'QA pair not found' });
  });

  it('422 – missing question', async () => {
    const res = await request(app)
      .put('/api/qa/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ answer: 'Only answer' });

    expect(res.status).toBe(422);
  });

  it('401 – no token', async () => {
    const res = await request(app)
      .put('/api/qa/1')
      .send({ question: 'Q?', answer: 'A.' });

    expect(res.status).toBe(401);
  });

  it('403 – non-admin cannot update', async () => {
    const res = await request(app)
      .put('/api/qa/1')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ question: 'Q?', answer: 'A.' });

    expect(res.status).toBe(403);
  });
});

// ─── DELETE /api/qa/:id ───────────────────────────────────────────────────────
describe('DELETE /api/qa/:id', () => {
  it('204 – deletes the QA pair', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const res = await request(app)
      .delete('/api/qa/1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
  });

  it('404 – QA pair not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/qa/999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'QA pair not found' });
  });

  it('401 – no token', async () => {
    const res = await request(app).delete('/api/qa/1');
    expect(res.status).toBe(401);
  });

  it('403 – non-admin cannot delete', async () => {
    const res = await request(app)
      .delete('/api/qa/1')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });
});
