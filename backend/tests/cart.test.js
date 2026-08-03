// P5 — Cart module integration tests.
// Supertest langsung terhadap app (in-process); DB & Redis berasal dari stack Docker.
const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const app = require('../src/app');
const db = require('../src/config/db');

const TEST_PASSWORD = 'Password123!';
const ts = Date.now();
const CART_USER_EMAIL = `cart-test-user-${ts}@bytecommerce.test`;
const MERGE_USER_EMAIL = `cart-test-merge-${ts}@bytecommerce.test`;
const LOGIN_USER_EMAIL = `cart-test-login-${ts}@bytecommerce.test`;

let cartUserToken;
let mergeUserToken;
let loginUserToken;
let outOfStockProductId;
const guestIds = [];

async function signupAndLogin(email) {
  await request(app)
    .post('/api/auth/signup')
    .send({ name: 'Cart Test User', email, password: TEST_PASSWORD });
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email, password: TEST_PASSWORD });
  return login.body.data.token;
}

beforeAll(async () => {
  cartUserToken = await signupAndLogin(CART_USER_EMAIL);
  mergeUserToken = await signupAndLogin(MERGE_USER_EMAIL);
  loginUserToken = await signupAndLogin(LOGIN_USER_EMAIL);
});

afterAll(async () => {
  // Hapus cart guest test (cart_items ikut terhapus via CASCADE).
  for (const gid of guestIds) {
    await db.query('DELETE FROM carts WHERE guest_id = $1', [gid]);
  }
  // Hapus user test (carts + cart_items user ikut terhapus via CASCADE).
  await db.query("DELETE FROM users WHERE email LIKE 'cart-test-%@bytecommerce.test'");
  // Hapus produk stok-0 untuk test OUT_OF_STOCK.
  await db.query("DELETE FROM products WHERE name LIKE 'Cart Test Product%'");
  await db.pool.end();
});

