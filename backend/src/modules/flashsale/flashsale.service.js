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
const storageService = require('../products/storage.service');

const STOCK_KEY_PREFIX = 'flash_sale:stock:';

// Normalisasi baris produk untuk respons admin set/remove flash sale item.
// pg mengembalikan DECIMAL sebagai string — konversi ke Number agar JSON rapi.
function mapFlashProduct(row) {
  if (!row) return row;
  return {
    ...row,
    price: Number(row.price),
    flash_sale_price: row.flash_sale_price !== null ? Number(row.flash_sale_price) : null,
    flash_sale_stock: row.flash_sale_stock !== null ? Number(row.flash_sale_stock) : null,
  };
}

class FlashSaleService {
  // Auto-ekspirasi: item yang sudah melewati flash_sale_end dikeluarkan secara
  // PERMANEN dari program flash sale (is_flash_sale=FALSE + harga/kuota/jadwal
  // dihapus), sehingga diskon ikut berakhir tanpa cron job. Dipanggil di awal
  // operasi baca/tulis flash sale; kalau tidak ada item expired, no-op murah.
  static async expireEndedFlashSales() {
    const result = await db.query(
      `UPDATE products
       SET is_flash_sale = FALSE,
           flash_sale_price = NULL,
           flash_sale_stock = NULL,
           flash_sale_start = NULL,
           flash_sale_end = NULL
       WHERE flash_sale_end IS NOT NULL AND flash_sale_end <= NOW()
       RETURNING id`
    );

    const expired = result.rows;
    if (expired.length === 0) return 0;

    // Hapus key kuota Redis best-effort (Redis down → DB sudah final).
    try {
      const pipeline = redis.pipeline();
      for (const row of expired) {
        pipeline.del(`${STOCK_KEY_PREFIX}${row.id}`);
      }
      await pipeline.exec();
    } catch (err) {
      console.warn(`[flashsale] expireEndedFlashSales: Redis cleanup skipped: ${err.message}`);
    }

    return expired.length;
  }

