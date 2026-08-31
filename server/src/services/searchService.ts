import pool from '../db/pool';
import openai from './openaiClient';

export interface SearchResult {
  id: number;
  type: 'chunk' | 'qa';
  content: string;
  source: string;
  score: number;
  documentId?: number;
  question?: string;
}

interface MergeEntry {
  id: number;
  type: 'chunk' | 'qa';
  content: string;
  source: string;
  vector_score: number;
  fts_score: number;
  documentId?: number;
  question?: string;
}

interface ChunkVectorRow {
  id: number;
  content: string;
  document_id: number;
  source: string;
  vector_score: number;
}

interface QaVectorRow {
  id: number;
  question: string;
  content: string;
  source: string;
  vector_score: number;
}

interface FtsRow {
  id: number;
  fts_score: number;
}

export async function search(query: string, topK = 5): Promise<SearchResult[]> {
  // Step 1 — embed the query
  const embeddingRes = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: query,
  });
  const queryVector = embeddingRes.data[0].embedding;
  const pgVector = '[' + queryVector.join(',') + ']';

  // Steps 2-5 — run all 4 DB queries in parallel
  const [chunkVec, qaVec, chunkFts, qaFts] = await Promise.all([
    pool.query<ChunkVectorRow>(
      `SELECT
         dc.id,
         dc.content,
         dc.document_id,
         d.title AS source,
         1 - (dc.embedding <=> $1::vector) AS vector_score
       FROM document_chunks dc
       JOIN documents d ON d.id = dc.document_id
       WHERE dc.embedding IS NOT NULL
       ORDER BY dc.embedding <=> $1::vector
       LIMIT 10`,
      [pgVector],
    ),
    pool.query<QaVectorRow>(
      `SELECT
         id,
         question,
         answer AS content,
         'Q&A' AS source,
         1 - (embedding <=> $1::vector) AS vector_score
       FROM qa_pairs
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT 5`,
      [pgVector],
    ),
    pool.query<FtsRow>(
      `SELECT
         dc.id,
         ts_rank_cd(to_tsvector('english', dc.content), plainto_tsquery('english', $1), 32) AS fts_score
       FROM document_chunks dc
       WHERE to_tsvector('english', dc.content) @@ plainto_tsquery('english', $1)
       LIMIT 10`,
      [query],
    ),
    pool.query<FtsRow>(
      `SELECT
         id,
         ts_rank_cd(to_tsvector('english', question), plainto_tsquery('english', $1), 32) AS fts_score
       FROM qa_pairs
       WHERE to_tsvector('english', question) @@ plainto_tsquery('english', $1)
       LIMIT 10`,
      [query],
    ),
  ]);

  // Step 6 — merge and re-rank
  const map = new Map<string, MergeEntry>();

  for (const row of chunkVec.rows) {
    map.set(`chunk:${row.id}`, {
      id: row.id,
      type: 'chunk',
      content: row.content,
      source: row.source,
      vector_score: Number(row.vector_score),
      fts_score: 0,
      documentId: row.document_id,
    });
  }

  for (const row of qaVec.rows) {
    map.set(`qa:${row.id}`, {
      id: row.id,
      type: 'qa',
      content: row.content,
      source: row.source,
      vector_score: Number(row.vector_score),
      fts_score: 0,
      question: row.question,
    });
  }

  for (const row of chunkFts.rows) {
    const key = `chunk:${row.id}`;
    const existing = map.get(key);
    if (existing) {
      existing.fts_score = Number(row.fts_score);
    } else {
      map.set(key, {
        id: row.id,
        type: 'chunk',
        content: '',
        source: '',
        vector_score: 0,
        fts_score: Number(row.fts_score),
      });
    }
  }

  for (const row of qaFts.rows) {
    const key = `qa:${row.id}`;
    const existing = map.get(key);
    if (existing) {
      existing.fts_score = Number(row.fts_score);
    } else {
      map.set(key, {
        id: row.id,
        type: 'qa',
        content: '',
        source: 'Q&A',
        vector_score: 0,
        fts_score: Number(row.fts_score),
      });
    }
  }

  const results: SearchResult[] = Array.from(map.values())
    .map((entry): SearchResult => {
      const score = 0.7 * entry.vector_score + 0.3 * entry.fts_score;
      const result: SearchResult = {
        id: entry.id,
        type: entry.type,
        content: entry.content,
        source: entry.source,
        score,
      };
      if (entry.documentId !== undefined) result.documentId = entry.documentId;
      if (entry.question !== undefined) result.question = entry.question;
      return result;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return results;
}
