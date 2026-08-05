// P11.2 — Redis Failure Fallback Integration Tests.
// Simulates Redis being completely unavailable (connection failure / service crash).
// Verifies that the system gracefully falls back to PostgreSQL and all operations
// continue to work. This is critical for production reliability — Redis should
// enhance performance but NEVER be a single point of failure.
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const redis = require('../src/config/redis');

const ADMIN_EMAIL = 'admin@bytecommerce.com';
const ADMIN_PASSWORD = 'Admin@123';
const STOCK_KEY_PREFIX = 'flash_sale:stock:';

let adminToken;
let userToken;
let flashProduct;

// Keep references to original Redis methods (captured once at load time)
const _origRedis = {
  get: redis.get.bind(redis),
  set: redis.set.bind(redis),
  mget: redis.mget.bind(redis),
  del: redis.del.bind(redis),
  exists: redis.exists.bind(redis),
  decrby: redis.decrby.bind(redis),
  pipeline: redis.pipeline.bind(redis),
  quit: redis.quit.bind(redis),
};

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.data.token;
}

const VALID_SHIPPING = {
  name: 'Budi Santoso',
  phone: '081234567890',
  address: 'Jl. Merdeka No. 1',
  city: 'Jakarta',
  province: 'DKI Jakarta',
  postalCode: '10110',
  note: 'Kantor',
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  // Create a test user for checkout tests
  await request(app).post('/api/auth/signup').send({
    name: 'Redis Fallback User',
    email: 'redis-fallback-test@test.com',
    password: 'Test@123',
  });
  userToken = await login('redis-fallback-test@test.com', 'Test@123');

  // Create a flash sale product
  const productRes = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Redis Fallback Test Product',
      description: 'Testing Redis failure fallback',
      category: 'Elektronik',
      price: 500000,
      stock: 20,
    });
  expect(productRes.status).toBe(201);
  const product = productRes.body.data;

  const flashRes = await request(app)
    .post('/api/admin/flashsale/items')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      productId: product.id,
      flashSalePrice: 350000,
      flashSaleStock: 10,
    });
  expect(flashRes.status).toBe(201);
  flashProduct = flashRes.body.data;

  // Start flash sale (endpoint returns 201)
  const startRes = await request(app)
    .post('/api/admin/flashsale/start')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ durationMinutes: 60 });
  expect(startRes.status).toBe(201);
});

// ─── Teardown ─────────────────────────────────────────────────────────────────

afterAll(async () => {
  // Always restore Redis before quitting — even if tests failed
  restoreRedis();
  try { await db.pool.end(); } catch (_) { /* ignore */ }
  try { await _origRedis.quit(); } catch (_) { /* ignore */ }
});

// ─── Mock / Restore helpers ───────────────────────────────────────────────────

/** Simulate Redis being completely down. */
function mockRedisDown() {
  const err = new Error('ECONNREFUSED Redis connection refused');
  redis.get = async () => { throw err; };
  redis.set = async () => { throw err; };
  redis.mget = async () => { throw err; };
  redis.del = async () => { throw err; };
  redis.exists = async () => { throw err; };
  redis.decrby = async () => { throw err; };
  redis.pipeline = () => ({
    set: () => {},
    del: () => {},
    exec: async () => { throw err; },
  });
}

/** Restore all original Redis methods. */
function restoreRedis() {
  redis.get = _origRedis.get;
  redis.set = _origRedis.set;
  redis.mget = _origRedis.mget;
  redis.del = _origRedis.del;
  redis.exists = _origRedis.exists;
  redis.decrby = _origRedis.decrby;
  redis.pipeline = _origRedis.pipeline;
}

