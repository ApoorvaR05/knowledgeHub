import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { chatApi } from '../api/client';
import type { ChatSession, ChatMessage } from '../types';

interface StreamingMessage {
  role: 'assistant';
  content: string;
  streaming: boolean;
}

type DisplayMessage = ChatMessage | StreamingMessage;

export function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load sessions on mount
  useEffect(() => {
    chatApi.listSessions().then(res => {
      setSessions(res.data);
      if (res.data.length > 0) selectSession(res.data[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function selectSession(session: ChatSession) {
    setActiveSession(session);
    const res = await chatApi.listMessages(session.id);
    setMessages(res.data);
  }

  async function createSession() {
    const res = await chatApi.createSession();
    const session: ChatSession = res.data;
    setSessions(prev => [session, ...prev]);
    setActiveSession(session);
    setMessages([]);
  }

  async function sendMessage() {
    if (!input.trim() || sending || !activeSession) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    // Optimistically add user bubble
    setMessages(prev => [
      ...prev,
      { id: `tmp-${Date.now()}`, session_id: activeSession.id, role: 'user', content: text, created_at: new Date().toISOString() },
    ]);

    // Add a streaming assistant bubble
    const streamingMsg: StreamingMessage = { role: 'assistant', content: '', streaming: true };
    setMessages(prev => [...prev, streamingMsg]);

    try {
      const response = await chatApi.sendMessage(activeSession.id, text);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE lines: "data: <token>"
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const token = line.slice(6);
            if (token === '[DONE]') break;
            accumulated += token;
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1] as StreamingMessage;
              if (last?.streaming) updated[updated.length - 1] = { ...last, content: accumulated };
              return updated;
            });
          }
        }
      }

      // Finalise — remove streaming flag
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1] as StreamingMessage;
        if (last?.streaming) {
          updated[updated.length - 1] = {
            id: `asst-${Date.now()}`,
            session_id: activeSession.id,
            role: 'assistant',
            content: accumulated,
            created_at: new Date().toISOString(),
          } as ChatMessage;
        }
        return updated;
      });
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          id: `err-${Date.now()}`,
          session_id: activeSession.id,
          role: 'assistant',
          content: '⚠️ Failed to get a response. Please try again.',
          created_at: new Date().toISOString(),
        } as ChatMessage;
        return updated;
      });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={createSession}>
            + New Chat
          </button>
        </div>
        <div className="chat-session-list">
          {sessions.length === 0 && (
            <p className="text-muted text-sm" style={{ padding: '12px' }}>
              No sessions yet
            </p>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              className={`chat-session-item${activeSession?.id === s.id ? ' active' : ''}`}
              onClick={() => selectSession(s)}
            >
              Chat {new Date(s.created_at).toLocaleDateString()}
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className="chat-main">
        {!activeSession ? (
          <div className="chat-empty">
            <span>Create a new chat to get started</span>
          </div>
        ) : (
          <>
            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="chat-empty">Ask me anything about your knowledge base</div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={'id' in msg ? msg.id : `stream-${i}`}
                  className={`message-bubble ${msg.role}${'streaming' in msg && msg.streaming ? ' streaming' : ''}`}
                >
                  {msg.content}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="chat-input-area">
              <textarea
                className="chat-input"
                placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
                rows={1}
              />
              <button
                className="btn btn-primary"
                onClick={sendMessage}
                disabled={sending || !input.trim()}
              >
                {sending ? '…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
