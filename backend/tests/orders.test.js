// P7 — Order module integration tests.
// Supertest langsung terhadap app (in-process); DB berasal dari stack Docker.
// Modul ini murni baca PostgreSQL (Redis tidak dipakai).
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const redis = require('../src/config/redis');

const BUDI_EMAIL = 'budi@example.com'; // seed user id 2 — punya 3 order seed
const ADMIN_EMAIL = 'admin@bytecommerce.com';
const PASSWORD = 'Admin@123';

let userToken; // Budi
let adminToken; // Admin (bisa lihat SEMUA order)
let testToken; // User test baru (dibuatkan 2 order di beforeAll)
let testUserId;
let testOrderPaidId;
let testOrderCancelledId;

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  return res.body.data.token;
}

beforeAll(async () => {
  userToken = await login(BUDI_EMAIL);
  adminToken = await login(ADMIN_EMAIL);

  const email = `orders-test-${Date.now()}@bytecommerce.test`;
  const signupRes = await request(app).post('/api/auth/signup').send({
    name: 'Orders Tester',
    email,
    password: PASSWORD, // sama dengan yang dipakai helper login() di bawah
  });
  expect(signupRes.status).toBe(201);
  // Signup mengembalikan user object langsung di data (bukan { user, token }).
  testUserId = signupRes.body.data.id;
  testToken = await login(email);

  // Dua order untuk user test (via SQL langsung — tidak ada endpoint pembuat order).
  const paid = await db.query(
    `INSERT INTO orders (user_id, total_amount, status)
     VALUES ($1, 498000.00, 'PAID') RETURNING id`,
    [testUserId]
  );
  testOrderPaidId = paid.rows[0].id;
  await db.query(
    `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
     VALUES ($1, 6, 2, 249000.00)`,
    [testOrderPaidId]
  );

  const cancelled = await db.query(
    `INSERT INTO orders (user_id, total_amount, status)
     VALUES ($1, 99000.00, 'CANCELLED') RETURNING id`,
    [testUserId]
  );
  testOrderCancelledId = cancelled.rows[0].id;
  await db.query(
    `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
     VALUES ($1, 11, 1, 99000.00)`,
    [testOrderCancelledId]
  );
});

afterAll(async () => {
  // Hapus user test → orders & order_items ikut ter-cascade (ON DELETE CASCADE).
  await db.query("DELETE FROM users WHERE email LIKE 'orders-test-%@bytecommerce.test'");
  // Teardown bersih: tutup Redis (dibuat via require-chain app.js) & pool PG
  // agar jest tidak menggantung pada open handles.
  await redis.quit();
  await db.pool.end();
});

describe('GET /api/orders (list)', () => {
  it('requires authentication -> 401', async () => {
    const res = await request(app).get('/api/orders');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTHENTICATION_FAILED');
  });

  it('returns only own orders with pagination shape', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('orders');
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('page');
    expect(res.body.data).toHaveProperty('totalPages');
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.total).toBe(3); // seed: 3 order Budi
    expect(res.body.data.totalPages).toBe(1);
    expect(res.body.data.orders.length).toBe(3);

    for (const o of res.body.data.orders) {
      expect(o.user_id).toBe(2); // Budi
      expect(o).toHaveProperty('item_count');
      expect(o.item_count).toBeGreaterThan(0);
      expect(typeof o.total_amount).toBe('number');
    }
  });

  it('respects page & limit', async () => {
    const res = await request(app)
      .get('/api/orders?page=1&limit=2')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orders.length).toBe(2);
    expect(res.body.data.totalPages).toBe(2);

    const res2 = await request(app)
      .get('/api/orders?page=2&limit=2')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res2.status).toBe(200);
    expect(res2.body.data.orders.length).toBe(1);
  });

  it('validates page/limit (limit > 100 -> 400)', async () => {
    const res = await request(app)
      .get('/api/orders?limit=101')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('filters by status (PAID)', async () => {
    const res = await request(app)
      .get('/api/orders?status=PAID')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(3); // semua seed Budi berstatus PAID
    for (const o of res.body.data.orders) {
      expect(o.status).toBe('PAID');
    }
  });

  it('rejects invalid status -> 400', async () => {
    const res = await request(app)
      .get('/api/orders?status=BOGUS')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('status filter works for a fresh user (PAID -> 1, CANCELLED -> 1)', async () => {
    const paid = await request(app)
      .get('/api/orders?status=PAID')
      .set('Authorization', `Bearer ${testToken}`);

    expect(paid.status).toBe(200);
    expect(paid.body.data.total).toBe(1);
    expect(paid.body.data.orders[0].id).toBe(testOrderPaidId);

    const cancelled = await request(app)
      .get('/api/orders?status=CANCELLED')
      .set('Authorization', `Bearer ${testToken}`);

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.total).toBe(1);
    expect(cancelled.body.data.orders[0].id).toBe(testOrderCancelledId);
  });

  it('admin sees ALL orders including other users orders', async () => {
    const res = await request(app)
      .get('/api/orders?limit=100')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThanOrEqual(5); // 3 Budi + 2 user test
    const ids = res.body.data.orders.map((o) => o.id);
    expect(ids).toContain(testOrderPaidId);
    expect(ids).toContain(testOrderCancelledId);

    // Order milik Budi tetap tepat 3.
    const budiOrders = res.body.data.orders.filter((o) => o.user_id === 2);
    expect(budiOrders.length).toBe(3);
  });
});

describe('GET /api/orders/:id (detail)', () => {
  it('requires authentication -> 401', async () => {
    const res = await request(app).get('/api/orders/1');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTHENTICATION_FAILED');
  });

  it('returns own order with items including product name', async () => {
    const res = await request(app)
      .get('/api/orders/1')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(1);
    expect(res.body.data.user_id).toBe(2);
    expect(res.body.data.status).toBe('PAID');
    expect(res.body.data.total_amount).toBe(899000);
    expect(res.body.data.items).toBeDefined();
    expect(res.body.data.items.length).toBeGreaterThan(0);

    // Seed order 1: 1x Smartwatch X100 (harga flash).
    const item = res.body.data.items[0];
    expect(item.name).toBe('Smartwatch X100');
    expect(item.quantity).toBe(1);
    expect(item.price_at_purchase).toBe(899000);
    expect(item.subtotal).toBe(899000);
  });

  it('returns 404 for another user order (non-admin)', async () => {
    // Order milik user test — Budi tidak boleh lihat (404 sama, tanpa info leak).
    const res = await request(app)
      .get(`/api/orders/${testOrderPaidId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ORDER_NOT_FOUND');
  });

  it('returns 404 for nonexistent order', async () => {
    const res = await request(app)
      .get('/api/orders/999999')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('ORDER_NOT_FOUND');
  });

  it('non-numeric id -> 400 (no crash)', async () => {
    const res = await request(app)
      .get('/api/orders/abc')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('admin can view another user order', async () => {
    const res = await request(app)
      .get(`/api/orders/${testOrderPaidId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(testOrderPaidId);
    expect(res.body.data.user_id).toBe(testUserId);
    expect(res.body.data.items[0].name).toBe('Kemeja Oxford Premium');
  });
});
