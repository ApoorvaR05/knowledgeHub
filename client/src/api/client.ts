import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request if present
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to /login on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (email: string, password: string, role?: string) =>
    api.post('/api/auth/register', { email, password, role }),

  login: (email: string, password: string) =>
    api.post<{ token: string }>('/api/auth/login', { email, password }),

  me: () => api.get('/api/auth/me'),
};

// ─── Documents ────────────────────────────────────────────────────────────────

export const documentsApi = {
  list: () => api.get('/api/documents'),

  upload: (file: File, title: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title);
    return api.post('/api/documents', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  remove: (id: string) => api.delete(`/api/documents/${id}`),
};

// ─── Q&A Pairs ────────────────────────────────────────────────────────────────

export const qaApi = {
  list: (page = 1, limit = 20) =>
    api.get('/api/qa', { params: { page, limit } }),

  create: (question: string, answer: string) =>
    api.post('/api/qa', { question, answer }),

  update: (id: string, question: string, answer: string) =>
    api.put(`/api/qa/${id}`, { question, answer }),

  remove: (id: string) => api.delete(`/api/qa/${id}`),
};

// ─── Search ───────────────────────────────────────────────────────────────────

export const searchApi = {
  search: (query: string) => api.post('/api/search', { query }),
};

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const chatApi = {
  listSessions: () => api.get('/api/chat/sessions'),

  createSession: () => api.post('/api/chat/sessions'),

  listMessages: (sessionId: string) =>
    api.get(`/api/chat/sessions/${sessionId}/messages`),

  /** Returns the raw fetch Response so the caller can read the SSE stream */
  sendMessage: (sessionId: string, content: string): Promise<Response> => {
    const token = localStorage.getItem('token');
    return fetch(`${BASE_URL}/api/chat/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
    });
  },
};
