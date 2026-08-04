// P4 — Product module integration tests.
// Supertest langsung terhadap app (in-process); DB & Redis berasal dari stack Docker.
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');

const ADMIN_EMAIL = 'admin@bytecommerce.com';
const USER_EMAIL = 'budi@example.com';
const PASSWORD = 'Admin@123';

let adminToken;
let userToken;
let createdProductId;
const TEST_PRODUCT_NAME = `Test Product ${Date.now()}`;

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  return res.body.data.token;
}

beforeAll(async () => {
  adminToken = await login(ADMIN_EMAIL);
  userToken = await login(USER_EMAIL);
});

afterAll(async () => {
  // Nama test product: "Test Product <timestamp>" dan "Test Product <timestamp> FS" (pakai spasi, bukan hyphen).
  await db.query("DELETE FROM products WHERE name LIKE 'Test Product%'");
  await db.pool.end();
});

describe('GET /api/products (list)', () => {
  it('returns paginated list with correct shape', async () => {
    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('products');
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('page');
    expect(res.body.data).toHaveProperty('totalPages');
    expect(res.body.data.page).toBe(1);
    expect(Array.isArray(res.body.data.products)).toBe(true);
    expect(res.body.data.products.length).toBeGreaterThan(0);
    expect(res.body.data.products.length).toBeLessThanOrEqual(10);
    expect(res.body.data.totalPages).toBe(Math.ceil(res.body.data.total / 10));

    const p = res.body.data.products[0];
    expect(p).toHaveProperty('id');
    expect(p).toHaveProperty('name');
    expect(p).toHaveProperty('description');
    expect(p).toHaveProperty('price');
    expect(p).toHaveProperty('stock');
    expect(p).toHaveProperty('is_flash_sale');
    expect(p).toHaveProperty('flash_sale_price');
    expect(typeof p.price).toBe('number');
  });

  it('respects page and limit', async () => {
    const res = await request(app).get('/api/products?page=2&limit=3');

    expect(res.status).toBe(200);
    expect(res.body.data.page).toBe(2);
    expect(res.body.data.products.length).toBeLessThanOrEqual(3);
  });

  it('filters by search (ILIKE)', async () => {
    const res = await request(app).get('/api/products?search=earbuds');

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThan(0);
    for (const p of res.body.data.products) {
      expect(p.name.toLowerCase()).toContain('earbuds');
    }
  });

  it('filters flash_sale=true -> only flash sale products', async () => {
    const res = await request(app).get('/api/products?flash_sale=true');

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThan(0);
    for (const p of res.body.data.products) {
      expect(p.is_flash_sale).toBe(true);
    }
  });

  it('filters by category -> only products of that category', async () => {
    const res = await request(app).get('/api/products?category=Elektronik');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBeGreaterThan(0);
    for (const p of res.body.data.products) {
      expect(p.category).toBe('Elektronik');
    }
  });

  it('rejects category longer than 100 chars -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app).get(`/api/products?category=${'x'.repeat(101)}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'category' }));
  });

  it('filters min_price (regular price)', async () => {
    const res = await request(app).get('/api/products?min_price=1000000');

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThan(0);
    for (const p of res.body.data.products) {
      expect(p.price).toBeGreaterThanOrEqual(1000000);
    }
  });

  it('filters max_price (regular price)', async () => {
    const res = await request(app).get('/api/products?max_price=200000');

    expect(res.status).toBe(200);
    for (const p of res.body.data.products) {
      expect(p.price).toBeLessThanOrEqual(200000);
    }
  });

  it('rejects invalid page -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app).get('/api/products?page=0');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid flash_sale -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app).get('/api/products?flash_sale=maybe');

    expect(res.status).toBe(400);
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'flash_sale' }));
  });
});

describe('GET /api/products/:id (detail)', () => {
  it('returns product detail -> 200', async () => {
    const res = await request(app).get('/api/products/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(1);
    expect(res.body.data.name).toBe('Smartwatch X100');
    expect(typeof res.body.data.price).toBe('number');
  });

  it('returns 404 PRODUCT_NOT_FOUND for unknown id', async () => {
    const res = await request(app).get('/api/products/999999');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('rejects non-integer id -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app).get('/api/products/abc');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/products (create)', () => {
  it('rejects without token -> 401', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'No Token', price: 100, stock: 1 });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTHENTICATION_FAILED');
  });

  it('rejects non-admin user -> 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Not Admin', price: 100, stock: 1 });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('creates product as admin -> 201 with RETURNING data', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: TEST_PRODUCT_NAME,
        description: 'Test product description',
        price: 50000,
        stock: 25,
        is_flash_sale: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe(TEST_PRODUCT_NAME);
    expect(res.body.data.description).toBe('Test product description');
    expect(res.body.data.price).toBe(50000);
    expect(res.body.data.stock).toBe(25);
    expect(res.body.data.is_flash_sale).toBe(false);
    expect(res.body.data.flash_sale_price).toBe(null);
    expect(res.body.data.created_at).toBeDefined();
    createdProductId = res.body.data.id;
  });

  it('creates flash sale product with flash_sale_price -> 201', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `${TEST_PRODUCT_NAME} FS`,
        price: 100000,
        stock: 5,
        is_flash_sale: true,
        flash_sale_price: 70000,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.is_flash_sale).toBe(true);
    expect(res.body.data.flash_sale_price).toBe(70000);
  });

  it('rejects empty name -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '', price: 100, stock: 1 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'name' }));
  });

  it('rejects price 0 -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Zero Price', price: 0, stock: 1 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'price' }));
  });

  it('rejects flash_sale without flash_sale_price -> 400', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'FS No Price', price: 100, stock: 1, is_flash_sale: true });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContainEqual(
      expect.objectContaining({ field: 'flash_sale_price' })
    );
  });
});

describe('PUT /api/products/:id (update)', () => {
  it('updates fields as admin -> 200', async () => {
    const res = await request(app)
      .put(`/api/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 55000, stock: 30 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdProductId);
    expect(res.body.data.price).toBe(55000);
    expect(res.body.data.stock).toBe(30);
    expect(res.body.data.name).toBe(TEST_PRODUCT_NAME);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .put('/api/products/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 100 });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('rejects invalid price -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .put(`/api/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: -5 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'price' }));
  });
});

describe('DELETE /api/products/:id (remove)', () => {
  it('deletes created product -> 200, then detail 404', async () => {
    const res = await request(app)
      .delete(`/api/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const check = await request(app).get(`/api/products/${createdProductId}`);
    expect(check.status).toBe(404);
  });

  it('returns 409 PRODUCT_IN_USE for product referenced by order_items (id 1)', async () => {
    const res = await request(app)
      .delete('/api/products/1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PRODUCT_IN_USE');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .delete('/api/products/999999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });
});
