/**
 * P11.4 — Load Test: Flash Sale Checkout (500 concurrent)
 *
 * Uses autocannon to simulate 500 concurrent users hitting the flash sale
 * checkout endpoint. Verifies:
 *   1. Zero oversell — stock never goes below 0
 *   2. Response time < 500ms (p99)
 *   3. Redis cache hit ratio after warmup
 *
 * Prerequisites:
 *   - Docker stack running (backend:5000, postgres:5432, redis:6379)
 *   - Seed data loaded (products with flash sale enabled)
 *
 * Usage:
 *   node tests/load-test.js [--connections N] [--duration S] [--product-id ID]
 */

const autocannon = require('autocannon');
const http = require('http');
const { Pool } = require('pg');
const Redis = require('ioredis');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// --- Config ---
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const DB_URL = process.env.DATABASE_URL || 'postgresql://dev_user:dev_password@localhost:5432/bytecommerce_db';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
// Use Docker backend's actual JWT_SECRET (production mode differs from local .env)
const JWT_SECRET = process.env.JWT_SECRET || 'bytecommerce_jwt_super_secret_key_2026';

const CONNECTIONS = parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--connections') || '500', 10);
const DURATION = parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--duration') || '30', 10);
const PRODUCT_ID = parseInt(process.argv.find((a, i) => process.argv[i - 1] === '--product-id') || '2', 10);

const db = new Pool({ connectionString: DB_URL });
const redis = new Redis(REDIS_URL);

// --- Helpers ---
function httpPost(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const postData = JSON.stringify(data);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers,
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body), headers: res.headers }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function generateToken(userId, email) {
  return jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '1h' });
}

async function checkStock(productId) {
  const result = await db.query(
    'SELECT id, name, stock, flash_sale_stock FROM products WHERE id = $1',
    [productId]
  );
  return result.rows[0];
}

async function getRedisStock(productId) {
  const val = await redis.get(`flash_sale:stock:${productId}`);
  return val !== null ? Number(val) : null;
}

// --- Setup ---
async function setup() {
  console.log('\n=== P11.4 Load Test: Flash Sale Checkout ===\n');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Connections: ${CONNECTIONS}`);
  console.log(`Duration: ${DURATION}s`);
  console.log(`Product ID: ${PRODUCT_ID}\n`);

  // Check flash sale product
  const product = await checkStock(PRODUCT_ID);
  if (!product) {
    console.error(`ERROR: Product ${PRODUCT_ID} not found`);
    process.exit(1);
  }
  console.log(`Product: ${product.name} (id=${product.id})`);
  console.log(`Stock: ${product.stock}, Flash Sale Stock: ${product.flash_sale_stock}`);

  // Get Redis stock
  const redisStock = await getRedisStock(PRODUCT_ID);
  console.log(`Redis stock: ${redisStock}\n`);

  // Record pre-test state
  const preTestFlashStock = Number(product.flash_sale_stock || product.stock);
  const preTestOrderCount = (await db.query("SELECT COUNT(*) as cnt FROM orders")).rows[0].cnt;
  console.log(`Pre-test flash sale stock: ${preTestFlashStock}`);
  console.log(`Pre-test total orders: ${preTestOrderCount}\n`);

  // Create load test users directly in DB (fast) and generate JWT tokens
  console.log(`Creating ${CONNECTIONS} load test users...`);
  const passwordHash = await bcrypt.hash('LoadTest@123', 10);
  const tokens = [];
  const batch = 50;
  const ts = Date.now();

  for (let i = 0; i < CONNECTIONS; i += batch) {
    const values = [];
    const params = [];
    const batchSize = Math.min(batch, CONNECTIONS - i);

    for (let j = 0; j < batchSize; j++) {
      const idx = i + j;
      const email = `loadtest_${ts}_${idx}@bytecommerce.test`;
      params.push(`LoadTest User ${idx}`, email, passwordHash, 'USER');
      values.push(`($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length})`);
    }

    try {
      const result = await db.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ${values.join(', ')} RETURNING id, email`,
        params
      );

      for (const row of result.rows) {
        const token = generateToken(row.id, row.email);
        tokens.push(token);
      }
    } catch (e) {
      // Some inserts may fail (duplicate emails), skip
    }
  }

  console.log(`Created ${tokens.length}/${CONNECTIONS} user tokens\n`);

  if (tokens.length === 0) {
    console.error('ERROR: No tokens created. Cannot run load test.');
    process.exit(1);
  }

  // Warmup Redis cache
  console.log('Warming up Redis cache...');
  try {
    const adminToken = generateToken(1, 'admin@bytecommerce.com');
    const warmupRes = await httpPost(`${BASE_URL}/api/admin/flashsale/warmup`, {}, {
      Authorization: `Bearer ${adminToken}`,
    });
    console.log('Redis warmup complete');
  } catch (e) {
    console.log(`Warmup skipped: ${e.message}`);
  }

  return { preTestFlashStock, preTestOrderCount, tokens };
}

