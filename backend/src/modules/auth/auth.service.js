// P3.3 — Auth service: logika bisnis auth.
// Semua query wajib parameterized ($1, $2, ...). Tanpa ORM.
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const config = require('../../config/env');
const {
  AuthenticationError,
  ConflictError,
  NotFoundError,
} = require('../../utils/CustomError');

const BCRYPT_SALT_ROUNDS = 10;

function toSafeUser(user) {
  if (!user) return null;
  const safe = { ...user };
  delete safe.password_hash;
  return safe;
}

class AuthService {
  static async signup({ name, email, password }) {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // Pre-check duplikat dengan row lock (FOR UPDATE) — aman saat concurrent signup.
    const dupCheck = await db.query(
      'SELECT id FROM users WHERE email = $1 FOR UPDATE',
      [normalizedEmail]
    );
    if (dupCheck.rowCount > 0) {
      throw new ConflictError('Email already registered', [], 'EMAIL_ALREADY_REGISTERED');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    try {
      const result = await db.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, role, created_at`,
        [normalizedName, normalizedEmail, passwordHash, 'USER']
      );
      return toSafeUser(result.rows[0]);
    } catch (err) {
      // Safety net untuk race condition di luar FOR UPDATE (UNIQUE constraint email).
      if (err && err.code === '23505') {
        throw new ConflictError('Email already registered', [], 'EMAIL_ALREADY_REGISTERED');
      }
      throw err;
    }
  }

  static async login({ email, password, guestId }) {
    const normalizedEmail = email.trim().toLowerCase();

    const result = await db.query(
      'SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = $1',
      [normalizedEmail]
    );
    const user = result.rows[0];

    // Pesan & code identik untuk user-not-found vs wrong-password (anti user enumeration).
    const invalidCreds = () =>
      new AuthenticationError('Invalid email or password', [], 'INVALID_CREDENTIALS');

    if (!user) {
      throw invalidCreds();
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      throw invalidCreds();
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn || '7d' }
    );

    // Cart merging trigger — best-effort & lazy. Jangan pernah gagalkan login.
    if (guestId) {
      await AuthService.triggerCartMerge(guestId, user.id);
    }

    return { user: toSafeUser(user), token };
  }

  // Dipanggil hanya bila ada guest_id. Lazy require: modul cart belum tentu ada (Phase 5).
  static async triggerCartMerge(guestId, userId) {
    try {
      const cartService = require('../cart/cart.service');
      if (cartService && typeof cartService.mergeGuestCart === 'function') {
        console.log(`[auth] Merging guest cart ${guestId} into user ${userId}`);
        await cartService.mergeGuestCart(guestId, userId);
      } else {
        console.log('[auth] CartService.mergeGuestCart not available yet — skipping cart merge');
      }
    } catch (err) {
      console.log('[auth] Cart merge skipped (module not ready):', err.message);
    }
  }

  static async getProfile(userId) {
    const result = await db.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [userId]
    );
    const user = result.rows[0];
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return toSafeUser(user);
  }
}

module.exports = AuthService;
