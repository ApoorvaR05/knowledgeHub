import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pool from './db/pool';
import authRouter from './routes/auth';
import documentRouter from './routes/documents';
import qaRouter from './routes/qa';
import searchRouter from './routes/search';
import chatRouter from './routes/chat';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/documents', documentRouter);
app.use('/api/qa', qaRouter);
app.use('/api/search', searchRouter);
app.use('/api/chat', chatRouter);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);

    // Verify DB connectivity on startup (non-fatal)
    pool.query('SELECT 1').catch((err: Error) => {
      console.error('Database connection failed:', err.message);
    });
  });
}

export default app;
