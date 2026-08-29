import express from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chat';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Routes
  app.use('/api/chat', chatRouter);

  // 404
  app.use((_req, res) => res.status(404).json({ message: 'Not found' }));

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
