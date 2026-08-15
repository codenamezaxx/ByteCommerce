// P2.1 — PostgreSQL connection pool (raw pg driver, no ORM)
// All SQL executed in later phases MUST use parameterized queries ($1, $2, ...).
const { Pool } = require('pg');
const config = require('./env');

// Render PostgreSQL requires SSL — enable it when the URL targets a Render host
const needsSSL = config.databaseUrl && config.databaseUrl.includes('render.com');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ...(needsSSL && {
    ssl: { rejectUnauthorized: false },
  }),
});

pool.on('error', (err) => {
  console.error('CRITICAL: Unexpected error on idle PostgreSQL client:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
