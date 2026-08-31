import fs from 'fs';
import { Request, Response } from 'express';
import pool from '../db/pool';
import { processDocument } from '../services/documentProcessor';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

export const upload = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(422).json({ error: 'No file uploaded' });
    return;
  }

  if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) {
    res.status(422).json({ error: 'Unsupported file type' });
    return;
  }

  const title = (req.body as { title?: string }).title || req.file.originalname;

  const result = await pool.query(
    `INSERT INTO documents (title, file_name, file_type, uploaded_by, status)
     VALUES ($1, $2, $3, $4, 'processing')
     RETURNING id, title, file_name, file_type, uploaded_by, status, created_at`,
    [title, req.file.originalname, req.file.mimetype, req.user!.id],
  );

  const doc = result.rows[0] as {
    id: number;
    title: string;
    file_name: string;
    file_type: string;
    uploaded_by: number;
    status: string;
    created_at: string;
  };

  res.status(201).json({ document: doc });

  // Process asynchronously after responding
  processDocument(doc.id, req.file.path, req.file.mimetype)
    .catch((err: unknown) => console.error('Processing error:', err))
    .finally(() => {
      try {
        fs.unlinkSync(req.file!.path);
      } catch {
        // ignore cleanup errors
      }
    });
};

export const list = async (_req: Request, res: Response): Promise<void> => {
  const result = await pool.query(
    `SELECT id, title, file_name, file_type, uploaded_by, status, created_at
     FROM documents
     ORDER BY created_at DESC`,
  );
  res.status(200).json({ documents: result.rows });
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  const result = await pool.query(
    `DELETE FROM documents WHERE id = $1 RETURNING id`,
    [req.params.id],
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  res.status(204).send();
};