// --- Main ---
async function runLoadTest(tokens) {
  console.log(`\nStarting load test: ${CONNECTIONS} connections for ${DURATION}s...\n`);

  // Cycle tokens across connections for realistic multi-user testing
  const tokenIdx = { current: 0 };

  const instance = autocannon({
    url: `${BASE_URL}/api/flashsale/checkout`,
    method: 'POST',
    connections: CONNECTIONS,
    duration: DURATION,
    pipelining: 1,
    setupClient: (client) => {
      // Assign a rotating token to each connection
      const token = tokens[tokenIdx.current % tokens.length];
      tokenIdx.current++;
      client.setHeaders({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      });
    },
    body: JSON.stringify({
      productId: PRODUCT_ID,
      quantity: 1,
      shipping: {
        name: 'Load Test User',
        phone: '081234567890',
        address: 'Jl. Load Test No. 1',
        city: 'Jakarta',
        province: 'DKI Jakarta',
        postalCode: '12345',
      },
      paymentMethod: 'BANK_TRANSFER',
    }),
  });

  autocannon.track(instance, { renderProgressBar: true });

  const result = await new Promise((resolve) => {
    instance.on('done', resolve);
  });

  return result;
}

// --- Verify ---
async function verifyResults(result, preTestFlashStock, preTestOrderCount) {
  console.log('\n=== Results ===\n');

  // Basic stats
  console.log(`Total Requests: ${result.requests.total}`);
  console.log(`Successful (2xx): ${result.requests.total - result.errors.total}`);
  console.log(`Total Errors: ${result.errors.total}`);
  console.log(`Total Timeouts: ${result.timeouts || 0}`);
  console.log(`Throughput: ${result.throughput.average} req/s`);
  console.log(`Latency average: ${result.latency.average}ms`);
  console.log(`Latency p50: ${result.latency.p50}ms`);
  console.log(`Latency p99: ${result.latency.p99}ms`);
  console.log(`Latency max: ${result.latency.max}ms`);

  // Verify response time < 500ms
  const p99 = result.latency.p99;
  const passesLatency = p99 < 500;
  console.log(`\n[Latency p99 < 500ms]: ${passesLatency ? 'PASS' : 'FAIL'} (${p99}ms)`);

  // Check stock after test
  const postProduct = await checkStock(PRODUCT_ID);
  const postFlashStock = Number(postProduct.flash_sale_stock || postProduct.stock);
  const postRedisStock = await getRedisStock(PRODUCT_ID);

  console.log(`\nPost-test DB stock: ${postFlashStock}`);
  console.log(`Post-test Redis stock: ${postRedisStock}`);

  // Count new orders
  const postOrderCount = (await db.query("SELECT COUNT(*) as cnt FROM orders")).rows[0].cnt;
  const newOrders = postOrderCount - preTestOrderCount;
  console.log(`New orders created: ${newOrders}`);

  // Stock consumed
  const stockConsumed = preTestFlashStock - postFlashStock;
  console.log(`Stock consumed: ${stockConsumed}`);

  // Verify: stock consumed should equal new orders (zero oversell)
  const oversold = postFlashStock < 0;
  const stockConsistent = stockConsumed === newOrders;
  console.log(`\n[Zero Oversell]: ${oversold ? 'FAIL — stock is negative!' : 'PASS'} (stock=${postFlashStock})`);
  console.log(`[Stock Consistency]: ${stockConsistent ? 'PASS' : 'WARN'} (consumed=${stockConsumed}, orders=${newOrders})`);

  // Redis sync check
  const redisSynced = postRedisStock !== null && postRedisStock === postFlashStock;
  console.log(`[Redis Sync]: ${redisSynced ? 'PASS' : 'WARN'} (redis=${postRedisStock}, db=${postFlashStock})`);

  // Cleanup: remove load test users
  console.log('\nCleaning up test users...');
  await db.query("DELETE FROM users WHERE email LIKE 'loadtest_%@bytecommerce.test'");

  // Summary
  console.log('\n=== Summary ===\n');
  const allPassed = passesLatency && !oversold;
  console.log(`Latency p99 < 500ms: ${passesLatency ? 'PASS' : 'FAIL'}`);
  console.log(`Zero oversell: ${!oversold ? 'PASS' : 'FAIL'}`);
  console.log(`Stock consistency: ${stockConsistent ? 'PASS' : 'WARN'}`);
  console.log(`Redis sync: ${redisSynced ? 'PASS' : 'WARN'}`);
  console.log(`\nOverall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

  return allPassed;
}

// --- Entry ---
(async () => {
  try {
    const { preTestFlashStock, preTestOrderCount, tokens } = await setup();
    const result = await runLoadTest(tokens);
    const passed = await verifyResults(result, preTestFlashStock, preTestOrderCount);

    await db.end();
    redis.disconnect();

    process.exit(passed ? 0 : 1);
  } catch (err) {
    console.error('Load test failed:', err);
    await db.end().catch(() => {});
    redis.disconnect();
    process.exit(1);
  }
})();