  // Daftar produk flash sale yang MASIH BERLAKU (belum melewati flash_sale_end).
  // Item yang dijadwalkan ke depan (flash_sale_start > NOW()) ikut dikembalikan
  // dengan flag is_upcoming=true agar frontend bisa menampilkan countdown
  // "mulai dalam". remaining_stock diambil dari Redis bila tersedia (kuota
  // tersisa); bila Redis miss/down, fallback ke stok PostgreSQL (graceful).
  static async getActiveFlashSale() {
    // Bersihkan item yang jendelanya sudah lewat supaya diskon benar-benar
    // berakhir dan daftar aktif tidak pernah memuat produk expired.
    await FlashSaleService.expireEndedFlashSales();

    const result = await db.query(
      `SELECT id, name, description, category, price, flash_sale_price, stock,
              flash_sale_stock, flash_sale_start, flash_sale_end, image_url
       FROM products
       WHERE is_flash_sale = TRUE AND flash_sale_price IS NOT NULL
         AND (flash_sale_end IS NULL OR flash_sale_end > NOW())
       ORDER BY id ASC`
    );

    const keys = result.rows.map((p) => `${STOCK_KEY_PREFIX}${p.id}`);
    let cached = null;
    try {
      cached = await redis.mget(keys);
    } catch (err) {
      console.warn(`[flashsale] Redis unavailable for stock read, falling back to DB: ${err.message}`);
    }

    const now = Date.now();
    return result.rows.map((p, i) => {
      const cachedValue = cached && cached[i] !== null && cached[i] !== undefined ? cached[i] : null;
      const remaining = cachedValue !== null ? Math.max(0, Number(cachedValue)) : Number(p.stock);
      const flashPrice = Number(p.flash_sale_price);
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        price: Number(p.price),
        flash_sale_price: flashPrice,
        stock: Number(p.stock),
        flash_sale_stock: p.flash_sale_stock !== null ? Number(p.flash_sale_stock) : null,
        flash_sale_start: p.flash_sale_start,
        flash_sale_end: p.flash_sale_end,
        is_upcoming: p.flash_sale_start !== null && new Date(p.flash_sale_start).getTime() > now,
        image_url: p.image_url ? storageService.getPublicPath(p.image_url) : null,
        remaining_stock: remaining,
        discount_percent: Math.round((1 - flashPrice / Number(p.price)) * 100),
      };
    });
  }

  // Pembelian flash sale. Wajib dipanggil dengan req.user.id (JWT).
  // shipping: { name, phone, address, city, province, postalCode, note? }
  // paymentMethod: 'BANK_TRANSFER' | 'COD' | 'QRIS'
  static async checkout(userId, productId, quantity = 1, shipping = {}, paymentMethod = 'BANK_TRANSFER') {
    const stockKey = `${STOCK_KEY_PREFIX}${productId}`;

    // Auto-ekspirasi sebelum pre-check: item expired bukan lagi flash sale,
    // sehingga key Redis basi tidak dipakai dan SP menolak dengan NOT_FLASH_SALE.
    await FlashSaleService.expireEndedFlashSales();

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
        `SELECT buy_flash_sale_item($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) AS order_id`,
        [
          userId,
          productId,
          quantity,
          shipping.name,
          shipping.phone,
          shipping.address,
          shipping.city,
          shipping.province,
          shipping.postalCode,
          shipping.note || null,
          paymentMethod,
        ]
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
        if (err.message === 'FLASH_SALE_NOT_ACTIVE') {
          // Checkout di luar jendela waktu flash sale (belum mulai / sudah
          // berakhir / di-killswitch) — ditolak atomik oleh Stored Procedure.
          throw new ConflictError('Flash sale is not active at this time', [], 'FLASH_SALE_NOT_ACTIVE');
        }
      }
      throw err;
    }

    const orderId = result.rows[0].order_id;

    // Sinkronkan kuota Redis. Order sudah PAID di DB — kegagalan Redis TIDAK
    // menggagalkan order (graceful); jika nanti Redis pre-check over-bolehkan,
    // DB akan menolak dan Redis ikut disinkronkan ke 0.
    //
    // BUG GUARD: bila key `flash_sale:stock:<id>` TIDAK ADA (mis. Redis baru
    // restart sehingga semua key hilang), `DECRBY` akan membuat key = 0 - qty
    // (NEGATIF) karena Redis menganggap key kosong bernilai 0. Akibatnya TIER 1
    // pre-check menolak semua checkout selamanya padahal stok PostgreSQL masih ada.
    // Karena itu:
    //   * key ADA        → DECRBY (pola existing).
    //   * key HILANG     → re-init dari stok flash DB yang SUDAH dikurangi oleh
    //                      SP (nilainya = stok tersisa akurat SETELAH order
    //                      commit), di-SET langsung TANPA DECRBY lagi.
    // Kedua jalur tetap best-effort di dalam try/catch (kegagalan Redis tidak
    // pernah membatalkan order yang sudah PAID).
    try {
      const keyExists = await redis.exists(stockKey);
      if (keyExists) {
        await redis.decrby(stockKey, quantity);
      } else {
        const stockResult = await db.query(
          'SELECT flash_sale_stock FROM products WHERE id = $1',
          [productId]
        );
        const remaining = stockResult.rows[0] && stockResult.rows[0].flash_sale_stock !== null
          ? Math.max(0, Number(stockResult.rows[0].flash_sale_stock))
          : 0;
        // String konsisten dengan nilai yang biasa di-SET oleh warmup/killswitch.
        await redis.set(stockKey, String(remaining));
      }
    } catch (err) {
      console.warn(`[flashsale] Redis quota sync failed (order ${orderId} tetap valid): ${err.message}`);
    }

    // Best-effort: hapus item flash sale yang sudah dibeli dari cart user.
    // Order sudah PAID di DB — kegagalan cleanup TIDAK boleh menggagalkan order.
    try {
      await db.query(
        `DELETE FROM cart_items WHERE cart_id = (SELECT id FROM carts WHERE user_id = $1 ORDER BY id ASC LIMIT 1) AND product_id = $2`,
        [userId, productId]
      );
    } catch (err) {
      console.warn(`[flashsale] cart cleanup failed (order ${orderId} tetap valid): ${err.message}`);
    }

    const orderResult = await db.query(
      'SELECT id, total_amount, status, payment_method FROM orders WHERE id = $1',
      [orderId]
    );
    const order = orderResult.rows[0];
    return {
      orderId: order.id,
      totalAmount: Number(order.total_amount),
      status: order.status,
      paymentMethod: order.payment_method,
    };
  }

  // Admin: muat stok flash sale dari PostgreSQL ke Redis (kuota awal).
  // HANYA item yang masih dalam jendela aktif (belum berakhir & sudah mulai)
  // yang di-warmup — item berakhir/killswitch tidak akan hidup lagi.
  // Sumber stok = flash_sale_stock (alokasi khusus flash); bila NULL (produk
  // legacy flash tanpa kuota terpisah) fallback ke kolom stock.
  static async warmupFlashSaleStock() {
    // Item expired tidak boleh ikut di-warmup (di-clear lebih dulu).
    await FlashSaleService.expireEndedFlashSales();

    const result = await db.query(
      `SELECT id, COALESCE(flash_sale_stock, stock) AS warm_stock
       FROM products
       WHERE is_flash_sale = TRUE AND flash_sale_price IS NOT NULL
         AND (flash_sale_start IS NULL OR flash_sale_start <= NOW())
         AND (flash_sale_end IS NULL OR flash_sale_end > NOW())
       ORDER BY id ASC`
    );

    const products = result.rows;
    if (products.length === 0) {
      return { warmed: 0, products: [] };
    }

    const pipeline = redis.pipeline();
    for (const p of products) {
      pipeline.set(`${STOCK_KEY_PREFIX}${p.id}`, p.warm_stock);
    }
    const execResults = await pipeline.exec();
    const failedCount = execResults.filter(([err]) => err).length;
    if (failedCount > 0) {
      console.warn(`[flashsale] warmup: ${failedCount}/${products.length} keys failed to write`);
    }

    return {
      warmed: products.length,
      products: products.map((p) => ({ id: p.id, stock: p.warm_stock })),
    };
  }

  // Admin: jadikan sebuah produk sebagai item flash sale (harga + kuota khusus).
  // Kuota Redis ikut di-warmup agar TIER 1 pre-check langsung berfungsi.
  static async setFlashSaleItem({ productId, flashSalePrice, flashSaleStock, startAt = null, endAt = null }) {
    // Verifikasi keberadaan produk sekaligus ambil harga asli untuk rule
    // flashSalePrice harus LEBIH KECIL dari harga asli.
    const productResult = await db.query(
      'SELECT id, price FROM products WHERE id = $1',
      [productId]
    );
    const existing = productResult.rows[0];
    if (!existing) {
      throw new NotFoundError('Product not found', [], 'PRODUCT_NOT_FOUND');
    }
    if (flashSalePrice >= Number(existing.price)) {
      throw new AppError(
        'Flash sale price must be lower than the original product price',
        422,
        'INVALID_FLASH_PRICE',
        [{ field: 'flashSalePrice', message: 'flashSalePrice must be lower than the product price' }]
      );
    }

    const result = await db.query(
      `UPDATE products
       SET is_flash_sale = TRUE,
           flash_sale_price = $1,
           flash_sale_stock = $2,
           flash_sale_start = $3,
           flash_sale_end = $4
       WHERE id = $5
       RETURNING id, name, description, category, price, stock, is_flash_sale,
                 flash_sale_price, flash_sale_stock, flash_sale_start, flash_sale_end, created_at`,
      [flashSalePrice, flashSaleStock, startAt, endAt, productId]
    );
    const updated = mapFlashProduct(result.rows[0]);

    // Warmup cache kuota Redis untuk produk ini (graceful: gagal tidak fatal).
    await FlashSaleService._safeRedisSet(`${STOCK_KEY_PREFIX}${productId}`, flashSaleStock);

    return updated;
  }

  // Admin: hapus sebuah produk dari program flash sale & bersihkan cache Redis.
  static async removeFlashSaleItem(productId) {
    const result = await db.query(
      `UPDATE products
       SET is_flash_sale = FALSE,
           flash_sale_price = NULL,
           flash_sale_stock = NULL,
           flash_sale_start = NULL,
           flash_sale_end = NULL
       WHERE id = $1
       RETURNING id, name, description, category, price, stock, is_flash_sale,
                 flash_sale_price, flash_sale_stock, flash_sale_start, flash_sale_end, created_at`,
      [productId]
    );
    if (result.rowCount === 0) {
      throw new NotFoundError('Product not found', [], 'PRODUCT_NOT_FOUND');
    }

    try {
      await redis.del(`${STOCK_KEY_PREFIX}${productId}`);
    } catch (err) {
      console.warn(`[flashsale] removeFlashSaleItem: Redis DEL failed: ${err.message}`);
    }

    return mapFlashProduct(result.rows[0]);
  }

  // Admin: matikan event flash sale secara MENDADAK & PERMANEN.
  // 1. PostgreSQL (otoritas): semua item dikeluarkan dari program flash sale
  //    (is_flash_sale=FALSE + harga/kuota/jadwal dihapus) — warmup, Redis
  //    restart, maupun restart server TIDAK bisa menghidupkan kembali.
  // 2. Redis: key `flash_sale:stock:*` dihapus BEST-EFFORT dalam try/catch —
  //    kalau Redis down, killswitch tetap berhasil (DB sudah final).
  static async killswitchFlashSale() {
    const updateResult = await db.query(
      `UPDATE products
       SET is_flash_sale = FALSE,
           flash_sale_price = NULL,
           flash_sale_stock = NULL,
           flash_sale_start = NULL,
           flash_sale_end = NULL
       WHERE is_flash_sale = TRUE AND flash_sale_price IS NOT NULL`
    );

    const killed = updateResult.rowCount || 0;

    try {
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
          pipeline.del(key);
        }
        const execResults = await pipeline.exec();
        const failedCount = execResults.filter(([err]) => err).length;
        if (failedCount > 0) {
          console.warn(`[flashsale] killswitch: ${failedCount}/${keys.length} keys failed to delete`);
        }
      }
    } catch (err) {
      // Redis down — DB sudah final, tidak perlu gagalkan killswitch.
      console.warn(`[flashsale] killswitch: Redis cleanup skipped: ${err.message}`);
    }

    return { killed };
  }

  // Admin: MULAI flash sale sekarang dengan durasi tertentu (menit).
  // Semua item flash sale yang terkonfigurasi mendapat jendela:
  //   flash_sale_start = NOW(), flash_sale_end = NOW() + durationMinutes
  // Lalu kuota Redis langsung di-warmup agar TIER 1 pre-check berfungsi.
  static async startFlashSale(durationMinutes) {
    // Item yang sudah berakhir tidak boleh hidup lagi — "Mulai Sekarang" hanya
    // mengaktifkan produk yang masih terkonfigurasi (belum expired/killswitch).
    await FlashSaleService.expireEndedFlashSales();

    const updateResult = await db.query(
      `UPDATE products
       SET flash_sale_start = NOW(),
           flash_sale_end = NOW() + make_interval(mins => $1)
       WHERE is_flash_sale = TRUE AND flash_sale_price IS NOT NULL
       RETURNING id`,
      [durationMinutes]
    );

    const started = updateResult.rowCount || 0;
    if (started === 0) {
      throw new AppError(
        'No flash sale items configured yet. Add at least one product first.',
        422,
        'NO_FLASH_SALE_ITEMS'
      );
    }

    // Warmup kuota Redis (graceful: gagal tidak fatal).
    let warmup;
    try {
      warmup = await FlashSaleService.warmupFlashSaleStock();
    } catch (err) {
      console.warn(`[flashsale] startFlashSale: warmup failed: ${err.message}`);
    }

    // Ambil jendela sesi yang baru dibuat untuk respons frontend.
    const sessionResult = await db.query(
      `SELECT MIN(flash_sale_start) AS start_time, MAX(flash_sale_end) AS end_time
       FROM products
       WHERE is_flash_sale = TRUE AND flash_sale_price IS NOT NULL`
    );
    const session = sessionResult.rows[0] || {};

    return {
      started,
      startTime: session.start_time || null,
      endTime: session.end_time || null,
      warmed: warmup ? warmup.warmed : 0,
    };
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
