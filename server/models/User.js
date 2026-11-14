const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

/** Row -> API shape (keeps the `_id` and camelCase fields the React client already uses). */
function toUser(row) {
  if (!row) return null;
  return { _id: row.id, name: row.name, email: row.email, role: row.role, preferences: row.preferences, createdAt: row.created_at, updatedAt: row.updated_at };
}

exports.findByEmail = async (email) => {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [String(email).trim().toLowerCase()]);
  return rows[0] || null; // raw row, includes the password hash for login
};

exports.findById = async (id) => {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
  return toUser(rows[0]);
};

exports.create = async ({ name, email, password }) => {
  const hash = await bcrypt.hash(String(password), 12);
  const { rows } = await query(
    'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *',
    [String(name).trim(), String(email).trim().toLowerCase(), hash],
  );
  return toUser(rows[0]);
};

exports.update = async (id, { name, preferences }) => {
  const { rows } = await query(
    `UPDATE users SET name = COALESCE($2, name), preferences = COALESCE($3, preferences), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id, name ? String(name).trim() : null, preferences ? JSON.stringify(preferences) : null],
  );
  return toUser(rows[0]);
};

exports.checkPassword = (row, password) => bcrypt.compare(String(password || ''), row.password);
exports.toUser = toUser;
