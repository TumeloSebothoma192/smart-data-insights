const { query } = require('../config/database');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (id) => UUID.test(String(id || ''));

/** Row -> API shape. The file bytes are never sent to the client. */
function toDataset(row, { withAnalysis = true } = {}) {
  if (!row) return null;
  const out = {
    _id: row.id, user: row.user_id, name: row.name, originalName: row.original_name, fileType: row.file_type,
    fileSize: row.file_size, status: row.status, metadata: row.metadata || undefined,
    insights: row.insights, tags: row.tags || [], createdAt: row.created_at, updatedAt: row.updated_at,
  };
  if (withAnalysis) out.analysis = row.analysis;
  return out;
}

exports.isId = isId;

exports.create = async ({ userId, name, originalName, fileType, fileData, fileSize, tags }) => {
  const { rows } = await query(
    `INSERT INTO datasets (user_id, name, original_name, file_type, file_data, file_size, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, name, original_name, file_type, file_size, status, metadata, analysis, insights, tags, created_at, updated_at`,
    [userId, name, originalName, fileType, fileData, fileSize, tags || []],
  );
  return toDataset(rows[0]);
};

exports.listForUser = async (userId) => {
  const { rows } = await query(
    `SELECT id, user_id, name, original_name, file_type, file_size, status, metadata, insights, tags, created_at, updated_at
     FROM datasets WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map((r) => toDataset(r, { withAnalysis: false }));
};

/** One of the user's datasets (API shape), or null. */
exports.findForUser = async (id, userId) => {
  if (!isId(id)) return null;
  const { rows } = await query(
    `SELECT id, user_id, name, original_name, file_type, file_size, status, metadata, analysis, insights, tags, created_at, updated_at
     FROM datasets WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return toDataset(rows[0]);
};

/** The raw uploaded file, for sending to the Python service. */
exports.fileForUser = async (id, userId) => {
  if (!isId(id)) return null;
  const { rows } = await query('SELECT file_data, original_name, file_type, name FROM datasets WHERE id = $1 AND user_id = $2', [id, userId]);
  return rows[0] || null;
};

exports.setStatus = async (id, userId, status) => {
  if (!isId(id)) return;
  await query('UPDATE datasets SET status = $3, updated_at = now() WHERE id = $1 AND user_id = $2', [id, userId, status]);
};

exports.saveAnalysis = async (id, userId, analysis, metadata) => {
  await query(
    `UPDATE datasets SET status = 'processed', analysis = $3, metadata = $4, updated_at = now() WHERE id = $1 AND user_id = $2`,
    [id, userId, JSON.stringify(analysis), JSON.stringify(metadata)],
  );
};

exports.saveInsights = async (id, userId, insights) => {
  await query('UPDATE datasets SET insights = $3, updated_at = now() WHERE id = $1 AND user_id = $2', [id, userId, JSON.stringify(insights)]);
};

exports.remove = async (id, userId) => {
  if (!isId(id)) return false;
  const { rowCount } = await query('DELETE FROM datasets WHERE id = $1 AND user_id = $2', [id, userId]);
  return rowCount > 0;
};
