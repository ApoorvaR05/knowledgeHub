/**
 * SearchService — STUB implementation for ST-7.
 *
 * When Dev A merges ST-6 (Hybrid Search Engine), replace the body of `search()`
 * with a call to the real SearchService that runs pgvector + FTS queries.
 *
 * The interface (input/output shape) is intentionally identical to what ST-6 will produce
 * so the ChatController needs zero changes when the swap happens.
 */

export interface SearchResult {
  id: string;
  type: 'chunk' | 'qa';
  content: string;
  score: number;
  source_title?: string;
  document_id?: string;
  question?: string;
}

export class SearchService {
  /**
   * Returns the top-K most relevant results for the given query.
   *
   * STUB: returns a fixed placeholder result so the chat endpoint works end-to-end
   * without a real database or embeddings.
   *
   * TODO (ST-6 integration): replace this with:
   *   1. Embed query via OpenAI text-embedding-ada-002
   *   2. Run pgvector cosine search on document_chunks + qa_pairs
   *   3. Run PostgreSQL FTS on both tables
   *   4. Merge + re-rank by 0.7 * vector_score + 0.3 * fts_score
   *   5. Return top K=5 results
   */
  async search(query: string, _k = 5): Promise<SearchResult[]> {
    console.log(`[SearchService STUB] query="${query}" — returning placeholder context`);
    return [
      {
        id: 'stub-1',
        type: 'chunk',
        content:
          'This is a placeholder context chunk. Once ST-6 (Hybrid Search Engine) is merged, ' +
          'real document chunks and Q&A pairs retrieved via pgvector + full-text search will appear here.',
        score: 1.0,
        source_title: 'Stub Document',
      },
    ];
  }
}
