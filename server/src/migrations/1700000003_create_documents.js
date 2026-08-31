exports.up = (pgm) => {
  pgm.createTable('documents', {
    id: { type: 'serial', primaryKey: true },
    title: { type: 'varchar(500)', notNull: true },
    file_name: { type: 'varchar(500)', notNull: true },
    file_type: { type: 'varchar(100)', notNull: true },
    uploaded_by: {
      type: 'integer',
      notNull: true,
      references: '"users"(id)',
      onDelete: 'CASCADE',
    },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'processing',
      check: "status IN ('processing', 'ready', 'failed')",
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
};
exports.down = (pgm) => {
  pgm.dropTable('documents');
};
