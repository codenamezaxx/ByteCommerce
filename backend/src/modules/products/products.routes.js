// P4.1 — Product routes.
// Mounted at /api/products (see src/app.js routeModules).
const express = require('express');
const asyncWrapper = require('../../utils/asyncWrapper');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const productsController = require('./products.controller');

const router = express.Router();

// Public
router.get('/', asyncWrapper(productsController.list));
router.get('/:id', asyncWrapper(productsController.detail));

// Admin only — authenticate memverifikasi token lalu requireAdmin memeriksa role.
router.post('/', authenticate, requireAdmin, asyncWrapper(productsController.create));
router.put('/:id', authenticate, requireAdmin, asyncWrapper(productsController.update));
router.delete('/:id', authenticate, requireAdmin, asyncWrapper(productsController.remove));

module.exports = router;
