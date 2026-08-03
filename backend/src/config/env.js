// P2.1 — Centralized environment configuration & validation
// Loads backend/.env via dotenv and validates all required variables.
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const REQUIRED_ENV_VARS = ['PORT', 'DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'];

const missingVars = REQUIRED_ENV_VARS.filter(
  (key) => !process.env[key] || process.env[key].trim() === ''
);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missingVars.join(', ')}. ` +
      'Copy backend/.env.example to backend/.env and fill in the values.'
  );
}

const nodeEnv = process.env.NODE_ENV || 'development';

const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: parseInt(process.env.PORT, 10),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
  // Opsional — dengan default agar tidak wajib ada di .env
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
};

module.exports = config;
