// P8.1 — Admin routes.
// Mounted at /api/admin (see src/app.js routeModules).
// Note: flash sale warmup/killswitch ADMIN sudah ada di flashsale.routes.js
// (`/api/admin/flashsale/*`) — TIDAK diduplikasi di sini.
const express = require('express');
const asyncWrapper = require('../../utils/asyncWrapper');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const adminController = require('./admin.controller');

const router = express.Router();

// authenticate memverifikasi token lalu requireAdmin memeriksa role ADMIN.
router.get('/dashboard', authenticate, requireAdmin, asyncWrapper(adminController.dashboard));

module.exports = router;
