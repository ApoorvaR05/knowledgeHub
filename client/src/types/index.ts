// Shared TypeScript types matching the server's API contract

export type Role = 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  role: Role;
}

export interface AuthTokenPayload {
  id: string;
  email: string;
  role: Role;
}

// ─── Documents ───────────────────────────────────────────────────────────────

export type DocumentStatus = 'processing' | 'ready' | 'failed';

export interface Document {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  uploaded_by: string;
  status: DocumentStatus;
  created_at: string;
}

// ─── Q&A Pairs ───────────────────────────────────────────────────────────────

export interface QAPair {
  id: string;
  question: string;
  answer: string;
  created_by: string;
  created_at: string;
}

// ─── Search ──────────────────────────────────────────────────────────────────

export type SearchResultType = 'chunk' | 'qa';

export interface SearchResult {
  id: string;
  type: SearchResultType;
  content: string;
  score: number;
  source_title?: string;
  document_id?: string;
  question?: string;
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant';

export interface ChatSession {
  id: string;
  user_id: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

// ─── API response wrappers ────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}
