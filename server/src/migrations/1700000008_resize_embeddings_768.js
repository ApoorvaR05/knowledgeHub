// Resize embedding columns from vector(1536) [OpenAI ada-002]
// to vector(768) [Ollama nomic-embed-text].
// Existing embeddings (if any) must be dropped first because
// PostgreSQL cannot cast between vector sizes directly.
exports.up = (pgm) => {
  // document_chunks
  pgm.sql('DROP INDEX IF EXISTS document_chunks_embedding_idx');
  pgm.sql('ALTER TABLE document_chunks DROP COLUMN embedding');
  pgm.sql('ALTER TABLE document_chunks ADD COLUMN embedding vector(768)');
  pgm.sql(
    'CREATE INDEX document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops)'
  );

  // qa_pairs
  pgm.sql('DROP INDEX IF EXISTS qa_pairs_embedding_idx');
  pgm.sql('ALTER TABLE qa_pairs DROP COLUMN embedding');
  pgm.sql('ALTER TABLE qa_pairs ADD COLUMN embedding vector(768)');
  pgm.sql(
    'CREATE INDEX qa_pairs_embedding_idx ON qa_pairs USING hnsw (embedding vector_cosine_ops)'
  );
};

exports.down = (pgm) => {
  // document_chunks — revert to 1536
  pgm.sql('DROP INDEX IF EXISTS document_chunks_embedding_idx');
  pgm.sql('ALTER TABLE document_chunks DROP COLUMN embedding');
  pgm.sql('ALTER TABLE document_chunks ADD COLUMN embedding vector(1536)');
  pgm.sql(
    'CREATE INDEX document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops)'
  );

  // qa_pairs — revert to 1536
  pgm.sql('DROP INDEX IF EXISTS qa_pairs_embedding_idx');
  pgm.sql('ALTER TABLE qa_pairs DROP COLUMN embedding');
  pgm.sql('ALTER TABLE qa_pairs ADD COLUMN embedding vector(1536)');
  pgm.sql(
    'CREATE INDEX qa_pairs_embedding_idx ON qa_pairs USING hnsw (embedding vector_cosine_ops)'
  );
};
