const { query } = require('../config/database');
const { isId } = require('./Dataset');

/** Row -> API shape; `dataset` is the populated {_id, name, metadata} when joined. */
function toModel(row) {
  if (!row) return null;
  return {
    _id: row.id, user: row.user_id,
    dataset: row.dataset_name !== undefined ? { _id: row.dataset_id, name: row.dataset_name, metadata: row.dataset_metadata } : row.dataset_id,
    name: row.name, algorithm: row.algorithm, problemType: row.problem_type, targetColumn: row.target_column,
    featureColumns: row.feature_columns || [], metrics: row.metrics, modelPath: row.model_path, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

const WITH_DATASET = `SELECT m.*, d.name AS dataset_name, d.metadata AS dataset_metadata
  FROM ml_models m JOIN datasets d ON d.id = m.dataset_id`;

exports.create = async (m) => {
  const { rows } = await query(
    `INSERT INTO ml_models (user_id, dataset_id, name, algorithm, problem_type, target_column, feature_columns, metrics, model_path, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [m.userId, m.datasetId, m.name, m.algorithm, m.problemType, m.targetColumn || null, m.featureColumns || [], JSON.stringify(m.metrics || {}), m.modelPath, m.status || 'ready'],
  );
  return toModel(rows[0]);
};

exports.listForUser = async (userId) => {
  const { rows } = await query(`${WITH_DATASET} WHERE m.user_id = $1 ORDER BY m.created_at DESC`, [userId]);
  return rows.map(toModel);
};

exports.findForUser = async (id, userId) => {
  if (!isId(id)) return null;
  const { rows } = await query(`${WITH_DATASET} WHERE m.id = $1 AND m.user_id = $2`, [id, userId]);
  return toModel(rows[0]);
};
