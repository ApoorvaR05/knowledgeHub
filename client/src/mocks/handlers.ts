import { http, HttpResponse, delay } from 'msw';
import type {
  User,
  Document,
  QAPair,
  SearchResult,
  ChatSession,
  ChatMessage,
} from '../types';

// ─── In-memory stores ─────────────────────────────────────────────────────────

const users: (User & { password: string })[] = [
  { id: 'u1', email: 'admin@example.com', password: 'password', role: 'admin' },
  { id: 'u2', email: 'user@example.com', password: 'password', role: 'user' },
];

const documents: Document[] = [
  {
    id: 'd1',
    title: 'Company Handbook',
    file_name: 'handbook.pdf',
    file_type: 'application/pdf',
    uploaded_by: 'u1',
    status: 'ready',
    created_at: new Date().toISOString(),
  },
];

const qaPairs: QAPair[] = [
  {
    id: 'q1',
    question: 'What is our vacation policy?',
    answer: 'Full-time employees receive 20 days of paid leave per year.',
    created_by: 'u1',
    created_at: new Date().toISOString(),
  },
];

const sessions: ChatSession[] = [];
const messages: Record<string, ChatMessage[]> = {};

let nextId = 100;
const uid = () => String(nextId++);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToken(user: User) {
  // Mock JWT — base64(header).base64(payload).signature
  const payload = btoa(JSON.stringify({ id: user.id, email: user.email, role: user.role }));
  return `mock.${payload}.sig`;
}

