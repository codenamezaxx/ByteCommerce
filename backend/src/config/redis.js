// P2.1 — Redis client (ioredis) with graceful fallback.
// If Redis is down, the system must keep running (query PostgreSQL directly).
// Use redisGet/redisSet helpers for cache reads/writes — they return null / no-op
// when Redis is not ready instead of throwing.
const Redis = require('ioredis');
const config = require('./env');

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

let redisReady = false;

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

redis.on('ready', () => {
  redisReady = true;
  console.log('Redis ready');
});

redis.on('error', (err) => {
  redisReady = false;
  console.error('Redis Client Error:', err.message);
});

redis.on('close', () => {
  redisReady = false;
});

redis.on('end', () => {
  redisReady = false;
});

function isRedisReady() {
  return redisReady && redis.status === 'ready';
}

async function redisGet(key) {
  if (!isRedisReady()) return null;
  try {
    return await redis.get(key);
  } catch (err) {
    console.error('[redis] GET fallback (returning null):', err.message);
    return null;
  }
}

async function redisSet(key, value, ttlSeconds) {
  if (!isRedisReady()) return null;
  try {
    if (ttlSeconds && ttlSeconds > 0) {
      return await redis.set(key, value, 'EX', ttlSeconds);
    }
    return await redis.set(key, value);
  } catch (err) {
    console.error('[redis] SET fallback (no-op):', err.message);
    return null;
  }
}

// Client instance exported as default (matching ARCHITECTURE.md usage),
// with graceful-fallback helpers attached.
redis.isRedisReady = isRedisReady;
redis.redisGet = redisGet;
redis.redisSet = redisSet;

module.exports = redis;
