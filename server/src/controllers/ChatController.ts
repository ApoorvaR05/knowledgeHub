import { Request, Response } from 'express';
import OpenAI from 'openai';
import { ChatService } from '../services/ChatService';
import { SearchService } from '../services/SearchService';
import { config } from '../config';

const chatService = new ChatService();
const searchService = new SearchService();
const openai = new OpenAI({ apiKey: config.openaiApiKey });

// ─── Session handlers ─────────────────────────────────────────────────────────

/** POST /api/chat/sessions */
export async function createSession(req: Request, res: Response): Promise<void> {
  try {
    const session = await chatService.createSession(req.user!.id);
    res.status(201).json(session);
  } catch (err) {
    console.error('[createSession]', err);
    res.status(500).json({ message: 'Failed to create session' });
  }
}

/** GET /api/chat/sessions */
export async function listSessions(req: Request, res: Response): Promise<void> {
  try {
    const sessions = await chatService.listSessions(req.user!.id);
    res.json(sessions);
  } catch (err) {
    console.error('[listSessions]', err);
    res.status(500).json({ message: 'Failed to list sessions' });
  }
}

/** GET /api/chat/sessions/:id/messages */
export async function listMessages(req: Request, res: Response): Promise<void> {
  try {
    const session = await chatService.getSession(req.params.id, req.user!.id);
    if (!session) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }
    const messages = await chatService.listMessages(req.params.id);
    res.json(messages);
  } catch (err) {
    console.error('[listMessages]', err);
    res.status(500).json({ message: 'Failed to list messages' });
  }
}

// ─── Message / streaming handler ─────────────────────────────────────────────

/** POST /api/chat/sessions/:id/messages
 *
 * Flow:
 *  1. Validate session ownership
 *  2. Persist user message
 *  3. Retrieve context via SearchService
 *  4. Build system prompt with retrieved context
 *  5. Stream GPT-4 response via SSE
 *  6. Persist accumulated assistant message on stream end
 */
export async function sendMessage(req: Request, res: Response): Promise<void> {
  const { content } = req.body as { content?: string };

  if (!content?.trim()) {
    res.status(400).json({ message: 'content is required' });
    return;
  }

  const session = await chatService.getSession(req.params.id, req.user!.id);
  if (!session) {
    res.status(404).json({ message: 'Session not found' });
    return;
  }

  // 1. Persist user message
  await chatService.saveMessage(session.id, 'user', content.trim());

  // 2. Retrieve relevant context
  const contextResults = await searchService.search(content.trim());
  const contextBlock = contextResults
    .map((r, i) => {
      const label = r.type === 'qa' ? `Q&A pair` : `Document chunk`;
      const source = r.source_title ? ` (source: ${r.source_title})` : '';
      return `[${i + 1}] ${label}${source}:\n${r.content}`;
    })
    .join('\n\n');

  // 3. Fetch recent conversation history (last 6 messages)
  const history = await chatService.getRecentHistory(session.id, 6);

  // 4. Build messages array for OpenAI
  const systemPrompt = `You are a helpful knowledge assistant for an organisation.
Answer the user's question using ONLY the context provided below.
If the context does not contain enough information to answer, respond with:
"I don't have enough information in the knowledge base to answer that question."

Do not make up facts. Do not use knowledge outside of the provided context.

--- CONTEXT START ---
${contextBlock || 'No relevant context found.'}
--- CONTEXT END ---`;

  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: content.trim() },
  ];

  // 5. Open SSE stream
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let accumulated = '';

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: openaiMessages,
      stream: true,
      temperature: 0.2,
      max_tokens: 1024,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content ?? '';
      if (token) {
        accumulated += token;
        res.write(`data: ${token}\n\n`);
      }
    }

    // Signal end of stream
    res.write('data: [DONE]\n\n');
    res.end();

    // 6. Persist full assistant message
    await chatService.saveMessage(session.id, 'assistant', accumulated);
  } catch (err) {
    console.error('[sendMessage] OpenAI error', err);
    // Try to send error over SSE if headers already sent
    if (!res.headersSent) {
      res.status(500).json({ message: 'AI service error' });
    } else {
      res.write(`data: [ERROR] Failed to generate response\n\n`);
      res.end();
    }
    // Still persist whatever was accumulated
    if (accumulated) {
      await chatService.saveMessage(session.id, 'assistant', accumulated).catch(() => {});
    }
  }
}
