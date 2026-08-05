// P4.1 — Layanan profil pengguna: baca/ubah kredensial & ganti password.
// Database: PostgreSQL native via pg (raw SQL parameterized, tanpa ORM).

const bcrypt = require('bcrypt');
const db = require('../../config/db');
const {
  ValidationError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
} = require('../../utils/CustomError');

const BCRYPT_SALT_ROUNDS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

function toProfile(row) {
  if (!row) return null;
  const { password_hash, ...profile } = row;
  return profile;
}

class UserProfileService {
  static async getProfile(userId) {
    const { rows } = await db.query(
      `SELECT id, name, email, role, phone, address, city, province, postal_code, created_at
       FROM users WHERE id = $1`,
      [userId]
    );
    if (rows.length === 0) {
      throw new NotFoundError('User not found');
    }
    return rows[0];
  }

  static async updateProfile(userId, data) {
    const errors = [];
    const updates = {};
    const clean = (v) => (typeof v === 'string' ? v.trim() : v);

    if (data.name !== undefined) {
      const name = clean(data.name);
      if (!name) {
        errors.push({ field: 'name', message: 'Nama tidak boleh kosong' });
      } else if (name.length > 100) {
        errors.push({ field: 'name', message: 'Nama maksimal 100 karakter' });
      } else {
        updates.name = name;
      }
    }

    if (data.email !== undefined) {
      const email = clean(data.email).toLowerCase();
      if (!email) {
        errors.push({ field: 'email', message: 'Email tidak boleh kosong' });
      } else if (!EMAIL_REGEX.test(email)) {
        errors.push({ field: 'email', message: 'Format email tidak valid' });
      } else if (email.length > 150) {
        errors.push({ field: 'email', message: 'Email maksimal 150 karakter' });
      } else {
        updates.email = email;
      }
    }

    if (data.phone !== undefined) {
      const phone = clean(data.phone);
      if (phone && phone.length > 20) {
        errors.push({ field: 'phone', message: 'Nomor telepon maksimal 20 karakter' });
      } else {
        updates.phone = phone || null;
      }
    }

    if (data.address !== undefined) {
      const address = clean(data.address);
      if (address && address.length > 1000) {
        errors.push({ field: 'address', message: 'Alamat maksimal 1000 karakter' });
      } else {
        updates.address = address || null;
      }
    }

    if (data.city !== undefined) {
      const city = clean(data.city);
      if (city && city.length > 100) {
        errors.push({ field: 'city', message: 'Kota maksimal 100 karakter' });
      } else {
        updates.city = city || null;
      }
    }

    if (data.province !== undefined) {
      const province = clean(data.province);
      if (province && province.length > 100) {
        errors.push({ field: 'province', message: 'Provinsi maksimal 100 karakter' });
      } else {
        updates.province = province || null;
      }
    }

    if (data.postalCode !== undefined) {
      const postalCode = clean(data.postalCode);
      if (postalCode && !/^\d{5}$/.test(postalCode)) {
        errors.push({ field: 'postalCode', message: 'Kode pos harus 5 digit angka' });
      } else {
        updates.postal_code = postalCode || null;
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Validasi gagal', errors);
    }

    if (Object.keys(updates).length === 0) {
      return this.getProfile(userId);
    }

    if (updates.email) {
      const { rows: dupes } = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id <> $2',
        [updates.email, userId]
      );
      if (dupes.length > 0) {
        throw new ConflictError('Email sudah terdaftar', [], 'EMAIL_ALREADY_REGISTERED');
      }
    }

    const setClauses = [];
    const params = [];
    let idx = 1;
    for (const [col, value] of Object.entries(updates)) {
      setClauses.push(`${col} = $${idx}`);
      params.push(value);
      idx += 1;
    }
    params.push(userId);

    const { rows } = await db.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, name, email, role, phone, address, city, province, postal_code, created_at`,
      params
    );
    return rows[0];
  }

  static async changePassword(userId, currentPassword, newPassword) {
    const errors = [];
    if (!currentPassword) {
      errors.push({ field: 'currentPassword', message: 'Password lama wajib diisi' });
    }
    if (!newPassword) {
      errors.push({ field: 'newPassword', message: 'Password baru wajib diisi' });
    } else if (!PASSWORD_REGEX.test(newPassword)) {
      errors.push({
        field: 'newPassword',
        message: 'Password minimal 8 karakter, mengandung huruf besar dan angka',
      });
    }
    if (errors.length > 0) {
      throw new ValidationError('Validasi gagal', errors);
    }

    const { rows } = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );
    if (rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    const matches = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!matches) {
      throw new AuthenticationError('Password lama salah', [], 'INVALID_CURRENT_PASSWORD');
    }

    if (currentPassword === newPassword) {
      throw new ValidationError('Validasi gagal', [
        { field: 'newPassword', message: 'Password baru harus berbeda dari password lama' },
      ]);
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      userId,
    ]);
    return { success: true };
  }
}

module.exports = UserProfileService;
