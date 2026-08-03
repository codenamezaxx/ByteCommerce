// P5.3 — Cart service: logika bisnis keranjang.
// Semua query parameterized ($1, $2, ...). Tanpa ORM.
// mergeGuestCart diekspor dengan nama PERSIS agar guard lazy di auth.service
// (typeof cartService.mergeGuestCart === 'function') aktif.
const db = require('../../config/db');
const { ConflictError, NotFoundError, ValidationError } = require('../../utils/CustomError');

class CartService {
  // Mencari cart pemilik (user ATAU guest — CHECK XOR di schema: persis satu owner).
  static async getOrCreateCart({ userId = null, guestId = null } = {}) {
    const ownerUserId = userId || null;
    // User login SELALU memakai cart user; guestId hanya dipakai bila tidak ada user.
    const ownerGuestId = userId ? null : guestId || null;

    if (!ownerUserId && !ownerGuestId) {
      throw new ValidationError('Cannot identify cart owner', [
        { field: 'cart', message: 'A valid user or guest id is required' },
      ]);
    }

    if (ownerUserId) {
      const existing = await db.query(
        'SELECT id, user_id, guest_id FROM carts WHERE user_id = $1 ORDER BY id ASC LIMIT 1',
        [ownerUserId]
      );
      if (existing.rows[0]) return existing.rows[0];
    } else {
      const existing = await db.query(
        'SELECT id, user_id, guest_id FROM carts WHERE guest_id = $1',
        [ownerGuestId]
      );
      if (existing.rows[0]) return existing.rows[0];
    }

    try {
      const result = await db.query(
        'INSERT INTO carts (user_id, guest_id) VALUES ($1, $2) RETURNING id, user_id, guest_id',
        [ownerUserId, ownerGuestId]
      );
      return result.rows[0];
    } catch (err) {
      // UNIQUE violation (guest_id) akibat race concurrent insert — query ulang.
      if (err && err.code === '23505') {
        if (ownerUserId) {
          const existing = await db.query(
            'SELECT id, user_id, guest_id FROM carts WHERE user_id = $1 ORDER BY id ASC LIMIT 1',
            [ownerUserId]
          );
          if (existing.rows[0]) return existing.rows[0];
        } else {
          const existing = await db.query(
            'SELECT id, user_id, guest_id FROM carts WHERE guest_id = $1',
            [ownerGuestId]
          );
          if (existing.rows[0]) return existing.rows[0];
        }
      }
      throw err;
    }
  }

  static async addItem(cartId, productId, quantity) {
    // Validasi produk exist & stok.
    const productResult = await db.query('SELECT id, stock FROM products WHERE id = $1', [productId]);
    const product = productResult.rows[0];
    if (!product) {
      throw new NotFoundError('Product not found', [], 'PRODUCT_NOT_FOUND');
    }
    if (product.stock <= 0) {
      throw new ConflictError('Product is out of stock', [], 'OUT_OF_STOCK');
    }

    // Upsert aman terhadap race: UNIQUE(cart_id, product_id) + ON CONFLICT.
    const result = await db.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, product_id)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
       RETURNING id, cart_id, product_id, quantity`,
      [cartId, productId, quantity]
    );
    return result.rows[0];
  }

  static async getCartItems(cartId) {
    // Harga efektif untuk display: COALESCE(flash_sale_price, price) bila flash sale.
    // NOTE: harga final checkout tetap ditentukan Stored Procedure saat transaksi.
    // Kolom image di-ommit karena schema products belum punya image_url.
    const result = await db.query(
      `SELECT ci.id, ci.product_id, p.name, p.price, p.flash_sale_price, p.is_flash_sale, ci.quantity,
              (CASE WHEN p.is_flash_sale AND p.flash_sale_price IS NOT NULL
                    THEN p.flash_sale_price ELSE p.price END) * ci.quantity AS subtotal
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = $1
       ORDER BY ci.id ASC`,
      [cartId]
    );

    const items = result.rows.map((row) => ({
      id: row.id,
      product_id: row.product_id,
      name: row.name,
      price: Number(row.price),
      flash_sale_price: row.flash_sale_price !== null ? Number(row.flash_sale_price) : null,
      is_flash_sale: row.is_flash_sale,
      quantity: row.quantity,
      subtotal: Number(row.subtotal),
    }));

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    return { items, total };
  }

  static async updateItemQuantity(cartId, itemId, quantity) {
    const result = await db.query(
      `UPDATE cart_items SET quantity = $1
       WHERE id = $2 AND cart_id = $3
       RETURNING id, cart_id, product_id, quantity`,
      [quantity, itemId, cartId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundError('Cart item not found', [], 'CART_ITEM_NOT_FOUND');
    }
    return result.rows[0];
  }

  static async removeItem(cartId, itemId) {
    const result = await db.query(
      'DELETE FROM cart_items WHERE id = $1 AND cart_id = $2 RETURNING id',
      [itemId, cartId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundError('Cart item not found', [], 'CART_ITEM_NOT_FOUND');
    }
    return { id: itemId };
  }

  // WAJIB transaksi SQL (BEGIN/COMMIT/ROLLBACK). Signature PERSIS (guestId, userId)
  // agar auth.service.triggerCartMerge memanggilnya dengan benar.
  static async mergeGuestCart(guestId, userId) {
    if (!guestId || !userId) return null;

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // 1. Cari cart guest — tidak ada → no-op sukses.
      const guestCartResult = await client.query(
        'SELECT id FROM carts WHERE guest_id = $1 FOR UPDATE',
        [guestId]
      );
      const guestCart = guestCartResult.rows[0];
      if (!guestCart) {
        await client.query('COMMIT');
        return null;
      }

      // 2. Ambil / buat cart user di dalam transaksi.
      const userCartResult = await client.query(
        'SELECT id FROM carts WHERE user_id = $1 ORDER BY id ASC LIMIT 1',
        [userId]
      );
      let userCart = userCartResult.rows[0];
      if (!userCart) {
        const created = await client.query(
          'INSERT INTO carts (user_id, guest_id) VALUES ($1, NULL) RETURNING id',
          [userId]
        );
        userCart = created.rows[0];
      }

      // 3. Migrasi semua item guest ke cart user.
      const guestItems = await client.query(
        'SELECT product_id, quantity FROM cart_items WHERE cart_id = $1',
        [guestCart.id]
      );

      for (const item of guestItems.rows) {
        await client.query(
          `INSERT INTO cart_items (cart_id, product_id, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (cart_id, product_id)
           DO UPDATE SET quantity = GREATEST(cart_items.quantity, EXCLUDED.quantity)`,
          [userCart.id, item.product_id, item.quantity]
        );
      }

      // 4. Hapus cart guest (cart_items-nya ikut terhapus via ON DELETE CASCADE).
      await client.query('DELETE FROM carts WHERE id = $1', [guestCart.id]);

      await client.query('COMMIT');
      return { merged: true, movedItems: guestItems.rowCount };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = CartService;
