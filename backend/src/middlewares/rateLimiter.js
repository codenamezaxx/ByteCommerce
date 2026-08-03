// P2.2 — Redis-based rate limiter with graceful degradation.
// Key pattern: ratelimit:<identifier>:<endpoint>
// If Redis is down/unavailable -> bypass (allow request). If limit exceeded -> 429.
const redis = require('../config/redis');

function createRateLimiter({ windowMs = 10000, max = 5, getIdentifier } = {}) {
  const resolveIdentifier = getIdentifier || ((req) => req.ip || req.socket.remoteAddress || 'unknown');

  return async function rateLimiter(req, res, next) {
    // Graceful fallback: Redis tidak siap -> bypass.
    if (!redis.isRedisReady()) {
      return next();
    }

    try {
      const identifier = resolveIdentifier(req);
      const endpoint = req.originalUrl || req.url || '/';
      const key = `ratelimit:${identifier}:${endpoint}`;
      const ttlSeconds = Math.ceil(windowMs / 1000);

      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, ttlSeconds);
      }

      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - current)));

      if (current > max) {
        res.setHeader('Retry-After', String(ttlSeconds));
        return res.status(429).json({
          success: false,
          message: 'Too many requests, please slow down',
          code: 'RATE_LIMITED',
        });
      }

      return next();
    } catch (err) {
      // Redis error di tengah proses -> bypass (graceful degradation).
      console.error('[rateLimiter] Redis unavailable, bypassing request:', err.message);
      return next();
    }
  };
}

// Default instance untuk flash sale checkout: max 5 request per 10 detik.
// Identifier pakai user id bila sudah login, selain itu IP.
const flashSaleRateLimiter = createRateLimiter({
  windowMs: 10000,
  max: 5,
  getIdentifier: (req) => (req.user && req.user.id ? `user:${req.user.id}` : `ip:${req.ip}`),
});

module.exports = flashSaleRateLimiter;
module.exports.createRateLimiter = createRateLimiter;