function userFromToken(req: Request): User | null {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace('Bearer ', '');
  if (!token.startsWith('mock.')) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { id: payload.id, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

// ─── Handlers ─────────────────────────────────────────────────────────────────

export const handlers = [
  // AUTH
  http.post(`${BASE}/api/auth/register`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string; role?: string };
    if (users.find(u => u.email === body.email)) {
      return HttpResponse.json({ message: 'Email already registered' }, { status: 409 });
    }
    const user: User & { password: string } = {
      id: uid(),
      email: body.email,
      password: body.password,
      role: (body.role as 'admin' | 'user') ?? 'user',
    };
    users.push(user);
    return HttpResponse.json({ token: makeToken(user) }, { status: 201 });
  }),

  http.post(`${BASE}/api/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    const user = users.find(u => u.email === body.email && u.password === body.password);
    if (!user) {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    return HttpResponse.json({ token: makeToken(user) });
  }),

  http.get(`${BASE}/api/auth/me`, ({ request }) => {
    const user = userFromToken(request);
    if (!user) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return HttpResponse.json(user);
  }),

  // DOCUMENTS
  http.get(`${BASE}/api/documents`, ({ request }) => {
    if (!userFromToken(request)) {
      return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    return HttpResponse.json(documents);
  }),

  http.post(`${BASE}/api/documents`, async ({ request }) => {
    const user = userFromToken(request);
    if (!user || user.role !== 'admin') {
      return HttpResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const form = await request.formData();
    const file = form.get('file') as File;
    const title = (form.get('title') as string) ?? file.name;
    const doc: Document = {
      id: uid(),
      title,
      file_name: file.name,
      file_type: file.type,
      uploaded_by: user.id,
      status: 'processing',
      created_at: new Date().toISOString(),
    };
    documents.push(doc);
    // Simulate async processing → ready after 3 s
    setTimeout(() => {
      doc.status = 'ready';
    }, 3000);
    return HttpResponse.json(doc, { status: 201 });
  }),

  http.delete(`${BASE}/api/documents/:id`, ({ request, params }) => {
    const user = userFromToken(request);
    if (!user || user.role !== 'admin') {
      return HttpResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const idx = documents.findIndex(d => d.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    documents.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // Q&A
  http.get(`${BASE}/api/qa`, ({ request }) => {
    const user = userFromToken(request);
    if (!user) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const start = (page - 1) * limit;
    return HttpResponse.json({
      data: qaPairs.slice(start, start + limit),
      total: qaPairs.length,
      page,
      limit,
    });
  }),

  http.post(`${BASE}/api/qa`, async ({ request }) => {
    const user = userFromToken(request);
    if (!user || user.role !== 'admin') {
      return HttpResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const body = (await request.json()) as { question: string; answer: string };
    const pair: QAPair = {
      id: uid(),
      question: body.question,
      answer: body.answer,
      created_by: user.id,
      created_at: new Date().toISOString(),
    };
    qaPairs.push(pair);
    return HttpResponse.json(pair, { status: 201 });
  }),

  http.put(`${BASE}/api/qa/:id`, async ({ request, params }) => {
    const user = userFromToken(request);
    if (!user || user.role !== 'admin') {
      return HttpResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const pair = qaPairs.find(q => q.id === params.id);
    if (!pair) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const body = (await request.json()) as { question: string; answer: string };
    pair.question = body.question;
    pair.answer = body.answer;
    return HttpResponse.json(pair);
  }),

  http.delete(`${BASE}/api/qa/:id`, ({ request, params }) => {
    const user = userFromToken(request);
    if (!user || user.role !== 'admin') {
      return HttpResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    const idx = qaPairs.findIndex(q => q.id === params.id);
    if (idx === -1) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    qaPairs.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // SEARCH
  http.post(`${BASE}/api/search`, async ({ request }) => {
    const user = userFromToken(request);
    if (!user) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const body = (await request.json()) as { query: string };
    const q = body.query.toLowerCase();
    const results: SearchResult[] = [
      ...documents
        .filter(d => d.status === 'ready')
        .map((d, i) => ({
          id: `chunk-${d.id}-${i}`,
          type: 'chunk' as const,
          content: `(Mock) Relevant excerpt from "${d.title}" matching: ${q}`,
          score: 0.95 - i * 0.1,
          source_title: d.title,
          document_id: d.id,
        })),
      ...qaPairs
        .filter(p => p.question.toLowerCase().includes(q) || p.answer.toLowerCase().includes(q))
        .map((p, i) => ({
          id: `qa-${p.id}`,
          type: 'qa' as const,
          content: `Q: ${p.question}\nA: ${p.answer}`,
          score: 0.9 - i * 0.05,
          question: p.question,
        })),
    ].sort((a, b) => b.score - a.score);
    return HttpResponse.json(results);
  }),

  // CHAT SESSIONS
  http.get(`${BASE}/api/chat/sessions`, ({ request }) => {
    const user = userFromToken(request);
    if (!user) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return HttpResponse.json(sessions.filter(s => s.user_id === user.id));
  }),

  http.post(`${BASE}/api/chat/sessions`, ({ request }) => {
    const user = userFromToken(request);
    if (!user) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const session: ChatSession = {
      id: uid(),
      user_id: user.id,
      created_at: new Date().toISOString(),
    };
    sessions.push(session);
    messages[session.id] = [];
    return HttpResponse.json(session, { status: 201 });
  }),

  http.get(`${BASE}/api/chat/sessions/:id/messages`, ({ request, params }) => {
    const user = userFromToken(request);
    if (!user) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
    return HttpResponse.json(messages[params.id as string] ?? []);
  }),

  // CHAT MESSAGE — SSE stream (mock)
  http.post(`${BASE}/api/chat/sessions/:id/messages`, async ({ request, params }) => {
    const user = userFromToken(request);
    if (!user) return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as { content: string };
    const sessionId = params.id as string;

    const userMsg: ChatMessage = {
      id: uid(),
      session_id: sessionId,
      role: 'user',
      content: body.content,
      created_at: new Date().toISOString(),
    };
    (messages[sessionId] ??= []).push(userMsg);

    const answerText =
      `This is a mock AI answer for your question: "${body.content}". ` +
      `When the real backend (ST-7) is wired up, GPT-4 will answer using content ` +
      `retrieved from your uploaded documents and Q&A pairs.`;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const words = answerText.split(' ');
        for (const word of words) {
          await delay(60);
          controller.enqueue(encoder.encode(`data: ${word} \n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));

        const assistantMsg: ChatMessage = {
          id: uid(),
          session_id: sessionId,
          role: 'assistant',
          content: answerText,
          created_at: new Date().toISOString(),
        };
        messages[sessionId].push(assistantMsg);

        controller.close();
      },
    });

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }),
];
