// P4.3 — Product service: logika bisnis produk.
// Semua query parameterized ($1, $2, ...). Dynamic WHERE/SET dibangun dengan
// array params + placeholder counter — TANPA string concatenation nilai user.
const db = require('../../config/db');
const { ConflictError, NotFoundError } = require('../../utils/CustomError');

const MAX_LIMIT = 100;

const PRODUCT_COLUMNS =
  'id, name, description, category, price, stock, is_flash_sale, flash_sale_price, ' +
  'flash_sale_stock, flash_sale_start, flash_sale_end, created_at';

// pg mengembalikan DECIMAL/NUMERIC sebagai string — normalisasi ke Number untuk JSON.
function mapProduct(row) {
  if (!row) return row;
  return {
    ...row,
    price: Number(row.price),
    flash_sale_price: row.flash_sale_price !== null ? Number(row.flash_sale_price) : null,
    flash_sale_stock: row.flash_sale_stock !== null ? Number(row.flash_sale_stock) : null,
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
      price: data.price,
      stock: data.stock,
      is_flash_sale: data.is_flash_sale === true,
      flash_sale_price: data.is_flash_sale === true ? data.flash_sale_price : null,
    };

    try {
      const result = await db.query(
        `INSERT INTO products (name, description, price, stock, is_flash_sale, flash_sale_price)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${PRODUCT_COLUMNS}`,
        [
          values.name,
          values.description,
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
    const updatableColumns = ['name', 'description', 'price', 'stock', 'is_flash_sale', 'flash_sale_price'];
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
    try {
      const result = await db.query('DELETE FROM products WHERE id = $1', [productId]);
      if (result.rowCount === 0) {
        throw new NotFoundError('Product not found', [], 'PRODUCT_NOT_FOUND');
      }
      return { id: productId };
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
  }
}

module.exports = ProductsService;
