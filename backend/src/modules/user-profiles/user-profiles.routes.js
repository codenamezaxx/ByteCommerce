// P4.1 — Routes profil pengguna.
// Semua endpoint memerlukan autentikasi (JWT via middleware authenticate).

const express = require('express');
const asyncWrapper = require('../../utils/asyncWrapper');
const { authenticate } = require('../../middlewares/auth');
const UserProfileController = require('./user-profiles.controller');

const router = express.Router();

// Semua route butuh login
router.use(authenticate);

router.get('/', asyncWrapper(UserProfileController.get));
router.put('/', asyncWrapper(UserProfileController.update));
router.put('/password', asyncWrapper(UserProfileController.changePassword));

module.exports = router;
