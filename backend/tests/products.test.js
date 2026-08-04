// P4 — Product module integration tests.
// Supertest langsung terhadap app (in-process); DB & Redis berasal dari stack Docker.
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const storageService = require('../src/modules/products/storage.service');

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
        category: 'Aksesoris',
        price: 50000,
        stock: 25,
        is_flash_sale: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe(TEST_PRODUCT_NAME);
    expect(res.body.data.description).toBe('Test product description');
    expect(res.body.data.category).toBe('Aksesoris');
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
        category: 'Elektronik',
        price: 100000,
        stock: 5,
        is_flash_sale: true,
        flash_sale_price: 70000,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.is_flash_sale).toBe(true);
    expect(res.body.data.flash_sale_price).toBe(70000);
    expect(res.body.data.category).toBe('Elektronik');
  });

  it('rejects create without category -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'No Category', price: 100, stock: 1 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'category' }));
  });

  it('rejects category longer than 50 chars -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Long Category', category: 'x'.repeat(51), price: 100, stock: 1 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'category' }));
  });

  it('rejects empty name -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '', category: 'Aksesoris', price: 100, stock: 1 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'name' }));
  });

  it('rejects price 0 -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Zero Price', category: 'Aksesoris', price: 0, stock: 1 });

    expect(res.status).toBe(400);
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'price' }));
  });

  it('rejects flash_sale without flash_sale_price -> 400', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'FS No Price', category: 'Elektronik', price: 100, stock: 1, is_flash_sale: true });

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

  it('updates category as admin -> 200 and persisted', async () => {
    const res = await request(app)
      .put(`/api/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ category: 'Elektronik' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdProductId);
    expect(res.body.data.category).toBe('Elektronik');

    // Pastikan tersimpan di DB (bukan hanya di respons).
    const dbCheck = await db.query('SELECT category FROM products WHERE id = $1', [createdProductId]);
    expect(dbCheck.rows[0].category).toBe('Elektronik');
  });

  it('rejects empty category on update -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .put(`/api/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ category: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'category' }));
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

describe('Product image upload/delete (POST & DELETE /api/admin/products/:id/image)', () => {
  // PNG 1x1 valid — cukup untuk menguji alur upload (bukan parsing gambar).
  const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  );
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

  let imageProductId;
  const uploadedKeys = [];

  beforeAll(async () => {
    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `${TEST_PRODUCT_NAME} Image`, category: 'Aksesoris', price: 20000, stock: 3 });
    expect(created.status).toBe(201);
    imageProductId = created.body.data.id;
  });

  afterAll(async () => {
    // Hapus semua file upload yang dibuat test (baris produk dibersihkan oleh
    // afterAll tingkat atas via pola nama 'Test Product%').
    for (const key of uploadedKeys) {
      try {
        await storageService.remove(key);
      } catch (err) {
        // ignore
      }
    }
    const row = await db.query('SELECT image_url FROM products WHERE id = $1', [imageProductId]);
    if (row.rows[0] && row.rows[0].image_url) {
      try {
        await storageService.remove(row.rows[0].image_url);
      } catch (err) {
        // ignore
      }
    }
  });

  it('rejects upload without auth -> 401', async () => {
    const res = await request(app)
      .post(`/api/admin/products/${imageProductId}/image`)
      .attach('image', TINY_PNG, { filename: 'noauth.png', contentType: 'image/png' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTHENTICATION_FAILED');
  });

  it('rejects non-admin user -> 403', async () => {
    const res = await request(app)
      .post(`/api/admin/products/${imageProductId}/image`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('image', TINY_PNG, { filename: 'forbidden.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('uploads image as admin -> 201 with public image_url and file on disk', async () => {
    const res = await request(app)
      .post(`/api/admin/products/${imageProductId}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', TINY_PNG, { filename: 'test.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.image_url).toMatch(/^\/uploads\/products\/.+\.png$/);

    // Key (nama file) tersimpan di DB.
    const dbCheck = await db.query('SELECT image_url FROM products WHERE id = $1', [imageProductId]);
    const key = dbCheck.rows[0].image_url;
    expect(key).toMatch(/^products\/[0-9a-f-]{36}\.png$/);
    uploadedKeys.push(key);

    // File benar-benar ada di disk di bawah uploads/products.
    expect(fs.existsSync(path.join(storageService.UPLOAD_ROOT, key))).toBe(true);

    // Respons list/detail juga mengekspos image_url publik.
    const detail = await request(app).get(`/api/products/${imageProductId}`);
    expect(detail.body.data.image_url).toBe(res.body.data.image_url);
  });

  it('rejects disallowed MIME -> 400 IMAGE_TYPE_NOT_ALLOWED', async () => {
    const res = await request(app)
      .post(`/api/admin/products/${imageProductId}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', Buffer.from('plain text'), { filename: 'evil.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('IMAGE_TYPE_NOT_ALLOWED');
  });

  it('rejects file larger than 5MB -> 413 IMAGE_TOO_LARGE', async () => {
    const big = Buffer.alloc(MAX_IMAGE_SIZE + 1);
    const res = await request(app)
      .post(`/api/admin/products/${imageProductId}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', big, { filename: 'big.png', contentType: 'image/png' });

    expect(res.status).toBe(413);
    expect(res.body.code).toBe('IMAGE_TOO_LARGE');
  });

  it('returns 404 for unknown product id', async () => {
    const res = await request(app)
      .post('/api/admin/products/999999/image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', TINY_PNG, { filename: 'ghost.png', contentType: 'image/png' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('replaces existing image and removes the old file', async () => {
    // Ambil key lama dari DB.
    const before = await db.query('SELECT image_url FROM products WHERE id = $1', [imageProductId]);
    const oldKey = before.rows[0].image_url;
    expect(oldKey).toBeTruthy();

    const res = await request(app)
      .post(`/api/admin/products/${imageProductId}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', TINY_PNG, { filename: 'new.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.data.image_url).not.toBe(`/uploads/products/${oldKey}`);

    // File lama harus sudah terhapus; file baru harus ada.
    expect(fs.existsSync(path.join(storageService.UPLOAD_ROOT, oldKey))).toBe(false);
    const after = await db.query('SELECT image_url FROM products WHERE id = $1', [imageProductId]);
    const newKey = after.rows[0].image_url;
    expect(fs.existsSync(path.join(storageService.UPLOAD_ROOT, newKey))).toBe(true);
    uploadedKeys.push(newKey);
  });

  it('deletes image -> 200, image_url null, file removed', async () => {
    const before = await db.query('SELECT image_url FROM products WHERE id = $1', [imageProductId]);
    const key = before.rows[0].image_url;
    expect(key).toBeTruthy();

    const res = await request(app)
      .delete(`/api/admin/products/${imageProductId}/image`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.image_url).toBe(null);

    const dbCheck = await db.query('SELECT image_url FROM products WHERE id = $1', [imageProductId]);
    expect(dbCheck.rows[0].image_url).toBe(null);
    expect(fs.existsSync(path.join(storageService.UPLOAD_ROOT, key))).toBe(false);
  });

  it('deletes image on product with no image -> 200 no-op', async () => {
    const res = await request(app)
      .delete(`/api/admin/products/${imageProductId}/image`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.image_url).toBe(null);
  });
});
