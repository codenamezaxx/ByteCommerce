// P4.3 — Product service: logika bisnis produk.
// Semua query parameterized ($1, $2, ...). Dynamic WHERE/SET dibangun dengan
// array params + placeholder counter — TANPA string concatenation nilai user.
const db = require('../../config/db');
const { ConflictError, NotFoundError } = require('../../utils/CustomError');
const storageService = require('./storage.service');

const MAX_LIMIT = 100;

const PRODUCT_COLUMNS =
  'id, name, description, category, price, stock, is_flash_sale, flash_sale_price, ' +
  'flash_sale_stock, flash_sale_start, flash_sale_end, image_url, created_at';

// pg mengembalikan DECIMAL/NUMERIC sebagai string — normalisasi ke Number untuk JSON.
// image_url di DB menyimpan KEY file; direspons sebagai path publik (/uploads/products/..).
function mapProduct(row) {
  if (!row) return row;
  return {
    ...row,
    price: Number(row.price),
    flash_sale_price: row.flash_sale_price !== null ? Number(row.flash_sale_price) : null,
    flash_sale_stock: row.flash_sale_stock !== null ? Number(row.flash_sale_stock) : null,
    image_url: row.image_url ? storageService.getPublicPath(row.image_url) : null,
  };
}

class ProductsService {
  static async list({ page = 1, limit = 10, search = '', flashSale = null, minPrice = null, maxPrice = null, category = null } = {}) {
    const safeLimit = Math.min(limit, MAX_LIMIT);
    const offset = (page - 1) * safeLimit;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`name ILIKE '%' || $${idx} || '%'`);
      params.push(search);
      idx += 1;
    }
    if (flashSale !== null) {
      conditions.push(`is_flash_sale = $${idx}`);
      params.push(flashSale);
      idx += 1;
    }
    if (category) {
      conditions.push(`category = $${idx}`);
      params.push(category);
      idx += 1;
    }
    if (minPrice !== null) {
      conditions.push(`price >= $${idx}`);
      params.push(minPrice);
      idx += 1;
    }
    if (maxPrice !== null) {
      conditions.push(`price <= $${idx}`);
      params.push(maxPrice);
      idx += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total tanpa LIMIT/OFFSET.
    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM products ${whereClause}`,
      params
    );
    const total = countResult.rows[0].total;

    params.push(safeLimit, offset);
    const listResult = await db.query(
      `SELECT ${PRODUCT_COLUMNS}
       FROM products ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    return {
      products: listResult.rows.map(mapProduct),
      total,
      page,
      totalPages: total === 0 ? 0 : Math.ceil(total / safeLimit),
    };
  }

  static async detail(productId) {
    const result = await db.query(
      `SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = $1`,
      [productId]
    );
    if (!result.rows[0]) {
      throw new NotFoundError('Product not found', [], 'PRODUCT_NOT_FOUND');
    }
    return mapProduct(result.rows[0]);
  }

  static async create(data) {
    const values = {
      name: data.name,
      description: data.description !== undefined ? data.description : null,
      // Defensif: controller sudah mewajibkan category; default hanya jika dipanggil non-HTTP.
      category: typeof data.category === 'string' && data.category.trim() !== '' ? data.category.trim() : 'Lainnya',
      price: data.price,
      stock: data.stock,
      is_flash_sale: data.is_flash_sale === true,
      flash_sale_price: data.is_flash_sale === true ? data.flash_sale_price : null,
    };

    try {
      const result = await db.query(
        `INSERT INTO products (name, description, category, price, stock, is_flash_sale, flash_sale_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${PRODUCT_COLUMNS}`,
        [
          values.name,
          values.description,
          values.category,
          values.price,
          values.stock,
          values.is_flash_sale,
          values.flash_sale_price,
        ]
      );
      return mapProduct(result.rows[0]);
    } catch (err) {
      // UNIQUE violation (guard untuk kolom slug bila schema menambahkannya di masa depan).
      if (err && err.code === '23505') {
        throw new ConflictError('A product with this slug already exists', [], 'SLUG_EXISTS');
      }
      throw err;
    }
  }

  static async update(productId, data) {
    const updatableColumns = ['name', 'description', 'category', 'price', 'stock', 'is_flash_sale', 'flash_sale_price'];
    const setClauses = [];
    const params = [];
    let idx = 1;

    for (const column of updatableColumns) {
      if (data[column] !== undefined) {
        setClauses.push(`${column} = $${idx}`);
        params.push(data[column]);
        idx += 1;
      }
    }

    // Tidak ada field valid untuk di-update — kembalikan record saat ini (no-op).
    if (setClauses.length === 0) {
      return ProductsService.detail(productId);
    }

    params.push(productId);
    const result = await db.query(
      `UPDATE products SET ${setClauses.join(', ')}
       WHERE id = $${idx}
       RETURNING ${PRODUCT_COLUMNS}`,
      params
    );
    if (result.rowCount === 0) {
      throw new NotFoundError('Product not found', [], 'PRODUCT_NOT_FOUND');
    }
    return mapProduct(result.rows[0]);
  }

  static async remove(productId) {
    // Baca key gambar lama SEBELUM produk dihapus (untuk cleanup file).
    const current = await db.query('SELECT image_url FROM products WHERE id = $1', [productId]);
    const oldImageKey = current.rows[0] ? current.rows[0].image_url : null;

    try {
      const result = await db.query('DELETE FROM products WHERE id = $1', [productId]);
      if (result.rowCount === 0) {
        throw new NotFoundError('Product not found', [], 'PRODUCT_NOT_FOUND');
      }
    } catch (err) {
      // FK violation: produk masih dipakai order_items (tidak ada ON DELETE) — hard delete diblokir.
      if (err && err.code === '23503') {
        throw new ConflictError(
          'Product is referenced by existing orders and cannot be deleted',
          [],
          'PRODUCT_IN_USE'
        );
      }
      throw err;
    }

    // Hapus file gambar SETELAH baris produk berhasil dihapus (best-effort).
    if (oldImageKey) {
      try {
        await storageService.remove(oldImageKey);
      } catch (err) {
        console.warn(`[products] Failed to remove image file ${oldImageKey} during delete: ${err.message}`);
      }
    }
    return { id: productId };
  }

  // Ganti gambar produk: simpan file baru → update DB → hapus file lama.
  // Urutan menjamin file lama hanya dihapus setelah DB commit sukses; kegagalan
  // menghapus file lama tidak menggagalkan upload (best-effort).
  static async replaceImage(productId, { buffer, mime }) {
    const current = await db.query('SELECT image_url FROM products WHERE id = $1', [productId]);
    if (!current.rows[0]) {
      throw new NotFoundError('Product not found', [], 'PRODUCT_NOT_FOUND');
    }
    const oldImageKey = current.rows[0].image_url;

    const key = await storageService.save(buffer, { mime });
    const updated = await db.query(
      'UPDATE products SET image_url = $1 WHERE id = $2 RETURNING image_url',
      [key, productId]
    );

    if (oldImageKey) {
      try {
        await storageService.remove(oldImageKey);
      } catch (err) {
        console.warn(`[products] Failed to remove replaced image ${oldImageKey}: ${err.message}`);
      }
    }

    return { image_url: storageService.getPublicPath(updated.rows[0].image_url) };
  }

  // Hapus gambar produk: NULL-kan kolom → hapus file lama (best-effort).
  static async removeImage(productId) {
    const current = await db.query('SELECT image_url FROM products WHERE id = $1', [productId]);
    if (!current.rows[0]) {
      throw new NotFoundError('Product not found', [], 'PRODUCT_NOT_FOUND');
    }
    const oldImageKey = current.rows[0].image_url;

    await db.query('UPDATE products SET image_url = NULL WHERE id = $1', [productId]);

    if (oldImageKey) {
      try {
        await storageService.remove(oldImageKey);
      } catch (err) {
        console.warn(`[products] Failed to remove image file ${oldImageKey} during image delete: ${err.message}`);
      }
    }

    return { image_url: null };
  }
}

module.exports = ProductsService;
