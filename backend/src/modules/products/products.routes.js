// P4.1 — Product routes.
// Menyediakan DUA router:
//   * router      → /api/products          (public list/detail + admin CRUD)
//   * adminRouter → /api/admin/products    (upload/delete gambar produk)
// Keduanya dipasang di src/app.js routeModules.
const express = require('express');
const multer = require('multer');
const asyncWrapper = require('../../utils/asyncWrapper');
const { authenticate, requireAdmin } = require('../../middlewares/auth');
const { AppError } = require('../../utils/CustomError');
const productsController = require('./products.controller');
const storageService = require('./storage.service');

const router = express.Router();

// --- Multer untuk upload gambar (memory storage — buffer diteruskan ke service) ---
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    if (storageService.isAllowedMime(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(
        'Image type not allowed. Use JPEG, PNG, or WebP.',
        400,
        'IMAGE_TYPE_NOT_ALLOWED'
      ));
    }
  },
});

// Middleware pemeta error multer → CustomError + status yang diharapkan API.
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('Image file too large. Maximum size is 5MB.', 413, 'IMAGE_TOO_LARGE'));
    }
    return next(new AppError(`Upload failed: ${err.message}`, 400, 'IMAGE_UPLOAD_ERROR'));
  }
  return next(err);
}

// Public
router.get('/', asyncWrapper(productsController.list));
router.get('/:id', asyncWrapper(productsController.detail));

// Admin only — authenticate memverifikasi token lalu requireAdmin memeriksa role.
router.post('/', authenticate, requireAdmin, asyncWrapper(productsController.create));
router.put('/:id', authenticate, requireAdmin, asyncWrapper(productsController.update));
router.delete('/:id', authenticate, requireAdmin, asyncWrapper(productsController.remove));

// Upload / hapus gambar produk (multipart field "image") — di bawah /api/admin/products.
const adminRouter = express.Router();
adminRouter.post(
  '/:id/image',
  authenticate,
  requireAdmin,
  upload.single('image'),
  handleUploadError,
  asyncWrapper(productsController.uploadImage)
);
adminRouter.delete('/:id/image', authenticate, requireAdmin, asyncWrapper(productsController.removeImage));

module.exports = { router, adminRouter };
