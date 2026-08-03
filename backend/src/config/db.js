// P2.1 — PostgreSQL connection pool (raw pg driver, no ORM)
// All SQL executed in later phases MUST use parameterized queries ($1, $2, ...).
const { Pool } = require('pg');
const config = require('./env');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('CRITICAL: Unexpected error on idle PostgreSQL client:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
