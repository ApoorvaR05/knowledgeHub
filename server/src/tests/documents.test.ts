/**
 * Tests for document upload & processing pipeline.
 * DB pool, openaiClient, pdf-parse, and mammoth are fully mocked.
 */

process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '1h';

import request from 'supertest';
import path from 'path';
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

// ─── Mock pdf-parse ───────────────────────────────────────────────────────────
jest.mock('pdf-parse', () =>
  jest.fn().mockResolvedValue({ text: 'pdf content' }),
);

// ─── Mock mammoth ─────────────────────────────────────────────────────────────
jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockResolvedValue({ value: 'docx content' }),
}));

// ─── Mock fs for extractText (txt) ───────────────────────────────────────────
jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...actual,
    readFileSync: jest.fn((filePath: string, encoding?: string) => {
      if (encoding === 'utf-8') return 'txt content';
      // For pdf-parse — return a Buffer
      return Buffer.from('fake pdf bytes');
    }),
    unlinkSync: jest.fn(),
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pool = require('../db/pool').default as { query: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const openaiMock = require('../services/openaiClient').default as {
  embeddings: { create: jest.Mock };
};

import { chunkText, extractText, processDocument } from '../services/documentProcessor';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const adminToken = signToken({ id: 1, email: 'admin@example.com', role: 'admin' });
const userToken = signToken({ id: 2, email: 'user@example.com', role: 'user' });

beforeEach(() => {
  pool.query.mockReset();
  pool.query.mockResolvedValue({ rows: [] });
  openaiMock.embeddings.create.mockReset();
});

afterAll(() => {
  jest.restoreAllMocks();
});

// ─── chunkText ────────────────────────────────────────────────────────────────
describe('chunkText', () => {
  it('returns a single chunk for short text', () => {
    const words = Array.from({ length: 10 }, (_, i) => `word${i}`);
    const chunks = chunkText(words.join(' '), 512, 64);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(words.join(' '));
  });

  it('produces correct number of chunks with overlap', () => {
    // 600 words, chunkSize=512, overlap=64 → step=448
    // chunk 0: words 0-511, chunk 1: words 448-599 (152 words)
    const words = Array.from({ length: 600 }, (_, i) => `w${i}`);
    const chunks = chunkText(words.join(' '), 512, 64);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].split(' ')).toHaveLength(512);
  });

  it('filters out empty chunks', () => {
    const chunks = chunkText('   ', 512, 64);
    expect(chunks).toHaveLength(0);
  });

  it('handles exact multiple of step', () => {
    // 896 words: chunk 0: 0-511, chunk 1: 448-895 (448 words)
    const words = Array.from({ length: 896 }, (_, i) => `w${i}`);
    const chunks = chunkText(words.join(' '), 512, 64);
    expect(chunks).toHaveLength(2);
  });
});

// ─── extractText ─────────────────────────────────────────────────────────────
describe('extractText', () => {
  it('extracts text from PDF', async () => {
    const text = await extractText('/fake/file.pdf', 'application/pdf');
    expect(text).toBe('pdf content');
  });

  it('extracts text from DOCX', async () => {
    const text = await extractText(
      '/fake/file.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(text).toBe('docx content');
  });

  it('extracts text from TXT', async () => {
    const text = await extractText('/fake/file.txt', 'text/plain');
    expect(text).toBe('txt content');
  });

  it('throws for unsupported mime type', async () => {
    await expect(extractText('/fake/file.png', 'image/png')).rejects.toThrow(
      'Unsupported file type: image/png',
    );
  });
});

// ─── processDocument ─────────────────────────────────────────────────────────
describe('processDocument', () => {
  it('happy path: embeds chunks, inserts rows, marks doc ready', async () => {
    // pool.query calls: INSERT chunks, UPDATE status=ready
    pool.query.mockResolvedValue({ rows: [] });

    const fakeEmbedding = Array.from({ length: 1536 }, () => 0.1);
    openaiMock.embeddings.create.mockResolvedValue({
      data: [{ embedding: fakeEmbedding }],
    });

    // extractText will use the mocked fs (txt path)
    await processDocument(42, '/fake/file.txt', 'text/plain');

    expect(openaiMock.embeddings.create).toHaveBeenCalledWith({
      model: 'text-embedding-ada-002',
      input: expect.any(Array),
    });

    // First pool.query call is the INSERT into document_chunks
    const insertCall = pool.query.mock.calls[0] as [string, unknown[]];
    expect(insertCall[0]).toMatch(/INSERT INTO document_chunks/i);

    // Second pool.query call updates status to ready
    const updateCall = pool.query.mock.calls[1] as [string, unknown[]];
    expect(updateCall[0]).toMatch(/UPDATE documents SET status = 'ready'/i);
    expect(updateCall[1]).toEqual([42]);
  });

  it('marks doc as failed and rethrows on extraction error', async () => {
    // Override extractText to throw by providing an unsupported mime type
    pool.query.mockResolvedValue({ rows: [] });

    await expect(
      processDocument(99, '/fake/file.bin', 'application/octet-stream'),
    ).rejects.toThrow('Unsupported file type');

    // pool.query should have been called once: UPDATE status='failed'
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE documents SET status = 'failed'/i),
      [99],
    );
  });
});

// ─── GET /api/documents ───────────────────────────────────────────────────────
describe('GET /api/documents', () => {
  it('200 – returns list for authenticated user', async () => {
    const docs = [
      { id: 1, title: 'Doc 1', status: 'ready', created_at: '2024-01-01T00:00:00Z' },
    ];
    pool.query.mockResolvedValueOnce({ rows: docs });

    const res = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.documents).toEqual(docs);
  });

  it('401 – no token', async () => {
    const res = await request(app).get('/api/documents');
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/documents/:id ────────────────────────────────────────────────
describe('DELETE /api/documents/:id', () => {
  it('204 – deletes existing document', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const res = await request(app)
      .delete('/api/documents/1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);
  });

  it('404 – document not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/documents/999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Document not found' });
  });

  it('401 – no token', async () => {
    const res = await request(app).delete('/api/documents/1');
    expect(res.status).toBe(401);
  });

  it('403 – non-admin cannot delete', async () => {
    const res = await request(app)
      .delete('/api/documents/1')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── POST /api/documents (upload) — basic auth guards ─────────────────────────
describe('POST /api/documents', () => {
  it('401 – no token', async () => {
    const res = await request(app).post('/api/documents');
    expect(res.status).toBe(401);
  });

  it('403 – non-admin cannot upload', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('422 – missing file', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(422);
  });

  it('201 – uploads a txt file and returns document', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 10,
        title: 'test.txt',
        file_name: 'test.txt',
        file_type: 'text/plain',
        uploaded_by: 1,
        status: 'processing',
        created_at: '2024-01-01T00:00:00Z',
      }],
    });
    // subsequent calls for processDocument (async, fire-and-forget)
    pool.query.mockResolvedValue({ rows: [] });
    openaiMock.embeddings.create.mockResolvedValue({
      data: [{ embedding: Array.from({ length: 1536 }, () => 0) }],
    });

    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('hello world'), {
        filename: 'test.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(201);
    expect(res.body.document).toMatchObject({ id: 10, title: 'test.txt' });
  });
});
