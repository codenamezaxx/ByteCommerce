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
  // Buat produk reguler dulu, lalu tetapkan sebagai flash sale lewat endpoint
  // admin baru (mengatur harga flash + kuota flash_sale_stock + warmup Redis).
  const res = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name,
      description: 'flash sale test product',
      category: 'Elektronik',
      price,
      stock,
    });
  expect(res.status).toBe(201);
  const product = res.body.data;

  const setRes = await request(app)
    .post('/api/admin/flashsale/items')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ productId: product.id, flashSalePrice: flashPrice, flashSaleStock: stock });
  expect(setRes.status).toBe(201);
  return setRes.body.data;
}

// Payload shipping + payment valid, dipakai semua test checkout.
const VALID_SHIPPING = {
  name: 'Budi Santoso',
  phone: '081234567890',
  address: 'Jl. Merdeka No. 1',
  city: 'Jakarta',
  province: 'DKI Jakarta',
  postalCode: '10110',
  note: 'Kantor',
};
const VALID_PAYMENT_METHOD = 'BANK_TRANSFER';

function checkoutBody(overrides = {}) {
  return {
    productId: productA.id,
    quantity: 1,
    shipping: VALID_SHIPPING,
    paymentMethod: VALID_PAYMENT_METHOD,
    ...overrides,
  };
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
  // B dibuat SETELAH warmup → hapus key Redis-nya → menguji graceful fallback (miss).
  productB = await createFlashProduct(`${TEST_PRODUCT_NAME_PREFIX} B ${ts}`, 200000, 2, 100000);
  await redis.del(`${STOCK_KEY_PREFIX}${productB.id}`);
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

  it('validates body (invalid productId / quantity) -> 400', async () => {
    const res = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects invalid paymentMethod -> 422 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send(checkoutBody({ paymentMethod: 'PAYPAL' }));

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'paymentMethod' }));
  });

  it('rejects missing required shipping field -> 422 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send(checkoutBody({ shipping: { ...VALID_SHIPPING, city: '   ' } }));

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'shipping.city' }));
  });

  it('purchases via stored procedure (atomic) and stores shipping + payment', async () => {
    const res = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send(checkoutBody({ productId: productA.id, quantity: 2, paymentMethod: 'COD' }));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('orderId');
    expect(res.body.data.status).toBe('PAID');
    expect(res.body.data.totalAmount).toBe(75000 * 2); // flash price * qty
    expect(res.body.data.paymentMethod).toBe('COD');

    createdOrderIds.push(res.body.data.orderId);

    // Order tersimpan dengan data pengiriman + metode pembayaran.
    const orderResult = await db.query(
      `SELECT shipping_name, shipping_phone, shipping_address, shipping_city,
              shipping_province, shipping_postal_code, shipping_note, payment_method
       FROM orders WHERE id = $1`,
      [res.body.data.orderId]
    );
    const order = orderResult.rows[0];
    expect(order.shipping_name).toBe('Budi Santoso');
    expect(order.shipping_phone).toBe('081234567890');
    expect(order.shipping_address).toBe('Jl. Merdeka No. 1');
    expect(order.shipping_city).toBe('Jakarta');
    expect(order.shipping_province).toBe('DKI Jakarta');
    expect(order.shipping_postal_code).toBe('10110');
    expect(order.shipping_note).toBe('Kantor');
    expect(order.payment_method).toBe('COD');

    // Kuota flash sale di DB benar-benar berkurang (bukan kalkulasi client).
    // SP baru memotong flash_sale_stock; stok asli TIDAK disentuh.
    const stockResult = await db.query('SELECT stock, flash_sale_stock FROM products WHERE id = $1', [productA.id]);
    expect(Number(stockResult.rows[0].stock)).toBe(5); // stok asli tetap
    expect(Number(stockResult.rows[0].flash_sale_stock)).toBe(3); // 5 - 2

    // Kuota Redis ikut tersinkron.
    const cached = await redis.get(`${STOCK_KEY_PREFIX}${productA.id}`);
    expect(Number(cached)).toBe(3);
  });

  it('falls back to DB when Redis key is missing (no warmup)', async () => {
    // productB tidak pernah di-warmup (key Redis dihapus) → TIER 1 skip → DB mengeksekusi.
    const res = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send(checkoutBody({ productId: productB.id, quantity: 2 }));

    expect(res.status).toBe(201);
    expect(res.body.data.totalAmount).toBe(100000 * 2);
    createdOrderIds.push(res.body.data.orderId);

    const stockResult = await db.query('SELECT stock, flash_sale_stock FROM products WHERE id = $1', [productB.id]);
    expect(Number(stockResult.rows[0].stock)).toBe(2); // stok asli tetap
    expect(Number(stockResult.rows[0].flash_sale_stock)).toBe(0); // kuota flash habis (2 - 2)
  });

  it('rejects oversell (DB) and syncs Redis to 0', async () => {
    // Kuota flash A sekarang 3; minta 99 → Stored Procedure menolak OUT_OF_STOCK.
    const res = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send(checkoutBody({ productId: productA.id, quantity: 99 }));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('OUT_OF_STOCK_DB');
    expect(res.body.success).toBe(false);

    // Redis di-sinkronkan ke 0 sehingga pre-check berikutnya langsung menolak.
    const cached = await redis.get(`${STOCK_KEY_PREFIX}${productA.id}`);
    expect(Number(cached)).toBe(0);

    // Kuota flash DB tidak berubah (rollback transaksi di Stored Procedure).
    const stockResult = await db.query('SELECT flash_sale_stock FROM products WHERE id = $1', [productA.id]);
    expect(Number(stockResult.rows[0].flash_sale_stock)).toBe(3);
  });

  it('rejects a non-flash-sale product', async () => {
    const res = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send(checkoutBody({ productId: NON_FLASH_PRODUCT_ID, quantity: 1 }));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NOT_FLASH_SALE');
  });

  it('returns 404 for a nonexistent product', async () => {
    const res = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send(checkoutBody({ productId: 999999, quantity: 1 }));

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

  it('killswitch permanently removes all flash sale items (warmup cannot revive)', async () => {
    try {
      const res = await request(app)
        .post('/api/admin/flashsale/killswitch')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.killed).toBeGreaterThanOrEqual(5);

      // Item dikeluarkan dari program flash sale di PostgreSQL (bukan hanya Redis).
      const dbCheck = await db.query(
        'SELECT is_flash_sale, flash_sale_price FROM products WHERE id = $1',
        [productA.id]
      );
      expect(dbCheck.rows[0].is_flash_sale).toBe(false);
      expect(dbCheck.rows[0].flash_sale_price).toBe(null);

      // Checkout ditolak atomik oleh Stored Procedure (NOT_FLASH_SALE),
      // bukan sekadar ditolak di tier Redis.
      const checkoutRes = await request(app)
        .post('/api/flashsale/checkout')
        .set('Authorization', `Bearer ${userToken}`)
        .send(checkoutBody());

      expect(checkoutRes.status).toBe(409);
      expect(checkoutRes.body.code).toBe('NOT_FLASH_SALE');

      // Warmup TIDAK menghidupkan kembali item yang sudah di-killswitch
      // (tidak ada item flash aktif tersisa untuk di-warmup).
      const warmRes = await request(app)
        .post('/api/admin/flashsale/warmup')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(warmRes.status).toBe(200);
      expect(warmRes.body.data.warmed).toBe(0);

      const reviveRes = await request(app)
        .post('/api/flashsale/checkout')
        .set('Authorization', `Bearer ${userToken}`)
        .send(checkoutBody());

      expect(reviveRes.status).toBe(409);
      expect(reviveRes.body.code).toBe('NOT_FLASH_SALE');
    } finally {
      // Restore 5 produk seed flash sale (id 1-5) persis seperti seeds.sql —
      // test file lain (products.test.js / admin.test.js) bergantung pada
      // keberadaan item flash seed di DB.
      await db.query(
        `UPDATE products SET
           is_flash_sale = TRUE,
           flash_sale_price = CASE id
             WHEN 1 THEN 899000 WHEN 2 THEN 549000 WHEN 3 THEN 429000
             WHEN 4 THEN 299000 WHEN 5 THEN 1799000 ELSE flash_sale_price END,
           flash_sale_stock = stock,
           flash_sale_start = NULL,
           flash_sale_end = NULL
         WHERE id IN (1,2,3,4,5)`
      );
    }
  });
});

