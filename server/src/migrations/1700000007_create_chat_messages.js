exports.up = (pgm) => {
  pgm.createTable('chat_messages', {
    id: { type: 'serial', primaryKey: true },
    session_id: {
      type: 'integer',
      notNull: true,
      references: '"chat_sessions"(id)',
      onDelete: 'CASCADE',
    },
    role: {
      type: 'varchar(20)',
      notNull: true,
      check: "role IN ('user', 'assistant')",
    },
    content: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.sql(
    'CREATE INDEX chat_messages_session_id_idx ON chat_messages (session_id)'
  );
};
exports.down = (pgm) => {
  pgm.dropTable('chat_messages');
};
