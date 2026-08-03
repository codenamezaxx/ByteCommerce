// P3 — Auth module integration tests.
// Supertest langsung terhadap app (in-process); DB & Redis berasal dari stack Docker
// (DATABASE_URL/ REDIS_URL di .env mengarah ke localhost:5432 / localhost:6379 yang dipublish compose).
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');

const TEST_EMAIL = `test-signup-${Date.now()}@bytecommerce.test`;
const TEST_PASSWORD = 'Password123!';

describe('Auth Module', () => {
  afterAll(async () => {
    await db.query('DELETE FROM users WHERE email = $1', [TEST_EMAIL]);
    await db.pool.end();
  });

  describe('POST /api/auth/signup', () => {
    it('creates a user -> 201, no password_hash, role USER', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Test User', email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('User registered successfully');
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.email).toBe(TEST_EMAIL);
      expect(res.body.data.name).toBe('Test User');
      expect(res.body.data.role).toBe('USER');
      expect(res.body.data.created_at).toBeDefined();
      expect(res.body.data.password_hash).toBeUndefined();
    });

    it('duplicate email -> 409 EMAIL_ALREADY_REGISTERED', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Dup User', email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('empty name -> 400 VALIDATION_ERROR with field errors', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: '', email: 'valid@bytecommerce.test', password: TEST_PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'name' }));
    });

    it('invalid email -> 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Test User', email: 'not-an-email', password: TEST_PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'email' }));
    });

    it('short password -> 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Test User', email: 'valid@bytecommerce.test', password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors).toContainEqual(expect.objectContaining({ field: 'password' }));
    });
  });

  describe('POST /api/auth/login', () => {
    it('valid credentials -> 200 + user + token + httpOnly cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe(TEST_EMAIL);
      expect(res.body.data.user.role).toBe('USER');
      expect(res.body.data.user.password_hash).toBeUndefined();

      const setCookie = res.headers['set-cookie'] || [];
      const tokenCookie = setCookie.find((c) => c.startsWith('token='));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toContain('HttpOnly');
      expect(tokenCookie).toContain('SameSite=Strict');
      expect(tokenCookie).toMatch(/Max-Age=604800/);
      // Non-production -> cookie tidak Secure.
      expect(tokenCookie).not.toContain('Secure');
    });

    it('wrong password -> 401 INVALID_CREDENTIALS', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('unknown user -> 401 INVALID_CREDENTIALS (same as wrong password)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: `nobody-${Date.now()}@bytecommerce.test`, password: 'Whatever123!' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('missing fields -> 400 VALIDATION_ERROR', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: '', password: '' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('seed admin login (bcrypt cost 10 hash) -> 200 role ADMIN', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@bytecommerce.com', password: 'Admin@123' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('admin@bytecommerce.com');
      expect(res.body.data.user.role).toBe('ADMIN');
    });

    it('login with X-Guest-ID header -> 200 (cart merge guard skips gracefully)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Guest-ID', '11111111-2222-4333-8444-555555555555')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    it('no token -> 401 AUTHENTICATION_FAILED', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTHENTICATION_FAILED');
    });

    it('valid Bearer token -> 200 with fresh profile from DB', async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
      const token = login.body.data.token;

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(TEST_EMAIL);
      expect(res.body.data.name).toBe('Test User');
      expect(res.body.data.password_hash).toBeUndefined();
    });

    it('valid token via httpOnly cookie -> 200', async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
      const token = login.body.data.token;

      const res = await request(app).get('/api/auth/me').set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(TEST_EMAIL);
    });

    it('invalid token -> 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer garbage.token');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears the token cookie -> 200', async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
      const token = login.body.data.token;

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Logged out successfully');

      const setCookie = res.headers['set-cookie'] || [];
      const cleared = setCookie.find((c) => c.startsWith('token='));
      expect(cleared).toBeDefined();
      expect(cleared).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
    });

    it('without token -> 401', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(401);
    });
  });
});