describe('Admin flash sale items (set / remove)', () => {
  it('requires authentication -> 401', async () => {
    const res = await request(app)
      .post('/api/admin/flashsale/items')
      .send({ productId: 1, flashSalePrice: 100, flashSaleStock: 5 });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTHENTICATION_FAILED');
  });

  it('rejects non-admin user -> 403', async () => {
    const res = await request(app)
      .post('/api/admin/flashsale/items')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId: 1, flashSalePrice: 100, flashSaleStock: 5 });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('sets a regular product as flash sale -> 201 with full product data + Redis warmup', async () => {
    const ts = Date.now();
    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `${TEST_PRODUCT_NAME_PREFIX} SetItem ${ts}`,
        description: 'admin set item',
        category: 'Elektronik',
        price: 500000,
        stock: 10,
      });
    expect(created.status).toBe(201);
    const productId = created.body.data.id;

    const res = await request(app)
      .post('/api/admin/flashsale/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId,
        flashSalePrice: 250000,
        flashSaleStock: 10,
        startAt: '2026-08-04T00:00:00.000Z',
        endAt: '2026-08-05T00:00:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(productId);
    expect(res.body.data.is_flash_sale).toBe(true);
    expect(res.body.data.flash_sale_price).toBe(250000);
    expect(res.body.data.flash_sale_stock).toBe(10);
    expect(res.body.data.flash_sale_start).toBe('2026-08-04T00:00:00.000Z');
    expect(res.body.data.flash_sale_end).toBe('2026-08-05T00:00:00.000Z');

    // Kuota Redis di-warmup untuk produk tersebut.
    const cached = await redis.get(`${STOCK_KEY_PREFIX}${productId}`);
    expect(Number(cached)).toBe(10);
  });

  it('rejects flashSalePrice >= original price -> 422 INVALID_FLASH_PRICE', async () => {
    const ts = Date.now();
    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${TEST_PRODUCT_NAME_PREFIX} BadPrice ${ts}`, category: 'Elektronik', price: 100000, stock: 5 });
    expect(created.status).toBe(201);

    const res = await request(app)
      .post('/api/admin/flashsale/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: created.body.data.id, flashSalePrice: 100000, flashSaleStock: 5 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INVALID_FLASH_PRICE');
    expect(res.body.success).toBe(false);
  });

  it('rejects negative flashSaleStock -> 422 VALIDATION_ERROR', async () => {
    const ts = Date.now();
    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${TEST_PRODUCT_NAME_PREFIX} BadStock ${ts}`, category: 'Elektronik', price: 100000, stock: 5 });
    expect(created.status).toBe(201);

    const res = await request(app)
      .post('/api/admin/flashsale/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: created.body.data.id, flashSalePrice: 50000, flashSaleStock: -1 });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'flashSaleStock' }));
  });

  it('returns 404 for nonexistent product', async () => {
    const res = await request(app)
      .post('/api/admin/flashsale/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId: 999999, flashSalePrice: 100, flashSaleStock: 5 });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('removes a flash sale item -> 200, is_flash_sale FALSE & Redis key deleted', async () => {
    const ts = Date.now();
    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${TEST_PRODUCT_NAME_PREFIX} RemoveItem ${ts}`, category: 'Elektronik', price: 300000, stock: 8 });
    expect(created.status).toBe(201);
    const productId = created.body.data.id;

    const setRes = await request(app)
      .post('/api/admin/flashsale/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productId, flashSalePrice: 150000, flashSaleStock: 8 });
    expect(setRes.status).toBe(201);

    const res = await request(app)
      .delete(`/api/admin/flashsale/items/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(productId);
    expect(res.body.data.is_flash_sale).toBe(false);
    expect(res.body.data.flash_sale_price).toBe(null);
    expect(res.body.data.flash_sale_stock).toBe(null);

    const cached = await redis.get(`${STOCK_KEY_PREFIX}${productId}`);
    expect(cached).toBe(null);
  });

  it('delete nonexistent product -> 404', async () => {
    const res = await request(app)
      .delete('/api/admin/flashsale/items/999999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });
});

describe('Redis cache loss recovery (key hilang setelah restart Redis)', () => {
  it('re-initializes a missing stock key from DB instead of creating a negative quota', async () => {
    // Pakai produk seed flash id 1 (Smartwatch X100, kuota 12): killswitch test
    // sebelumnya mengeluarkan productA/B dari program flash sale, sedangkan
    // seed id 1-5 di-restore oleh finally test tersebut.
    const seedProductId = 1;
    // Simulasi: Redis baru restart → semua key flash_sale:stock:* hilang.
    await redis.del(`${STOCK_KEY_PREFIX}${seedProductId}`);
    expect(await redis.get(`${STOCK_KEY_PREFIX}${seedProductId}`)).toBe(null);

    // Checkout harus TETAP SUKSES (bukan OUT_OF_STOCK_REDIS) karena stok DB ada.
    const res = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send(checkoutBody({ productId: seedProductId, quantity: 1 }));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    createdOrderIds.push(res.body.data.orderId);

    // Key harus ADA kembali, TIDAK negatif, dan akurat = stok flash tersisa di DB.
    const cached = await redis.get(`${STOCK_KEY_PREFIX}${seedProductId}`);
    expect(cached).not.toBe(null);
    expect(Number(cached)).toBeGreaterThanOrEqual(0);

    const stockResult = await db.query(
      'SELECT flash_sale_stock FROM products WHERE id = $1',
      [seedProductId]
    );
    const dbStock = Number(stockResult.rows[0].flash_sale_stock);
    expect(dbStock).toBeGreaterThanOrEqual(0);
    expect(Number(cached)).toBe(dbStock);
  });
});

describe('Auto-ekspirasi flash sale (flash_sale_end lewat)', () => {
  it('membersihkan item expired: tidak aktif, harga normal kembali, checkout ditolak', async () => {
    const ts = Date.now();
    // Produk reguler baru, lalu ditetapkan flash sale dengan endAt MASA LALU.
    const prodRes = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `${TEST_PRODUCT_NAME_PREFIX} EXP ${ts}`,
        description: 'flash sale test product',
        category: 'Elektronik',
        price: 300000,
        stock: 10,
      });
    expect(prodRes.status).toBe(201);
    const productId = prodRes.body.data.id;

    const setRes = await request(app)
      .post('/api/admin/flashsale/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId,
        flashSalePrice: 150000,
        flashSaleStock: 5,
        endAt: new Date(Date.now() - 60 * 1000).toISOString(),
      });
    expect(setRes.status).toBe(201);
    expect(setRes.body.data.flash_sale_end).not.toBe(null);

    // 1) Active list memicu auto-ekspirasi → produk expired tidak ikut.
    const activeRes = await request(app).get('/api/flashsale/active');
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.data.products.map((p) => p.id)).not.toContain(productId);

    // 2) DB dibersihkan permanen → harga normal kembali di response.
    const detailRes = await request(app).get(`/api/products/${productId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.is_flash_sale).toBe(false);
    expect(detailRes.body.data.flash_sale_price).toBe(null);
    expect(detailRes.body.data.flash_sale_stock).toBe(null);
    expect(detailRes.body.data.flash_sale_end).toBe(null);

    // 3) Checkout flash sale produk expired → ditolak (bukan lagi flash sale).
    const checkoutRes = await request(app)
      .post('/api/flashsale/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        productId,
        quantity: 1,
        shipping: VALID_SHIPPING,
        paymentMethod: VALID_PAYMENT_METHOD,
      });
    expect(checkoutRes.status).toBe(409);

    // 4) List filter flash_sale=true tidak memuat produk expired.
    const listRes = await request(app).get('/api/products?flash_sale=true&limit=100');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.products.map((p) => p.id)).not.toContain(productId);
  });
});
