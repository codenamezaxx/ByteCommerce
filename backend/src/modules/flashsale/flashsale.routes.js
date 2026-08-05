// P6.1 — Flash sale routes.
// Menyediakan DUA router:
//   * router      → /api/flashsale        (public + checkout wajib JWT)
//   * adminRouter → /api/admin/flashsale  (control admin: warmup & killswitch)
// Keduanya dipasang di src/app.js routeModules.
const express = require('express');
const asyncWrapper = require('../../utils/asyncWrapper');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const flashsaleController = require('./flashsale.controller');

const router = express.Router();
router.get('/active', asyncWrapper(flashsaleController.getActiveFlashSale));
// Checkout wajib login (req.user.id). Wajib chain authenticate (bukan optionalAuth).
router.post('/checkout', authenticate, asyncWrapper(flashsaleController.checkout));

const adminRouter = express.Router();
// authenticate memverifikasi token lalu requireAdmin memeriksa role ADMIN.
adminRouter.post('/warmup', authenticate, requireAdmin, asyncWrapper(flashsaleController.warmup));
adminRouter.post('/killswitch', authenticate, requireAdmin, asyncWrapper(flashsaleController.killswitch));
// Kelola item flash sale (set harga+kuota / hapus dari program flash sale).
adminRouter.post('/start', authenticate, requireAdmin, asyncWrapper(flashsaleController.start));
adminRouter.post('/items', authenticate, requireAdmin, asyncWrapper(flashsaleController.setFlashSaleItem));
adminRouter.delete('/items/:productId', authenticate, requireAdmin, asyncWrapper(flashsaleController.removeFlashSaleItem));

module.exports = { router, adminRouter };
