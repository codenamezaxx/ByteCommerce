// P6 — Flash sale module integration tests.
// Supertest langsung terhadap app (in-process); DB & Redis berasal dari stack Docker.
// Verifikasi zero-oversell, graceful fallback Redis, error mapping Stored Procedure,
// serta endpoint admin (warmup/killswitch).
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const redis = require('../src/config/redis');

const ADMIN_EMAIL = 'admin@bytecommerce.com';
const ADMIN_PASSWORD = 'Admin@123';
// Seed: Kemeja Oxford Premium (is_flash_sale = FALSE).
const NON_FLASH_PRODUCT_ID = 6;
const TEST_PRODUCT_NAME_PREFIX = 'Flash Sale Test Product';
const STOCK_KEY_PREFIX = 'flash_sale:stock:';

let adminToken;
let userToken;
let productA; // flash, stock 5 — dipakai untuk alur utama (di-warmup)
let productB; // flash, stock 2 — TIDAK di-warmup (Redis miss → fallback ke DB)
const createdOrderIds = [];

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.data.token;
}

async function signup(name, email, password) {
  return request(app).post('/api/auth/signup').send({ name, email, password });
}

// Signup TIDAK mengembalikan token — login ulang untuk mendapatkannya.
async function signupAndLogin(name, email, password) {
  await signup(name, email, password);
  return login(email, password);
}

async function createFlashProduct(name, price, stock, flashPrice) {
  const res = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name,
      description: 'flash sale test product',
      price,
      stock,
      is_flash_sale: true,
      flash_sale_price: flashPrice,
    });
  expect(res.status).toBe(201);
  return res.body.data;
}

beforeAll(async () => {
  adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  const testEmail = `flashsale-test-${Date.now()}@bytecommerce.test`;
  const signupRes = await signup('Flash Sale Tester', testEmail, 'Password123!');
  expect(signupRes.status).toBe(201);
  userToken = await login(testEmail, 'Password123!');
  expect(typeof userToken).toBe('string');

  const ts = Date.now();
  // A dibuat lalu seluruh stok di-warmup ke Redis (A + 5 produk seed ikut ter-warmup).
  productA = await createFlashProduct(`${TEST_PRODUCT_NAME_PREFIX} A ${ts}`, 150000, 5, 75000);
  await request(app)
    .post('/api/admin/flashsale/warmup')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  // B dibuat SETELAH warmup → tidak punya key Redis → menguji graceful fallback (miss).
  productB = await createFlashProduct(`${TEST_PRODUCT_NAME_PREFIX} B ${ts}`, 200000, 2, 100000);
});

