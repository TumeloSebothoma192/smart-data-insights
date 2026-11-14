const { Pool } = require('pg');

/**
 * PostgreSQL (e.g. Neon) connection. DATABASE_URL is the full connection string;
 * hosted databases need SSL, local ones usually don't (set PGSSL=disable).
 */
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/smartinsights';
const useSSL = process.env.PGSSL !== 'disable' && !/localhost|127\.0\.0\.1/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 5,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  preferences JSONB NOT NULL DEFAULT '{"theme":"dark","defaultChart":"bar"}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS datasets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type     TEXT NOT NULL CHECK (file_type IN ('csv','excel','json')),
  file_data     BYTEA NOT NULL,
  file_size     INTEGER,
  status        TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','processing','processed','error')),
  metadata      JSONB,
  analysis      JSONB,
  insights      JSONB,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS datasets_user_idx ON datasets(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS ml_models (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dataset_id      UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  name            TEXT,
  algorithm       TEXT,
  problem_type    TEXT CHECK (problem_type IN ('classification','regression','clustering')),
  target_column   TEXT,
  feature_columns TEXT[] NOT NULL DEFAULT '{}',
  metrics         JSONB,
  model_path      TEXT,
  status          TEXT NOT NULL DEFAULT 'training' CHECK (status IN ('training','ready','error')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ml_models_user_idx ON ml_models(user_id, created_at DESC);
`;

/** Connect and create the tables if they don't exist yet. Exits if the database is unreachable. */
async function connectDB() {
  try {
    await pool.query(SCHEMA);
    console.log('PostgreSQL connected, schema ready');
  } catch (error) {
    console.error('PostgreSQL connection failed:', error.message);
    process.exit(1);
  }
}

module.exports = { pool, connectDB, query: (text, params) => pool.query(text, params) };
