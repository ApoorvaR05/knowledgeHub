exports.up = (pgm) => {
  pgm.createTable('users', {
    id: { type: 'serial', primaryKey: true },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    role: {
      type: 'varchar(20)',
      notNull: true,
      default: 'user',
      check: "role IN ('admin', 'user')",
    },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
};
exports.down = (pgm) => {
  pgm.dropTable('users');
};