afterAll(async () => {
  if (createdOrderIds.length > 0) {
    await db.query('DELETE FROM orders WHERE id = ANY($1::int[])', [createdOrderIds]);
  }
  // User test → orders-nya ter-cascade (orders.user_id ON DELETE CASCADE),
  // lalu order_items ikut cascade dari orders.
  await db.query("DELETE FROM users WHERE email LIKE 'flashsale-test-%@bytecommerce.test'");
  await db.query("DELETE FROM products WHERE name LIKE 'Flash Sale Test Product%'");

  // Kembalikan Redis ke kondisi "cold" (hapus semua key kuota flash sale).
  const keys = await redis.keys(`${STOCK_KEY_PREFIX}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  await redis.quit();
  await db.pool.end();
});

describe('GET /api/flashsale/active', () => {
  it('returns only active flash sale products with remaining_stock', async () => {
    const res = await request(app).get('/api/flashsale/active');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.count).toBeGreaterThanOrEqual(5); // seed flash sale = 5
    for (const p of res.body.data.products) {
      expect(p.is_flash_sale).toBe(undefined); // bukan field dari endpoint ini
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('flash_sale_price');
      expect(p).toHaveProperty('remaining_stock');
      expect(p.discount_percent).toBeGreaterThan(0);
      expect(p.discount_percent).toBeLessThan(100);
    }
    // Produk test A ikut terdaftar.
    expect(res.body.data.products.some((p) => p.id === productA.id)).toBe(true);
  });
});

describe('POST /api/flashsale/checkout', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/flashsale/checkout')
      .send({ productId: productA.id, quantity: 1 });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTHENTICATION_FAILED');
  });

  it('validates body (invalid productId / quantity)', async () => {
    const res = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('purchases via stored procedure (atomic) and returns order', async () => {
    const res = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId: productA.id, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('orderId');
    expect(res.body.data.status).toBe('PAID');
    expect(res.body.data.totalAmount).toBe(75000 * 2); // flash price * qty

    createdOrderIds.push(res.body.data.orderId);

    // Stok di DB benar-benar berkurang (bukan kalkulasi client).
    const stockResult = await db.query('SELECT stock FROM products WHERE id = $1', [productA.id]);
    expect(Number(stockResult.rows[0].stock)).toBe(3); // 5 - 2

    // Kuota Redis ikut tersinkron.
    const cached = await redis.get(`${STOCK_KEY_PREFIX}${productA.id}`);
    expect(Number(cached)).toBe(3);
  });

  it('falls back to DB when Redis key is missing (no warmup)', async () => {
    // productB tidak pernah di-warmup → key Redis null → TIER 1 skip → DB mengeksekusi.
    const res = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId: productB.id, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data.totalAmount).toBe(100000 * 2);
    createdOrderIds.push(res.body.data.orderId);

    const stockResult = await db.query('SELECT stock FROM products WHERE id = $1', [productB.id]);
    expect(Number(stockResult.rows[0].stock)).toBe(0);
  });

  it('rejects oversell (DB) and syncs Redis to 0', async () => {
    // Stok A sekarang 3; minta 99 → Stored Procedure menolak OUT_OF_STOCK.
    const res = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId: productA.id, quantity: 99 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('OUT_OF_STOCK_DB');
    expect(res.body.success).toBe(false);

    // Redis di-sinkronkan ke 0 sehingga pre-check berikutnya langsung menolak.
    const cached = await redis.get(`${STOCK_KEY_PREFIX}${productA.id}`);
    expect(Number(cached)).toBe(0);

    // Stok DB tidak berubah (rollback transaksi di Stored Procedure).
    const stockResult = await db.query('SELECT stock FROM products WHERE id = $1', [productA.id]);
    expect(Number(stockResult.rows[0].stock)).toBe(3);
  });

  it('rejects a non-flash-sale product', async () => {
    const res = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId: NON_FLASH_PRODUCT_ID, quantity: 1 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NOT_FLASH_SALE');
  });

  it('returns 404 for a nonexistent product', async () => {
    const res = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId: 999999, quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });
});

describe('Admin flash sale control', () => {
  it('rejects non-admin warmup with 403', async () => {
    const res = await request(app)
      .post('/api/admin/flashsale/warmup')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('requires auth for warmup', async () => {
    const res = await request(app).post('/api/admin/flashsale/warmup');
    expect(res.status).toBe(401);
  });

  it('warmup loads stock from PostgreSQL into Redis', async () => {
    const res = await request(app)
      .post('/api/admin/flashsale/warmup')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.warmed).toBeGreaterThanOrEqual(5);

    // Key produk A tersedia & sesuai stok DB (3).
    const cached = await redis.get(`${STOCK_KEY_PREFIX}${productA.id}`);
    expect(Number(cached)).toBe(3);
  });

  it('killswitch zeroes all quotas so checkout fails at Redis tier', async () => {
    const res = await request(app)
      .post('/api/admin/flashsale/killswitch')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.killed).toBeGreaterThanOrEqual(5);

    // Checkout sekarang ditolak di TIER 1 (Redis = 0), DB tidak tersentuh.
    const checkoutRes = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId: productA.id, quantity: 1 });

    expect(checkoutRes.status).toBe(400);
    expect(checkoutRes.body.code).toBe('OUT_OF_STOCK_REDIS');

    // Stok DB tidak berubah (masih 3).
    const stockResult = await db.query('SELECT stock FROM products WHERE id = $1', [productA.id]);
    expect(Number(stockResult.rows[0].stock)).toBe(3);
  });

  it('warmup re-enables checkout after killswitch', async () => {
    await request(app)
      .post('/api/admin/flashsale/warmup')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const res = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId: productA.id, quantity: 1 });

    expect(res.status).toBe(201);
    expect(res.body.data.totalAmount).toBe(75000);
    createdOrderIds.push(res.body.data.orderId);
  });
});
