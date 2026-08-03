// P3.2 — Auth controller.
// Layer ini HANYA membaca req (body/params/query/user/cookies), memanggil service,
// dan mengirim respons — TANPA SQL/Redis (AGENTS.md modular rules).
const authService = require('./auth.service');
const config = require('../../config/env');
const { ValidationError } = require('../../utils/CustomError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Nama cookie HARUS konsisten dengan extractToken() di middlewares/auth.js.
const TOKEN_COOKIE_NAME = 'token';
const TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 hari

function validateSignup(body = {}) {
  const errors = [];
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!name) errors.push({ field: 'name', message: 'Name is required' });
  else if (name.length > 100) errors.push({ field: 'name', message: 'Name must be at most 100 characters' });

  if (!email) errors.push({ field: 'email', message: 'Email is required' });
  else if (!EMAIL_REGEX.test(email)) errors.push({ field: 'email', message: 'Email format is invalid' });
  else if (email.length > 150) errors.push({ field: 'email', message: 'Email must be at most 150 characters' });

  if (!password) errors.push({ field: 'password', message: 'Password is required' });
  else if (password.length < 8) errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
  else if (password.length > 72) errors.push({ field: 'password', message: 'Password must be at most 72 characters' });

  return errors;
}

function validateLogin(body = {}) {
  const errors = [];
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email) errors.push({ field: 'email', message: 'Email is required' });
  else if (!EMAIL_REGEX.test(email)) errors.push({ field: 'email', message: 'Email format is invalid' });

  if (!password) errors.push({ field: 'password', message: 'Password is required' });

  return errors;
}

const authController = {
  signup: async (req, res) => {
    const errors = validateSignup(req.body);
    if (errors.length > 0) {
      throw new ValidationError('Signup validation failed', errors);
    }
    const user = await authService.signup(req.body);
    res.created(user, 'User registered successfully');
  },

  login: async (req, res) => {
    const errors = validateLogin(req.body);
    if (errors.length > 0) {
      throw new ValidationError('Login validation failed', errors);
    }

    const { user, token } = await authService.login({
      email: req.body.email,
      password: req.body.password,
      guestId: req.guestId,
    });

    // HTTP-Only cookie — Secure hanya saat production, SameSite=Strict, maxAge 7 hari.
    res.cookie(TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'strict',
      maxAge: TOKEN_COOKIE_MAX_AGE,
      path: '/',
    });

    res.success({ user, token }, 'Login successful');
  },

  logout: async (req, res) => {
    res.clearCookie(TOKEN_COOKIE_NAME, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'strict',
      path: '/',
    });
    res.success(null, 'Logged out successfully');
  },

  me: async (req, res) => {
    // Data FRESH dari database (bukan dari JWT payload).
    const user = await authService.getProfile(req.user.id);
    res.success(user, 'User profile fetched');
  },
};

module.exports = authController;