afterEach(() => {
  // Always restore after each test so the next test starts clean
  restoreRedis();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Redis Failure Fallback', () => {
  describe('Flash Sale Active List (GET /api/flashsale/active)', () => {
    it('returns flash sale products when Redis is completely down', async () => {
      mockRedisDown();

      const res = await request(app).get('/api/flashsale/active');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Controller returns { products, count }, not a raw array
      expect(res.body.data.products).toBeDefined();
      expect(Array.isArray(res.body.data.products)).toBe(true);

      // Should still find our flash product (fallback to DB)
      const found = res.body.data.products.find((p) => p.id === flashProduct.id);
      expect(found).toBeDefined();
      expect(found.name).toBe('Redis Fallback Test Product');
      expect(found.flash_sale_price).toBe(350000);
    });

    it('falls back to DB stock when Redis mget fails', async () => {
      // First, ensure Redis is up and set a stock value
      await _origRedis.set(`${STOCK_KEY_PREFIX}${flashProduct.id}`, 100);

      // Now simulate Redis going down
      mockRedisDown();

      const res = await request(app).get('/api/flashsale/active');

      expect(res.status).toBe(200);
      const found = res.body.data.products.find((p) => p.id === flashProduct.id);
      expect(found).toBeDefined();
      // remaining_stock should fall back to PostgreSQL value (not 100 from Redis)
      expect(typeof found.remaining_stock).toBe('number');
      expect(found.remaining_stock).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Flash Sale Checkout (POST /api/flashsale/checkout)', () => {
    it('completes checkout when Redis is down (graceful fallback to DB)', async () => {
      mockRedisDown();

      const res = await request(app)
        .post('/api/flashsale/checkout')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId: flashProduct.id,
          quantity: 1,
          shipping: VALID_SHIPPING,
          paymentMethod: 'BANK_TRANSFER',
        });

      // Should succeed — DB is the source of truth (checkout returns 201 Created)
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBeDefined();
      expect(res.body.data.status).toBe('PAID');
      expect(res.body.data.totalAmount).toBe(350000);
    });

    it('creates valid order even when Redis pre-check fails', async () => {
      mockRedisDown();

      const res = await request(app)
        .post('/api/flashsale/checkout')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId: flashProduct.id,
          quantity: 1,
          shipping: VALID_SHIPPING,
          paymentMethod: 'COD',
        });

      // Checkout returns 201 Created
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentMethod).toBe('COD');

      // Verify order exists in database
      const orderResult = await db.query(
        'SELECT id, status, payment_method FROM orders WHERE id = $1',
        [res.body.data.orderId]
      );
      expect(orderResult.rows.length).toBe(1);
      expect(orderResult.rows[0].status).toBe('PAID');
      expect(orderResult.rows[0].payment_method).toBe('COD');
    });

    it('rejects checkout when product stock is exhausted in DB (even without Redis)', async () => {
      // Create a product with stock=1
      const productRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Redis Fallback Low Stock',
          description: 'Low stock test',
          category: 'Elektronik',
          price: 100000,
          stock: 1,
        });
      expect(productRes.status).toBe(201);
      const lowStockProduct = productRes.body.data;

      // Set as flash sale
      const flashRes = await request(app)
        .post('/api/admin/flashsale/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: lowStockProduct.id,
          flashSalePrice: 50000,
          flashSaleStock: 1,
        });
      expect(flashRes.status).toBe(201);

      // Start flash sale
      await request(app)
        .post('/api/admin/flashsale/start')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ durationMinutes: 60 });

      // First purchase — should succeed (returns 201 Created)
      const buy1 = await request(app)
        .post('/api/flashsale/checkout')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId: lowStockProduct.id,
          quantity: 1,
          shipping: VALID_SHIPPING,
          paymentMethod: 'BANK_TRANSFER',
        });
      expect(buy1.status).toBe(201);

      // Now mock Redis down and try second purchase
      mockRedisDown();

      const buy2 = await request(app)
        .post('/api/flashsale/checkout')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId: lowStockProduct.id,
          quantity: 1,
          shipping: VALID_SHIPPING,
          paymentMethod: 'BANK_TRANSFER',
        });

      // Should be rejected — DB knows stock is exhausted
      expect(buy2.status).toBe(400);
      expect(buy2.body.success).toBe(false);
      expect(buy2.body.code).toBe('OUT_OF_STOCK_DB');
    });
  });

  describe('Cart Operations (Redis-optional)', () => {
    it('adds items to cart when Redis is down', async () => {
      mockRedisDown();

      // Get a regular product (not flash sale)
      const productsRes = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${userToken}`);
      expect(productsRes.status).toBe(200);
      const regularProduct = productsRes.body.data.products.find(
        (p) => p.id !== flashProduct.id
      );
      expect(regularProduct).toBeDefined();

      const res = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId: regularProduct.id, quantity: 1 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('retrieves cart when Redis is down', async () => {
      mockRedisDown();

      const res = await request(app)
        .get('/api/cart')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });
  });

  describe('Products API (Redis-independent)', () => {
    it('lists products when Redis is down', async () => {
      mockRedisDown();

      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.products)).toBe(true);
      expect(res.body.data.products.length).toBeGreaterThan(0);
    });

    it('retrieves single product when Redis is down', async () => {
      mockRedisDown();

      const res = await request(app)
        .get(`/api/products/${flashProduct.id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(flashProduct.id);
    });
  });

  describe('Auth Operations (Redis-independent)', () => {
    it('logs in when Redis is down', async () => {
      mockRedisDown();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });
  });

  describe('Graceful Recovery', () => {
    it('continues working after Redis comes back up', async () => {
      // Simulate Redis down
      mockRedisDown();

      // Operation should work via DB fallback
      const res1 = await request(app).get('/api/flashsale/active');
      expect(res1.status).toBe(200);

      // Restore Redis
      restoreRedis();

      // Operation should now work with Redis
      const res2 = await request(app).get('/api/flashsale/active');
      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
    });
  });
});
