// P8 — Admin module integration tests (dashboard metrics).
// Supertest langsung terhadap app (in-process); DB dari stack Docker.
// Endpoint admin murni baca PostgreSQL (Redis tidak dipakai).
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const redis = require('../src/config/redis');

const ADMIN_EMAIL = 'admin@bytecommerce.com';
const PASSWORD = 'Admin@123';

let adminToken;
let userToken; // user non-admin (test)

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  return res.body.data.token;
}

beforeAll(async () => {
  adminToken = await login(ADMIN_EMAIL);

  // User non-admin baru (dibersihkan di afterAll).
  const email = `admin-test-${Date.now()}@bytecommerce.test`;
  const signupRes = await request(app).post('/api/auth/signup').send({
    name: 'Admin Tester',
    email,
    password: PASSWORD,
  });
  expect(signupRes.status).toBe(201);
  userToken = await login(email);
});

afterAll(async () => {
  await db.query("DELETE FROM users WHERE email LIKE 'admin-test-%@bytecommerce.test'");
  // Teardown bersih: tutup Redis (dibuat via require-chain app.js) & pool PG.
  await redis.quit();
  await db.pool.end();
});

describe('GET /api/admin/dashboard', () => {
  it('requires authentication -> 401', async () => {
    const res = await request(app).get('/api/admin/dashboard');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTHENTICATION_FAILED');
  });

  it('rejects non-admin user -> 403', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('admin gets dashboard metrics (values bounded by DB snapshots)', async () => {
    // Jest menjalankan file test secara PARALEL (worker per file). File lain
    // (products/flashsale) membuat & menghapus produk/order sementara, sehingga
    // hitungan bisa berubah antar-query. Solusi deterministik: snapshot sebelum
    // dan sesudah panggilan API, lalu pastikan nilai API berada dalam rentangnya.
    const count = async (sql) => {
      const r = await db.query(sql);
      return r.rows[0].total;
    };
    const snapshots = async () => ({
      totalUsers: await count('SELECT COUNT(*)::int AS total FROM users'),
      totalProducts: await count('SELECT COUNT(*)::int AS total FROM products'),
      ordersToday: await count(
        'SELECT COUNT(*)::int AS total FROM orders WHERE created_at >= CURRENT_DATE'
      ),
      flashSaleActiveCount: await count(
        'SELECT COUNT(*)::int AS total FROM products WHERE is_flash_sale = TRUE'
      ),
    });

    const before = await snapshots();

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.metrics).toBeDefined();

    const m = res.body.data.metrics;
    const after = await snapshots();

    const check = (actual, key) => {
      expect(typeof actual).toBe('number');
      const low = Math.min(before[key], after[key]);
      const high = Math.max(before[key], after[key]);
      expect(actual).toBeGreaterThanOrEqual(low);
      expect(actual).toBeLessThanOrEqual(high);
    };
    check(m.totalUsers, 'totalUsers');
    check(m.totalProducts, 'totalProducts');
    check(m.ordersToday, 'ordersToday');
    check(m.flashSaleActiveCount, 'flashSaleActiveCount');

    // Baseline seed (DB bersih): >= 2 user, >= 13 produk, >= 5 flash sale aktif.
    expect(m.totalUsers).toBeGreaterThanOrEqual(2);
    expect(m.totalProducts).toBeGreaterThanOrEqual(13);
    expect(m.ordersToday).toBeGreaterThanOrEqual(0);
    expect(m.flashSaleActiveCount).toBeGreaterThanOrEqual(5);
  });

  it('recentOrders is an array of max 10 with user info & numeric total', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const recentOrders = res.body.data.metrics.recentOrders;
    expect(Array.isArray(recentOrders)).toBe(true);
    expect(recentOrders.length).toBeLessThanOrEqual(10);

    if (recentOrders.length > 0) {
      for (const o of recentOrders) {
        expect(typeof o.id).toBe('number');
        expect(o.user).toBeDefined();
        expect(typeof o.user.id).toBe('number');
        expect(typeof o.user.name).toBe('string');
        expect(typeof o.user.email).toBe('string');
        expect(typeof o.total_amount).toBe('number');
        expect(typeof o.status).toBe('string');
        expect(o.created_at).toBeDefined();
      }
    }
  });
});
