// P7.1 — Order routes.
// Mounted at /api/orders (see src/app.js routeModules).
const express = require('express');
const asyncWrapper = require('../../utils/asyncWrapper');
const { authenticate } = require('../../middlewares/auth');
const ordersController = require('./orders.controller');

const router = express.Router();

router.get('/', authenticate, asyncWrapper(ordersController.list));
router.get('/:id', authenticate, asyncWrapper(ordersController.detail));
// Checkout keranjang reguler (non-flash-sale) — wajib login (req.user.id).
router.post('/checkout', authenticate, asyncWrapper(ordersController.checkout));

module.exports = router;
