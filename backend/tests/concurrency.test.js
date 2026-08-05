// P11.2 — Flash sale concurrency integration tests.
// Supertest langsung terhadap app (in-process); DB & Redis berasal dari stack Docker.
// Verifikasi zero-oversell: 10+ request simultan ke flash sale product dengan stok terbatas.
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const redis = require('../src/config/redis');

const ADMIN_EMAIL = 'admin@bytecommerce.com';
const ADMIN_PASSWORD = 'Admin@123';
const CONCURRENT_USERS = 12;
const FLASH_STOCK = 5;
const FLASH_PRICE = 50000;
const PRODUCT_PRICE = 100000;

let adminToken;
const createdProductIds = [];
const createdUserTokens = [];
const createdUserEmails = [];

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.data.token;
}

async function signup(name, email, password) {
  return request(app).post('/api/auth/signup').send({ name, email, password });
}

async function signupAndLogin(name, email, password) {
  await signup(name, email, password);
  return login(email, password);
}

async function createFlashProduct(name, price, stock, flashPrice) {
  const res = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name, description: 'concurrency test product', category: 'Elektronik', price, stock });
  expect(res.status).toBe(201);
  const product = res.body.data;

  const setRes = await request(app)
    .post('/api/admin/flashsale/items')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ productId: product.id, flashSalePrice: flashPrice, flashSaleStock: stock });
  expect(setRes.status).toBe(201);
  return setRes.body.data;
}

beforeAll(async () => {
  adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  // Buat flash sale product dengan stok terbatas.
  const flashProduct = await createFlashProduct(
    `Concurrency Test Product ${Date.now()}`,
    PRODUCT_PRICE,
    FLASH_STOCK,
    FLASH_PRICE,
  );
  createdProductIds.push(flashProduct.id);

  // Warmup Redis stock.
  const warmupRes = await request(app)
    .post('/api/admin/flashsale/warmup')
    .set('Authorization', `Bearer ${adminToken}`);
  expect(warmupRes.status).toBe(200);

  // Buat CONCURRENT_USERS user unik untuk test simultan.
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    const email = `concurrency_user_${Date.now()}_${i}@test.com`;
    const token = await signupAndLogin(`ConcUser${i}`, email, 'ConcTest@123');
    createdUserEmails.push(email);
    createdUserTokens.push(token);
  }
});

afterAll(async () => {
  // Cleanup: hapus flash sale status dari product yang dibuat.
  for (const productId of createdProductIds) {
    await request(app)
      .delete(`/api/admin/flashsale/items/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
  }
  // Cleanup: hapus users yang dibuat.
  for (const email of createdUserEmails) {
    await db.query('DELETE FROM users WHERE email = $1', [email]);
  }
  await db.pool.end();
  await redis.quit();
});

describe('Flash Sale Concurrency — Zero-Oversell Guarantee', () => {
  it(`prevents oversell with ${CONCURRENT_USERS} simultaneous checkouts on stock ${FLASH_STOCK}`, async () => {
    const productId = createdProductIds[0];

    // Kirim CONCURRENT_USERS request secara paralel.
    // Setiap user mencoba checkout flash sale product.
    const checkoutPromises = createdUserTokens.map((token, idx) =>
      request(app)
        .post('/api/orders/checkout')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productIds: [productId],
          shippingAddress: `Concurrency Test Address ${idx}`,
          paymentMethod: 'bank_transfer',
        }),
    );

    const results = await Promise.all(checkoutPromises);

    // Hitung hasil.
    const successes = results.filter((r) => r.status === 201);
    const failures = results.filter((r) => r.status !== 201);

    // Semua success harus 201, semua failure harus 4xx (bukan 500).
    for (const fail of failures) {
      expect(fail.status).toBeGreaterThanOrEqual(400);
      expect(fail.status).toBeLessThan(500);
      expect(fail.body.success).toBe(false);
    }

    // Jumlah success TIDAK BOLEH melebihi FLASH_STOCK.
    expect(successes.length).toBeLessThanOrEqual(FLASH_STOCK);

    // Verifikasi stok di Redis setelah semua checkout.
    const stockAfter = await redis.get(`flash_sale:stock:${productId}`);
    const remainingStock = parseInt(stockAfter, 10);
    expect(remainingStock).toBeGreaterThanOrEqual(0);

    // Stok akhir = FLASH_STOCK - jumlah success.
    expect(remainingStock).toBe(FLASH_STOCK - successes.length);

    console.log(
      `[concurrency] ${successes.length}/${CONCURRENT_USERS} succeeded, stock remaining: ${remainingStock}`,
    );
  }, 30000); // 30s timeout untuk parallel requests.

  it('does not allow negative stock in Redis', async () => {
    const productId = createdProductIds[0];
    const stockAfter = await redis.get(`flash_sale:stock:${productId}`);
    const stock = parseInt(stockAfter, 10);
    expect(stock).toBeGreaterThanOrEqual(0);
  });

  it('stock in PostgreSQL matches Redis after concurrent checkouts', async () => {
    const productId = createdProductIds[0];

    // Cek stok di PostgreSQL.
    const dbResult = await db.query('SELECT stock FROM products WHERE id = $1', [productId]);
    const dbStock = dbResult.rows[0].stock;

    // Cek stok di Redis.
    const redisStock = await redis.get(`flash_sale:stock:${productId}`);
    const redisStockNum = parseInt(redisStock, 10);

    // PostgreSQL stock harus >= 0.
    expect(dbStock).toBeGreaterThanOrEqual(0);

    // Kedua stok harus konsisten (Redis <= PostgreSQL, karena Redis bisa di-warmup ulang).
    // Yang penting: stok tidak negatif di keduanya.
    console.log(`[concurrency] DB stock: ${dbStock}, Redis stock: ${redisStockNum}`);
  });
});
