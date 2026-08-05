// P11.2 — End-to-end flow integration test.
// Supertest langsung terhadap app (in-process); DB & Redis berasal dari stack Docker.
// Alur utama: signup → login → browse products → add to cart → checkout → verify order.
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const redis = require('../src/config/redis');

const PRODUCT_ID = 1; // Seed product: Kemeja Oxford Premium (stock > 0).
const TEST_EMAIL = `e2e_flow_${Date.now()}@test.com`;
const TEST_PASSWORD = 'E2eFlow@123';
const TEST_NAME = 'E2E Flow User';

let userToken;
let createdOrderId;
let e2eProductId = PRODUCT_ID;

afterAll(async () => {
  // Cleanup: hapus order, cart items, dan user yang dibuat.
  // cart_items tidak punya user_id — harus join lewat carts.
  const userRes = await db.query('SELECT id FROM users WHERE email = $1', [TEST_EMAIL]);
  if (userRes.rows.length > 0) {
    const userId = userRes.rows[0].id;
    const cartRes = await db.query('SELECT id FROM carts WHERE user_id = $1', [userId]);
    for (const cart of cartRes.rows) {
      await db.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);
    }
  }
  if (createdOrderId) {
    await db.query('DELETE FROM order_items WHERE order_id = $1', [createdOrderId]);
    await db.query('DELETE FROM orders WHERE id = $1', [createdOrderId]);
  }
  await db.query('DELETE FROM users WHERE email = $1', [TEST_EMAIL]);
  await db.pool.end();
  await redis.quit();
});

describe('End-to-End Flow: Signup → Login → Cart → Checkout', () => {
  it('step 1: signup creates a new user', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(TEST_EMAIL);
    expect(res.body.data.role).toBe('USER');
    // Password hash tidak boleh bocor.
    expect(res.body.data.password_hash).toBeUndefined();
  });

  it('step 2: login returns token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe('string');
    userToken = res.body.data.token;
  });

  it('step 3: browse products returns a list', async () => {
    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.products)).toBe(true);
    expect(res.body.data.products.length).toBeGreaterThan(0);

    // Pick the first in-stock product for checkout (seed data may vary).
    const inStock = res.body.data.products.find((p) => p.stock > 0);
    expect(inStock).toBeDefined();
    // Update PRODUCT_ID reference for subsequent steps.
    e2eProductId = inStock.id;
  });

  it('step 4: get product detail', async () => {
    const res = await request(app).get(`/api/products/${e2eProductId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(e2eProductId);
    expect(res.body.data.stock).toBeGreaterThan(0);
  });

  it('step 5: add product to cart', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ productId: e2eProductId, quantity: 1 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Verifikasi cart berisi item yang benar.
    const cartRes = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${userToken}`);

    expect(cartRes.status).toBe(200);
    const cartItem = cartRes.body.data.items.find((i) => i.product_id === e2eProductId);
    expect(cartItem).toBeDefined();
    expect(cartItem.quantity).toBe(1);
  });

  it('step 6: checkout creates order and decrements stock', async () => {
    // Ambil stok awal.
    const beforeRes = await request(app).get(`/api/products/${e2eProductId}`);
    const stockBefore = beforeRes.body.data.stock;

    const res = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        productIds: [e2eProductId],
        shipping: {
          name: TEST_NAME,
          phone: '081234567890',
          address: 'Jl. E2E Test No. 1',
          city: 'Jakarta',
          province: 'DKI Jakarta',
          postalCode: '12345',
        },
        paymentMethod: 'BANK_TRANSFER',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    // Service returns orderId (not id).
    expect(res.body.data.orderId).toBeDefined();
    // Stored procedure may set PENDING or PAID depending on implementation.
    expect(['PENDING', 'PAID']).toContain(res.body.data.status);
    // Set createdOrderId BEFORE stock assertion so later steps don't cascade-fail.
    createdOrderId = res.body.data.orderId;

    // Stok harus berkurang 1.
    const afterRes = await request(app).get(`/api/products/${e2eProductId}`);
    const stockAfter = afterRes.body.data.stock;
    expect(stockAfter).toBe(stockBefore - 1);
  });

  it('step 7: order appears in user order list', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.orders)).toBe(true);

    const order = res.body.data.orders.find((o) => String(o.id) === String(createdOrderId));
    expect(order).toBeDefined();
    expect(['PENDING', 'PAID']).toContain(order.status);
  });

  it('step 8: order detail shows correct items', async () => {
    const res = await request(app)
      .get(`/api/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdOrderId);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].product_id).toBe(e2eProductId);
    expect(res.body.data.items[0].quantity).toBe(1);
  });

  it('step 9: cart is emptied after checkout', async () => {
    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(0);
  });

  it('step 10: cannot checkout with empty productIds', async () => {
    const res = await request(app)
      .post('/api/orders/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        productIds: [],
        shipping: {
          name: TEST_NAME,
          phone: '081234567890',
          address: 'Jl. E2E Test No. 1',
          city: 'Jakarta',
          province: 'DKI Jakarta',
          postalCode: '12345',
        },
        paymentMethod: 'BANK_TRANSFER',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('step 11: cannot checkout without auth', async () => {
    const res = await request(app)
      .post('/api/orders/checkout')
      .send({
        productIds: [e2eProductId],
        shipping: {
          name: TEST_NAME,
          phone: '081234567890',
          address: 'Jl. E2E Test No. 1',
          city: 'Jakarta',
          province: 'DKI Jakarta',
          postalCode: '12345',
        },
        paymentMethod: 'BANK_TRANSFER',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
