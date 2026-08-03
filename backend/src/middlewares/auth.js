// P2.2 — JWT authentication middlewares.
// Token sources (in order): httpOnly cookie `token`, then `Authorization: Bearer <token>`.
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { AuthenticationError, ForbiddenError } = require('../utils/CustomError');

function extractToken(req) {
  if (req.cookies && typeof req.cookies.token === 'string' && req.cookies.token.length > 0) {
    return req.cookies.token;
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    return token.length > 0 ? token : null;
  }
  return null;
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

function buildUserFromPayload(payload) {
  return {
    id: payload.id,
    email: payload.email,
    role: payload.role,
  };
}

// Wajib login — reject invalid/expired token.
function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return next(new AuthenticationError('Authentication required'));
  }
  try {
    req.user = buildUserFromPayload(verifyToken(token));
    return next();
  } catch (err) {
    if (err && err.name === 'TokenExpiredError') {
      return next(new AuthenticationError('Session expired, please login again'));
    }
    return next(new AuthenticationError('Invalid authentication token'));
  }
}

// Inject user jika token valid; lanjutkan sebagai anonim jika tidak.
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    req.user = buildUserFromPayload(verifyToken(token));
  } catch (err) {
    req.user = null;
  }
  return next();
}

// Wajib req.user dengan role ADMIN.
function requireAdmin(req, res, next) {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required'));
  }
  if (req.user.role !== 'ADMIN') {
    return next(new ForbiddenError('Admin access required'));
  }
  return next();
}

module.exports = { authenticate, optionalAuth, requireAdmin, extractToken };
