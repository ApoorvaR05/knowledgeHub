/**
 * Tests for Hybrid Search Engine API.
 * DB pool and openaiClient are fully mocked.
 */

process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';

import request from 'supertest';
import app from '../index';
import { search as searchService } from '../services/searchService';
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
const userToken = signToken({ id: 1, email: 'user@example.com', role: 'user' });
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

// ─── searchService unit tests ─────────────────────────────────────────────────
describe('searchService.search', () => {
  it('happy path: returns results sorted by score descending, limited to topK', async () => {
    // call order: chunkVec, qaVec, chunkFts, qaFts
    pool.query
      .mockResolvedValueOnce({
        rows: [
          { id: 1, content: 'chunk content', document_id: 10, source: 'Doc A', vector_score: 0.9 },
          { id: 2, content: 'other chunk', document_id: 11, source: 'Doc B', vector_score: 0.5 },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { id: 5, question: 'What is X?', content: 'Answer about X', source: 'Q&A', vector_score: 0.8 },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })   // chunkFts — empty
      .mockResolvedValueOnce({ rows: [] });  // qaFts — empty

    const results = await searchService('test query', 2);

    // Only top 2 results returned
    expect(results).toHaveLength(2);

    // Sorted descending by combined score (pure vector: 0.7 * vector_score)
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);

    // Top hit is the 0.9 vector_score chunk
    expect(results[0].id).toBe(1);
    expect(results[0].type).toBe('chunk');
    expect(results[0].content).toBe('chunk content');
    expect(results[0].source).toBe('Doc A');
    expect(results[0].documentId).toBe(10);

    // Second hit is the qa pair (0.8 * 0.7 = 0.56 > 0.5 * 0.7 = 0.35)
    expect(results[1].id).toBe(5);
    expect(results[1].type).toBe('qa');
    expect(results[1].question).toBe('What is X?');
    expect(results[1].source).toBe('Q&A');
  });

  it('weighted combination: chunk in both vector and FTS results gets blended score', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          { id: 1, content: 'chunk content', document_id: 10, source: 'Doc A', vector_score: 0.6 },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })  // qaVec
      .mockResolvedValueOnce({
        rows: [
          { id: 1, fts_score: 1.0 },  // same chunk also found by FTS
        ],
      })
      .mockResolvedValueOnce({ rows: [] }); // qaFts

    const results = await searchService('chunk content', 5);

    expect(results).toHaveLength(1);
    const expectedScore = 0.7 * 0.6 + 0.3 * 1.0;
    expect(results[0].score).toBeCloseTo(expectedScore, 5);
    expect(results[0].id).toBe(1);
    expect(results[0].type).toBe('chunk');
  });
});

// ─── POST /api/search ─────────────────────────────────────────────────────────
describe('POST /api/search', () => {
  it('200 – happy path: returns results array and echoes query', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          { id: 3, content: 'relevant content', document_id: 7, source: 'Doc C', vector_score: 0.75 },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/search')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ query: 'what is knowledge hub' });

    expect(res.status).toBe(200);
    expect(res.body.query).toBe('what is knowledge hub');
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].id).toBe(3);
    expect(res.body.results[0].type).toBe('chunk');
  });

  it('422 – empty query string', async () => {
    const res = await request(app)
      .post('/api/search')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ query: '' });

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('422 – missing query field', async () => {
    const res = await request(app)
      .post('/api/search')
      .set('Authorization', `Bearer ${userToken}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('401 – no auth token', async () => {
    const res = await request(app)
      .post('/api/search')
      .send({ query: 'something' });

    expect(res.status).toBe(401);
  });
});
