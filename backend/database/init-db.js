// Database auto-initialization for first-time deployment.
// Runs init.sql + seeds.sql if the database is empty (no tables).
// Safe to run on every boot — idempotent via IF NOT EXISTS checks.
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function initDatabase() {
  try {
    // Check if tables already exist
    const checkResult = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      ) AS table_exists
    `);

    if (checkResult.rows[0].table_exists) {
      console.log('[init-db] Tables already exist, skipping initialization');
      return;
    }

    console.log('[init-db] No tables found — running initialization...');

    // Read and execute init.sql
    const initSql = fs.readFileSync(
      path.join(__dirname, 'init.sql'),
      'utf8'
    );
    await db.query(initSql);
    console.log('[init-db] Schema created (init.sql)');

    // Read and execute seeds.sql
    const seedsSql = fs.readFileSync(
      path.join(__dirname, 'seeds.sql'),
      'utf8'
    );
    await db.query(seedsSql);
    console.log('[init-db] Seed data inserted (seeds.sql)');

    console.log('[init-db] ✅ Database initialization complete');
  } catch (err) {
    console.error('[init-db] ❌ Initialization failed:', err.message);
    // Don't crash — let the server start anyway (manual init possible)
  }
}

module.exports = initDatabase;

// Allow running directly: node database/init-db.js
if (require.main === module) {
  const config = require('../src/config/env');
  initDatabase().then(() => process.exit(0));
}
