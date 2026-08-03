// P3.1 — Auth routes.
// Mounted at /api/auth (see src/app.js routeModules).
const express = require('express');
const asyncWrapper = require('../../utils/asyncWrapper');
const { authenticate } = require('../../middlewares/auth');
const guestTracker = require('../../middlewares/guestTracker');
const authController = require('./auth.controller');

const router = express.Router();

// --- Public routes -----------------------------------------------------------
// guestTracker dipasang agar req.guestId tersedia untuk cart merging saat login.
router.post('/signup', guestTracker, asyncWrapper(authController.signup));
router.post('/login', guestTracker, asyncWrapper(authController.login));

// --- Protected routes ---------------------------------------------------------
router.post('/logout', authenticate, asyncWrapper(authController.logout));
router.get('/me', authenticate, asyncWrapper(authController.me));

module.exports = router;
