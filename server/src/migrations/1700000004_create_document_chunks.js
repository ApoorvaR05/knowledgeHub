exports.up = (pgm) => {
  pgm.createTable('document_chunks', {
    id: { type: 'serial', primaryKey: true },
    document_id: {
      type: 'integer',
      notNull: true,
      references: '"documents"(id)',
      onDelete: 'CASCADE',
    },
    chunk_index: { type: 'integer', notNull: true },
    content: { type: 'text', notNull: true },
    embedding: { type: 'vector(1536)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.sql(
    'CREATE INDEX document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops)'
  );
  pgm.sql(
    "CREATE INDEX document_chunks_content_fts_idx ON document_chunks USING GIN (to_tsvector('english', content))"
  );
};
exports.down = (pgm) => {
  pgm.dropTable('document_chunks');
};
