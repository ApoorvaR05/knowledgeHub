import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  createSession,
  listSessions,
  listMessages,
  sendMessage,
} from '../controllers/ChatController';

export const chatRouter = Router();

// All chat routes require authentication
chatRouter.use(requireAuth);

chatRouter.post('/sessions', createSession);
chatRouter.get('/sessions', listSessions);
chatRouter.get('/sessions/:id/messages', listMessages);
chatRouter.post('/sessions/:id/messages', sendMessage);
