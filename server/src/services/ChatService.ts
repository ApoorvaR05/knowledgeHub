import { query } from '../db/pool';

export interface ChatSession {
  id: string;
  user_id: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export class ChatService {
  /** Create a new chat session for the given user */
  async createSession(userId: string): Promise<ChatSession> {
    const result = await query<ChatSession>(
      `INSERT INTO chat_sessions (user_id) VALUES ($1) RETURNING *`,
      [userId],
    );
    return result.rows[0];
  }

  /** List all sessions belonging to a user, newest first */
  async listSessions(userId: string): Promise<ChatSession[]> {
    const result = await query<ChatSession>(
      `SELECT * FROM chat_sessions WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  /** Verify a session belongs to a user */
  async getSession(sessionId: string, userId: string): Promise<ChatSession | null> {
    const result = await query<ChatSession>(
      `SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );
    return result.rows[0] ?? null;
  }

  /** Persist a single message to the DB */
  async saveMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<ChatMessage> {
    const result = await query<ChatMessage>(
      `INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3) RETURNING *`,
      [sessionId, role, content],
    );
    return result.rows[0];
  }

  /** Fetch recent messages for a session (most recent N, returned in chronological order) */
  async listMessages(sessionId: string, limit = 50): Promise<ChatMessage[]> {
    const result = await query<ChatMessage>(
      `SELECT * FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [sessionId, limit],
    );
    return result.rows.reverse(); // return chronological order
  }

  /** Fetch the last N messages for use as conversation history in the OpenAI request */
  async getRecentHistory(sessionId: string, n = 6): Promise<ChatMessage[]> {
    const result = await query<ChatMessage>(
      `SELECT * FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [sessionId, n],
    );
    return result.rows.reverse();
  }
}
