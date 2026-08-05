// P4.1 — Controller profil pengguna.
// Layer ini hanya membaca req, memanggil Service, dan mengembalikan respons JSON.
// Dilarang menaruh logika SQL atau query Redis di sini.

const UserProfileService = require('./user-profiles.service');

class UserProfileController {
  static async get(req, res, next) {
    try {
      const profile = await UserProfileService.getProfile(req.user.id);
      return res.success(profile, 'Profile fetched successfully');
    } catch (err) {
      return next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const profile = await UserProfileService.updateProfile(req.user.id, req.body || {});
      return res.success(profile, 'Profile updated successfully');
    } catch (err) {
      return next(err);
    }
  }

  static async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body || {};
      await UserProfileService.changePassword(req.user.id, currentPassword, newPassword);
      return res.success({}, 'Password changed successfully');
    } catch (err) {
      return next(err);
    }
  }
}

module.exports = UserProfileController;
