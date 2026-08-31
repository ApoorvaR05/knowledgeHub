import pool from '../db/pool';
import OpenAI from 'openai';
import { config } from '../config';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export interface SearchResult {
  id: string;
  type: 'chunk' | 'qa';
  content: string;
  score: number;
  source_title?: string;
  document_id?: string;
  question?: string;
}

interface MergeEntry {
  id: string;
  type: 'chunk' | 'qa';
  content: string;
  source_title?: string;
  document_id?: string;
  question?: string;
  vector_score: number;
  fts_score: number;
}

interface ChunkVectorRow {
  id: string;
  content: string;
  document_id: string;
  source: string;
  vector_score: number;
}

interface QaVectorRow {
  id: string;
  question: string;
  content: string;
  vector_score: number;
}

interface FtsRow {
  id: string;
  fts_score: number;
}

export class SearchService {
  async search(query: string, topK = 5): Promise<SearchResult[]> {
    // 1. Embed the query
    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: query,
    });
    const queryVector = embeddingRes.data[0].embedding;
    const pgVector = '[' + queryVector.join(',') + ']';

    // 2-5. Run all 4 DB queries in parallel
    const [chunkVec, qaVec, chunkFts, qaFts] = await Promise.all([
      pool.query<ChunkVectorRow>(
        `SELECT
           dc.id::text,
           dc.content,
           dc.document_id::text,
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
           id::text,
           question,
           answer AS content,
           1 - (embedding <=> $1::vector) AS vector_score
         FROM qa_pairs
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT 5`,
        [pgVector],
      ),
      pool.query<FtsRow>(
        `SELECT
           id::text,
           ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', $1), 32) AS fts_score
         FROM document_chunks
         WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
         LIMIT 10`,
        [query],
      ),
      pool.query<FtsRow>(
        `SELECT
           id::text,
           ts_rank_cd(to_tsvector('english', question), plainto_tsquery('english', $1), 32) AS fts_score
         FROM qa_pairs
         WHERE to_tsvector('english', question) @@ plainto_tsquery('english', $1)
         LIMIT 10`,
        [query],
      ),
    ]);

    // 6. Merge and re-rank
    const map = new Map<string, MergeEntry>();

    for (const row of chunkVec.rows) {
      map.set(`chunk:${row.id}`, {
        id: row.id,
        type: 'chunk',
        content: row.content,
        source_title: row.source,
        document_id: row.document_id,
        vector_score: Number(row.vector_score),
        fts_score: 0,
      });
    }

    for (const row of qaVec.rows) {
      map.set(`qa:${row.id}`, {
        id: row.id,
        type: 'qa',
        content: row.content,
        question: row.question,
        vector_score: Number(row.vector_score),
        fts_score: 0,
      });
    }

    for (const row of chunkFts.rows) {
      const key = `chunk:${row.id}`;
      const existing = map.get(key);
      if (existing) {
        existing.fts_score = Number(row.fts_score);
      }
    }

    for (const row of qaFts.rows) {
      const key = `qa:${row.id}`;
      const existing = map.get(key);
      if (existing) {
        existing.fts_score = Number(row.fts_score);
      }
    }

    return Array.from(map.values())
      .map((entry): SearchResult => ({
        id: entry.id,
        type: entry.type,
        content: entry.content,
        score: 0.7 * entry.vector_score + 0.3 * entry.fts_score,
        source_title: entry.source_title,
        document_id: entry.document_id,
        question: entry.question,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
