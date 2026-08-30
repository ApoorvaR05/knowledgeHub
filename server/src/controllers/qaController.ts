import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import pool from '../db/pool';
import openai from '../services/openaiClient';

interface QaPair {
  id: number;
  question: string;
  answer: string;
  created_by: number;
  created_at: string;
}

export const create = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }

  const { question, answer } = req.body as { question: string; answer: string };

  const embeddingRes = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: question,
  });
  const vector = embeddingRes.data[0].embedding;
  const embedding = '[' + vector.join(',') + ']';

  const result = await pool.query<QaPair>(
    `INSERT INTO qa_pairs (question, answer, embedding, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, question, answer, created_by, created_at`,
    [question, answer, embedding, req.user!.id],
  );

  res.status(201).json({ qaPair: result.rows[0] });
};

export const list = async (req: Request, res: Response): Promise<void> => {
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.max(1, parseInt((req.query.limit as string) || '20', 10));
  const offset = (page - 1) * limit;

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM qa_pairs`,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const rowsResult = await pool.query<QaPair>(
    `SELECT id, question, answer, created_by, created_at
     FROM qa_pairs
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );

  res.status(200).json({ qaPairs: rowsResult.rows, total, page, limit });
};

export const update = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }

  const { id } = req.params;
  const { question, answer } = req.body as { question: string; answer: string };

  const existing = await pool.query<{ id: number }>(
    `SELECT id FROM qa_pairs WHERE id = $1`,
    [id],
  );
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'QA pair not found' });
    return;
  }

  const embeddingRes = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: question,
  });
  const vector = embeddingRes.data[0].embedding;
  const embedding = '[' + vector.join(',') + ']';

  const result = await pool.query<QaPair>(
    `UPDATE qa_pairs SET question = $1, answer = $2, embedding = $3 WHERE id = $4
     RETURNING id, question, answer, created_by, created_at`,
    [question, answer, embedding, id],
  );

  res.status(200).json({ qaPair: result.rows[0] });
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  const result = await pool.query<{ id: number }>(
    `DELETE FROM qa_pairs WHERE id = $1 RETURNING id`,
    [req.params.id],
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'QA pair not found' });
    return;
  }

  res.status(204).send();
};
