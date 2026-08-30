exports.up = (pgm) => {
  pgm.createTable('qa_pairs', {
    id: { type: 'serial', primaryKey: true },
    question: { type: 'text', notNull: true },
    answer: { type: 'text', notNull: true },
    embedding: { type: 'vector(1536)' },
    created_by: {
      type: 'integer',
      notNull: true,
      references: '"users"(id)',
      onDelete: 'CASCADE',
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.sql(
    'CREATE INDEX qa_pairs_embedding_idx ON qa_pairs USING hnsw (embedding vector_cosine_ops)'
  );
  pgm.sql(
    "CREATE INDEX qa_pairs_question_fts_idx ON qa_pairs USING GIN (to_tsvector('english', question))"
  );
};
exports.down = (pgm) => {
  pgm.dropTable('qa_pairs');
};
