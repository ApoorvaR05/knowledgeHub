exports.up = (pgm) => {
  pgm.createTable('chat_sessions', {
    id: { type: 'serial', primaryKey: true },
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"(id)',
      onDelete: 'CASCADE',
    },
    title: { type: 'varchar(500)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
};
exports.down = (pgm) => {
  pgm.dropTable('chat_sessions');
};
