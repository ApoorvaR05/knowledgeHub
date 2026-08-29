import request from 'supertest';
import { createApp } from '../app';
import { ChatService } from '../services/ChatService';
import { SearchService } from '../services/SearchService';
import { signToken } from '../utils/jwt';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock the DB pool so no real PostgreSQL is needed
jest.mock('../db/pool', () => ({
  query: jest.fn(),
  pool: { on: jest.fn() },
}));

// Mock OpenAI — use a module-level variable via jest.fn() inside factory
// jest.mock is hoisted so we use a factory-internal reference exposed via module scope
jest.mock('openai', () => {
  const create = jest.fn();
  const ctor = jest.fn().mockImplementation(() => ({ chat: { completions: { create } } }));
  (ctor as unknown as Record<string, unknown>).__mockCreate = create;
  return ctor;
});

// Retrieve the mock create fn after jest.mock has run
// eslint-disable-next-line @typescript-eslint/no-require-imports
const OpenAIMock = require('openai') as { __mockCreate: jest.Mock };
const mockCreate: jest.Mock = OpenAIMock.__mockCreate;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const app = createApp();

const userToken = signToken({ id: 'user-1', email: 'user@test.com', role: 'user' });
const authHeader = `Bearer ${userToken}`;

const mockSession = {
  id: 'session-1',
  user_id: 'user-1',
  created_at: new Date().toISOString(),
};

const mockMessage = {
  id: 'msg-1',
  session_id: 'session-1',
  role: 'user' as const,
  content: 'Hello',
  created_at: new Date().toISOString(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/chat/sessions', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/chat/sessions');
    expect(res.status).toBe(401);
  });

  it('creates a session and returns 201', async () => {
    jest.spyOn(ChatService.prototype, 'createSession').mockResolvedValue(mockSession);

    const res = await request(app)
      .post('/api/chat/sessions')
      .set('Authorization', authHeader);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'session-1', user_id: 'user-1' });
  });
});

describe('GET /api/chat/sessions', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/chat/sessions');
    expect(res.status).toBe(401);
  });

  it('returns list of sessions', async () => {
    jest.spyOn(ChatService.prototype, 'listSessions').mockResolvedValue([mockSession]);

    const res = await request(app)
      .get('/api/chat/sessions')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: 'session-1' });
  });
});

describe('GET /api/chat/sessions/:id/messages', () => {
  it('returns 404 when session does not belong to user', async () => {
    jest.spyOn(ChatService.prototype, 'getSession').mockResolvedValue(null);

    const res = await request(app)
      .get('/api/chat/sessions/bad-id/messages')
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });

  it('returns message list', async () => {
    jest.spyOn(ChatService.prototype, 'getSession').mockResolvedValue(mockSession);
    jest.spyOn(ChatService.prototype, 'listMessages').mockResolvedValue([mockMessage]);

    const res = await request(app)
      .get('/api/chat/sessions/session-1/messages')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ content: 'Hello', role: 'user' });
  });
});

describe('POST /api/chat/sessions/:id/messages', () => {
  it('returns 400 when content is missing', async () => {
    jest.spyOn(ChatService.prototype, 'getSession').mockResolvedValue(mockSession);

    const res = await request(app)
      .post('/api/chat/sessions/session-1/messages')
      .set('Authorization', authHeader)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 404 when session not found', async () => {
    jest.spyOn(ChatService.prototype, 'getSession').mockResolvedValue(null);

    const res = await request(app)
      .post('/api/chat/sessions/bad-id/messages')
      .set('Authorization', authHeader)
      .send({ content: 'Hello' });

    expect(res.status).toBe(404);
  });

  it('streams SSE response with GPT-4 tokens', async () => {
    jest.spyOn(ChatService.prototype, 'getSession').mockResolvedValue(mockSession);
    jest.spyOn(ChatService.prototype, 'saveMessage').mockResolvedValue(mockMessage);
    jest.spyOn(ChatService.prototype, 'getRecentHistory').mockResolvedValue([]);
    jest.spyOn(SearchService.prototype, 'search').mockResolvedValue([
      { id: 'c1', type: 'chunk', content: 'Relevant context here.', score: 0.9 },
    ]);

    // Mock OpenAI async iterable stream
    const mockStream = (async function* () {
      yield { choices: [{ delta: { content: 'Hello' } }] };
      yield { choices: [{ delta: { content: ' world' } }] };
      yield { choices: [{ delta: { content: '!' } }] };
    })();

    mockCreate.mockResolvedValue(mockStream);

    const res = await request(app)
      .post('/api/chat/sessions/session-1/messages')
      .set('Authorization', authHeader)
      .send({ content: 'Tell me something' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    expect(res.text).toContain('data: Hello');
    expect(res.text).toContain('data: [DONE]');
  });
});
