// P2.4 — HTTP server entry point (listen + graceful shutdown).
const app = require('./src/app');
const config = require('./src/config/env');
const db = require('./src/config/db');
const redis = require('./src/config/redis');

const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log(`ByteCommerce API listening on port ${PORT}`);
});

let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[server] ${signal} received, shutting down gracefully...`);

  // Timeout fallback: paksa exit bila shutdown macet.
  const forceExitTimer = setTimeout(() => {
    console.error('[server] Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 5000);
  forceExitTimer.unref();

  try {
    await new Promise((resolve) => server.close(resolve));
    console.log('[server] HTTP server closed');
  } catch (err) {
    console.error('[server] Error closing HTTP server:', err);
  }

  try {
    await db.pool.end();
    console.log('[server] PostgreSQL pool closed');
  } catch (err) {
    console.error('[server] Error closing PostgreSQL pool:', err);
  }

  try {
    await Promise.race([
      Promise.resolve(redis.quit()),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
    console.log('[server] Redis client quit');
  } catch (err) {
    redis.disconnect();
    console.error('[server] Error quitting Redis:', err);
  }

  clearTimeout(forceExitTimer);
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
