// P11.2 — Rate limiter integration tests.
// Tests the createRateLimiter middleware directly using a mini Express app,
// since the flashSaleRateLimiter is exported but not mounted on any route yet.
// DB & Redis berasal dari stack Docker.
const express = require('express');
const http = require('http');
const { createRateLimiter } = require('../src/middlewares/rateLimiter');
const redis = require('../src/config/redis');
const db = require('../src/config/db');

const RATE_LIMIT_PREFIX = 'ratelimit:';

// Create a mini Express app with the rate limiter mounted on a test endpoint.
const testApp = express();
testApp.use(express.json());

const rateLimiter = createRateLimiter({
  windowMs: 10000,
  max: 5,
  getIdentifier: (req) => req.ip || '127.0.0.1',
});

testApp.post('/test-endpoint', rateLimiter, (req, res) => {
  res.json({ success: true, message: 'OK' });
});

let server;
let baseUrl;

beforeAll(async () => {
  await new Promise((resolve) => {
    server = testApp.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await clearRateLimitKeys();
  await db.pool.end();
  await redis.quit();
});

// Helper: bersihkan semua rate limit key yang relevan dari Redis.
async function clearRateLimitKeys() {
  const keys = await redis.keys(`${RATE_LIMIT_PREFIX}*`);
  if (keys.length > 0) {
    await Promise.all(keys.map((k) => redis.del(k)));
  }
}

describe('Rate Limiter Middleware', () => {
  // Bersihkan key sebelum setiap test agar tidak ada interference lintas test.
  beforeEach(async () => {
    await clearRateLimitKeys();
  });

  it('sets X-RateLimit-Limit header on requests', async () => {
    const res = await fetch(`${baseUrl}/test-endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.headers.get('x-ratelimit-limit')).toBe('5');
  });

  it('sets X-RateLimit-Remaining header', async () => {
    const res = await fetch(`${baseUrl}/test-endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const remaining = parseInt(res.headers.get('x-ratelimit-remaining'), 10);
    expect(remaining).toBeGreaterThanOrEqual(0);
    expect(remaining).toBeLessThan(5);
  });

  it('allows requests within the rate limit (5 requests)', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/test-endpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).not.toBe(429);
    }
  });

  it('returns 429 RATE_LIMITED when limit exceeded', async () => {
    for (let i = 0; i < 5; i++) {
      await fetch(`${baseUrl}/test-endpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    }

    const res = await fetch(`${baseUrl}/test-endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.message).toMatch(/too many requests/i);
  });

  it('sets Retry-After header when rate limited', async () => {
    for (let i = 0; i < 5; i++) {
      await fetch(`${baseUrl}/test-endpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    }

    const res = await fetch(`${baseUrl}/test-endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(429);
    const retryAfter = parseInt(res.headers.get('retry-after'), 10);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(10);
  });

  it('decrements remaining count with each request', async () => {
    const res1 = await fetch(`${baseUrl}/test-endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const remaining1 = parseInt(res1.headers.get('x-ratelimit-remaining'), 10);

    const res2 = await fetch(`${baseUrl}/test-endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const remaining2 = parseInt(res2.headers.get('x-ratelimit-remaining'), 10);

    expect(remaining2).toBeLessThan(remaining1);
  });
});
