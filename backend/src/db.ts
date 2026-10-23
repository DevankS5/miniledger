import { Pool, types } from 'pg';

// Keep DATE columns as 'YYYY-MM-DD' strings and NUMERIC as numbers.
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => Number(v));

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/miniledger',
});

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      phone      TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    INT NOT NULL REFERENCES users(id),
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS loans (
      id           SERIAL PRIMARY KEY,
      user_id      INT NOT NULL REFERENCES users(id),
      friend_name  TEXT NOT NULL,
      amount       NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      due_date     DATE NOT NULL,
      repaid_at    TIMESTAMPTZ,
      receipt      BYTEA,
      receipt_mime TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS loans_user_idx ON loans (user_id, due_date);
  `);
}
