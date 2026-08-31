import fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;
import mammoth from 'mammoth';
import pool from '../db/pool';
import openai from './openaiClient';

export async function extractText(filePath: string, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text;
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  if (mimeType === 'text/plain') {
    return fs.readFileSync(filePath, 'utf-8');
  }
  throw new Error('Unsupported file type: ' + mimeType);
}

export function chunkText(text: string, chunkSize = 512, overlap = 64): string[] {
  const words = text.split(/\s+/);
  const step = chunkSize - overlap;
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += step) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
    if (i + chunkSize >= words.length) break;
  }
  return chunks;
}

export async function embedChunks(chunks: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let i = 0; i < chunks.length; i += 100) {
    const batch = chunks.slice(i, i + 100);
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: batch,
    });
    for (const item of response.data) {
      embeddings.push(item.embedding);
    }
  }
  return embeddings;
}

export async function processDocument(
  documentId: number,
  filePath: string,
  mimeType: string,
): Promise<void> {
  try {
    const text = await extractText(filePath, mimeType);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error('No text content extracted from document');
    }

    const embeddings = await embedChunks(chunks);

    // Build a single multi-row INSERT
    const values: (string | number)[] = [];
    const placeholders: string[] = [];
    let paramIdx = 1;

    for (let i = 0; i < chunks.length; i++) {
      const embeddingStr = '[' + embeddings[i].join(',') + ']';
      placeholders.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3})`);
      values.push(documentId, i, chunks[i], embeddingStr);
      paramIdx += 4;
    }

    await pool.query(
      `INSERT INTO document_chunks (document_id, chunk_index, content, embedding) VALUES ${placeholders.join(', ')}`,
      values,
    );

    await pool.query(`UPDATE documents SET status = 'ready' WHERE id = $1`, [documentId]);
  } catch (err) {
    await pool.query(`UPDATE documents SET status = 'failed' WHERE id = $1`, [documentId]);
    throw err;
  }
}