describe('Guest cart flow', () => {
  const guestId = uuidv4();
  guestIds.push(guestId);
  let itemId;

  it('GET /api/cart with X-Guest-ID creates an empty cart -> 200', async () => {
    const res = await request(app).get('/api/cart').set('X-Guest-ID', guestId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cart.id).toBeDefined();
    expect(res.body.data.cart.guest_id).toBe(guestId);
    expect(res.body.data.cart.user_id).toBe(null);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it('POST /api/cart/items adds item -> 201', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('X-Guest-ID', guestId)
      .send({ productId: 3, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.product_id).toBe(3);
    expect(res.body.data.quantity).toBe(2);
    itemId = res.body.data.id;
  });

  it('GET /api/cart shows item with subtotal using effective (flash) price', async () => {
    const res = await request(app).get('/api/cart').set('X-Guest-ID', guestId);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    const item = res.body.data.items[0];
    expect(item.id).toBe(itemId);
    expect(item.product_id).toBe(3);
    expect(item.quantity).toBe(2);
    expect(item.name).toBeDefined();
    expect(item.is_flash_sale).toBeDefined();
    const effectivePrice =
      item.is_flash_sale && item.flash_sale_price !== null ? item.flash_sale_price : item.price;
    expect(item.subtotal).toBeCloseTo(effectivePrice * 2, 2);
    expect(res.body.data.total).toBeCloseTo(item.subtotal, 2);
  });

  it('POST same product upserts quantity (2 + 3 = 5)', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('X-Guest-ID', guestId)
      .send({ productId: 3, quantity: 3 });

    expect(res.status).toBe(201);
    expect(res.body.data.quantity).toBe(5);

    const cart = await request(app).get('/api/cart').set('X-Guest-ID', guestId);
    expect(cart.body.data.items[0].quantity).toBe(5);
    expect(cart.body.data.total).toBeCloseTo(cart.body.data.items[0].subtotal, 2);
  });

  it('PATCH updates quantity -> 200', async () => {
    const res = await request(app)
      .patch(`/api/cart/items/${itemId}`)
      .set('X-Guest-ID', guestId)
      .send({ quantity: 4 });

    expect(res.status).toBe(200);
    expect(res.body.data.quantity).toBe(4);
    expect(res.body.data.id).toBe(itemId);
  });

  it('PATCH with quantity 0 -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .patch(`/api/cart/items/${itemId}`)
      .set('X-Guest-ID', guestId)
      .send({ quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'quantity' }));
  });

  it('POST with string productId -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('X-Guest-ID', guestId)
      .send({ productId: 'abc', quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'productId' }));
  });

  it('POST with quantity 0 -> 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('X-Guest-ID', guestId)
      .send({ productId: 3, quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'quantity' }));
  });

  it('POST with unknown product -> 404 PRODUCT_NOT_FOUND', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('X-Guest-ID', guestId)
      .send({ productId: 999999, quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('DELETE removes item -> 200, cart empty after', async () => {
    const res = await request(app)
      .delete(`/api/cart/items/${itemId}`)
      .set('X-Guest-ID', guestId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const cart = await request(app).get('/api/cart').set('X-Guest-ID', guestId);
    expect(cart.body.data.items).toHaveLength(0);
    expect(cart.body.data.total).toBe(0);
  });

  it('DELETE again -> 404 CART_ITEM_NOT_FOUND', async () => {
    const res = await request(app)
      .delete(`/api/cart/items/${itemId}`)
      .set('X-Guest-ID', guestId);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CART_ITEM_NOT_FOUND');
  });
});

describe('User cart flow (JWT)', () => {
  it('GET /api/cart with token -> user cart (XOR: user_id set, guest_id null)', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${cartUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.cart.user_id).toBeDefined();
    expect(res.body.data.cart.guest_id).toBe(null);
    expect(res.body.data.items).toEqual([]);
  });

  it('user adds item to own cart -> 201', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${cartUserToken}`)
      .send({ productId: 8, quantity: 1 });

    expect(res.status).toBe(201);
    const cart = await request(app).get('/api/cart').set('Authorization', `Bearer ${cartUserToken}`);
    expect(cart.body.data.items).toHaveLength(1);
    expect(cart.body.data.items[0].product_id).toBe(8);
  });
});

describe('Manual merge (POST /api/cart/merge)', () => {
  const mergeGuest = uuidv4();
  guestIds.push(mergeGuest);

  beforeAll(async () => {
    // Guest cart: product 5 qty 2.
    await request(app)
      .post('/api/cart/items')
      .set('X-Guest-ID', mergeGuest)
      .send({ productId: 5, quantity: 2 });
    // User cart: product 5 qty 5 + product 6 qty 1.
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${mergeUserToken}`)
      .send({ productId: 5, quantity: 5 });
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${mergeUserToken}`)
      .send({ productId: 6, quantity: 1 });
  });

  it('merge returns 200 with merged result', async () => {
    const res = await request(app)
      .post('/api/cart/merge')
      .set('X-Guest-ID', mergeGuest)
      .set('Authorization', `Bearer ${mergeUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.merged).toBe(true);
    expect(res.body.data.movedItems).toBe(1);
  });

  it('user cart: product 5 qty 5 (MAX of 5 & 2), product 6 qty 1 present', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${mergeUserToken}`);

    expect(res.status).toBe(200);
    const item5 = res.body.data.items.find((i) => i.product_id === 5);
    const item6 = res.body.data.items.find((i) => i.product_id === 6);
    expect(item5).toBeDefined();
    expect(item5.quantity).toBe(5);
    expect(item6).toBeDefined();
    expect(item6.quantity).toBe(1);
  });

  it('guest cart is removed (guest GET now returns empty cart)', async () => {
    const res = await request(app).get('/api/cart').set('X-Guest-ID', mergeGuest);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });
});

describe('Automatic merge on login (auth.service trigger)', () => {
  const loginGuest = uuidv4();
  guestIds.push(loginGuest);

  beforeAll(async () => {
    await request(app)
      .post('/api/cart/items')
      .set('X-Guest-ID', loginGuest)
      .send({ productId: 7, quantity: 2 });
  });

  it('login with X-Guest-ID merges guest cart into user cart', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .set('X-Guest-ID', loginGuest)
      .send({ email: LOGIN_USER_EMAIL, password: TEST_PASSWORD });

    expect(login.status).toBe(200);
    expect(login.body.success).toBe(true);

    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${loginUserToken}`);
    expect(res.status).toBe(200);
    const item7 = res.body.data.items.find((i) => i.product_id === 7);
    expect(item7).toBeDefined();
    expect(item7.quantity).toBe(2);
  });
});

describe('Stock validation', () => {
  let stockGuest;

  beforeAll(async () => {
    stockGuest = uuidv4();
    guestIds.push(stockGuest);

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@bytecommerce.com', password: 'Admin@123' });
    const adminToken = adminLogin.body.data.token;

    const created = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Cart Test Product - No Stock', price: 10000, stock: 0 });
    outOfStockProductId = created.body.data.id;
  });

  it('adding out-of-stock product -> 409 OUT_OF_STOCK', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('X-Guest-ID', stockGuest)
      .send({ productId: outOfStockProductId, quantity: 1 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('OUT_OF_STOCK');
  });
});
