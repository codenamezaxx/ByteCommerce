// P5.1 — Cart routes.
// Mounted at /api/cart (see src/app.js routeModules).
// guestTracker + optionalAuth mendukung dua skenario: guest (X-Guest-ID) atau user (JWT).
const express = require('express');
const asyncWrapper = require('../../utils/asyncWrapper');
const guestTracker = require('../../middlewares/guestTracker');
const { authenticate, optionalAuth } = require('../../middlewares/auth');
const cartController = require('./cart.controller');

const router = express.Router();

// Guest atau user
router.get('/', guestTracker, optionalAuth, asyncWrapper(cartController.getCart));
router.post('/items', guestTracker, optionalAuth, asyncWrapper(cartController.addItem));
router.patch('/items/:itemId', guestTracker, optionalAuth, asyncWrapper(cartController.updateItemQuantity));
router.delete('/items/:itemId', guestTracker, optionalAuth, asyncWrapper(cartController.removeItem));

// Wajib login — trigger merge manual (dan dipanggil otomatis saat login via auth.service).
router.post('/merge', guestTracker, authenticate, asyncWrapper(cartController.mergeCart));

module.exports = router;
