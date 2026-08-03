// P6.3 — Flash sale service: logika bisnis flash sale high-concurrency.
// Zero-oversell (AGENTS.md 3.1):
//   TIER 1: pre-check cepat di Redis `flash_sale:stock:<product_id>` (<10ms)
//           untuk meredam beban sebelum menyentuh PostgreSQL.
//   TIER 2: eksekusi atomik di Stored Procedure buy_flash_sale_item
//           (SELECT ... FOR UPDATE + pemotongan stok langsung di DB, BUKAN kalkulasi client).
// Graceful fallback (AGENTS.md 3.2): Redis miss/error → pengecekan diteruskan ke
// PostgreSQL; kegagalan Redis tidak pernah menggagalkan order yang sudah PAID.
const db = require('../../config/db');
const redis = require('../../config/redis');
const { AppError, ConflictError, NotFoundError } = require('../../utils/CustomError');

const STOCK_KEY_PREFIX = 'flash_sale:stock:';

class FlashSaleService {
  // Daftar produk flash sale aktif (harga flash terpasang).
  // remaining_stock diambil dari Redis bila tersedia (kuota tersisa); bila Redis
  // miss/down, fallback ke stok PostgreSQL (graceful).
  static async getActiveFlashSale() {
    const result = await db.query(
      `SELECT id, name, description, price, flash_sale_price, stock
       FROM products
       WHERE is_flash_sale = TRUE AND flash_sale_price IS NOT NULL
       ORDER BY id ASC`
    );

    const keys = result.rows.map((p) => `${STOCK_KEY_PREFIX}${p.id}`);
    let cached = null;
    try {
      cached = await redis.mget(keys);
    } catch (err) {
      console.warn(`[flashsale] Redis unavailable for stock read, falling back to DB: ${err.message}`);
    }

    return result.rows.map((p, i) => {
      const cachedValue = cached && cached[i] !== null && cached[i] !== undefined ? cached[i] : null;
      const remaining = cachedValue !== null ? Math.max(0, Number(cachedValue)) : Number(p.stock);
      const flashPrice = Number(p.flash_sale_price);
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.price),
        flash_sale_price: flashPrice,
        stock: Number(p.stock),
        remaining_stock: remaining,
        discount_percent: Math.round((1 - flashPrice / Number(p.price)) * 100),
      };
    });
  }

  // Pembelian flash sale. Wajib dipanggil dengan req.user.id (JWT).
  static async checkout(userId, productId, quantity = 1) {
    const stockKey = `${STOCK_KEY_PREFIX}${productId}`;

    // --- TIER 1: pre-check Redis (graceful fallback ke DB bila miss/error) ----
    let cachedStock = null;
    try {
      cachedStock = await redis.get(stockKey);
    } catch (err) {
      console.warn(`[flashsale] Redis pre-check failed, falling back to DB: ${err.message}`);
    }
    if (cachedStock !== null && Number(cachedStock) <= 0) {
      // Spec ARCHITECTURE.md/TASK.md: penolakan Tier 1 = 400 OUT_OF_STOCK_REDIS.
      throw new AppError('Flash sale stock is exhausted', 400, 'OUT_OF_STOCK_REDIS');
    }

    // --- TIER 2: eksekusi transaksi atomik di Stored Procedure PostgreSQL ----
    let result;
    try {
      result = await db.query(
        'SELECT buy_flash_sale_item($1, $2, $3) AS order_id',
        [userId, productId, quantity]
      );
    } catch (err) {
      // Pesan exception dari RAISE EXCEPTION di PL/pgSQL muncul sebagai err.message.
      if (err && err.message) {
        if (err.message === 'OUT_OF_STOCK') {
          // Sinkronkan Redis agar pre-check berikutnya langsung ditolak.
          // Spec ARCHITECTURE.md/TASK.md: OUT_OF_STOCK_DB = 400 (bukan 409).
          await FlashSaleService._safeRedisSet(stockKey, 0);
          throw new AppError('Flash sale stock is exhausted', 400, 'OUT_OF_STOCK_DB');
        }
        if (err.message === 'PRODUCT_NOT_FOUND') {
          throw new NotFoundError('Product not found', [], 'PRODUCT_NOT_FOUND');
        }
        if (err.message === 'NOT_FLASH_SALE') {
          throw new ConflictError('Product is not part of the flash sale', [], 'NOT_FLASH_SALE');
        }
        if (err.message === 'FLASH_PRICE_NOT_SET') {
          throw new ConflictError('Flash sale price is not configured', [], 'FLASH_PRICE_NOT_SET');
        }
      }
      throw err;
    }

    const orderId = result.rows[0].order_id;

    // Sinkronkan kuota Redis. Order sudah PAID di DB — kegagalan Redis TIDAK
    // menggagalkan order (graceful); jika nanti Redis pre-check over-bolehkan,
    // DB akan menolak dan Redis ikut disinkronkan ke 0.
    try {
      await redis.decrby(stockKey, quantity);
    } catch (err) {
      console.warn(`[flashsale] Redis quota sync failed (order ${orderId} tetap valid): ${err.message}`);
    }

    const orderResult = await db.query(
      'SELECT id, total_amount, status FROM orders WHERE id = $1',
      [orderId]
    );
    const order = orderResult.rows[0];
    return {
      orderId: order.id,
      totalAmount: Number(order.total_amount),
      status: order.status,
    };
  }

  // Admin: muat stok flash sale dari PostgreSQL ke Redis (kuota awal).
  static async warmupFlashSaleStock() {
    const result = await db.query(
      `SELECT id, stock FROM products
       WHERE is_flash_sale = TRUE AND flash_sale_price IS NOT NULL
       ORDER BY id ASC`
    );

    const products = result.rows;
    if (products.length === 0) {
      return { warmed: 0, products: [] };
    }

    const pipeline = redis.pipeline();
    for (const p of products) {
      pipeline.set(`${STOCK_KEY_PREFIX}${p.id}`, p.stock);
    }
    const execResults = await pipeline.exec();
    const failedCount = execResults.filter(([err]) => err).length;
    if (failedCount > 0) {
      console.warn(`[flashsale] warmup: ${failedCount}/${products.length} keys failed to write`);
    }

    return {
      warmed: products.length,
      products: products.map((p) => ({ id: p.id, stock: p.stock })),
    };
  }

  // Admin: matikan event flash sale secara mendadak.
  // Semua kuota Redis `flash_sale:stock:*` di-set ke 0 sehingga TIER 1 langsung
  // menolak checkout (tidak menyentuh PostgreSQL).
  static async killswitchFlashSale() {
    const keys = [];
    let cursor = '0';
    do {
      const [nextCursor, foundKeys] = await redis.scan(cursor, 'MATCH', `${STOCK_KEY_PREFIX}*`, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...foundKeys);
    } while (cursor !== '0');

    if (keys.length > 0) {
      const pipeline = redis.pipeline();
      for (const key of keys) {
        pipeline.set(key, 0);
      }
      const execResults = await pipeline.exec();
      const failedCount = execResults.filter(([err]) => err).length;
      if (failedCount > 0) {
        console.warn(`[flashsale] killswitch: ${failedCount}/${keys.length} keys failed to write`);
      }
    }

    return { killed: keys.length };
  }

  static async _safeRedisSet(key, value) {
    try {
      await redis.set(key, value);
    } catch (err) {
      console.warn(`[flashsale] Redis write failed: ${err.message}`);
    }
  }
}

module.exports = FlashSaleService;
