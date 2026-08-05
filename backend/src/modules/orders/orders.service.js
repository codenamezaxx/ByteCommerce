// P7.3 — Order service: logika bisnis order.
// Murni baca dari PostgreSQL (Redis TIDAK dipakai — TASK.md).
// Semua query parameterized ($1, $2, ...). Dynamic WHERE dibangun dengan array
// params + placeholder counter — TANPA string concatenation nilai user.
const db = require('../../config/db');
const { AppError, NotFoundError } = require('../../utils/CustomError');

const ORDER_COLUMNS =
  'id, user_id, total_amount, status, created_at, ' +
  'shipping_name, shipping_phone, shipping_address, shipping_city, shipping_province, ' +
  'shipping_postal_code, shipping_note, payment_method';

// pg mengembalikan DECIMAL/NUMERIC sebagai string — normalisasi ke Number untuk JSON.
function mapOrder(row) {
  if (!row) return row;
  return { ...row, total_amount: Number(row.total_amount) };
}

class OrdersService {
  // Checkout keranjang REGULER (non-flash-sale). Semua logika atomik ada di
  // Stored Procedure create_cart_order (row-lock FOR UPDATE, zero-oversell,
  // total & decrement dihitung server-side). Wajib dipanggil dengan
  // req.user.id (JWT). Redis TIDAK dipakai pada alur ini.
  // shipping: { name, phone, address, city, province, postalCode, note? }
  // paymentMethod: 'BANK_TRANSFER' | 'COD' | 'QRIS'
  static async checkoutCart(userId, productIds, shipping = {}, paymentMethod = 'BANK_TRANSFER') {
    let result;
    try {
      result = await db.query(
        `SELECT create_cart_order($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) AS order_id`,
        [
          userId,
          productIds,
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
      // Mapping SAMA dengan flashsale.service.checkout (lines 108-128).
      if (err && err.message) {
        if (err.message === 'OUT_OF_STOCK') {
          throw new AppError('Product is out of stock', 400, 'OUT_OF_STOCK_DB');
        }
        if (err.message === 'PRODUCT_NOT_FOUND') {
          throw new NotFoundError('Product not found', [], 'PRODUCT_NOT_FOUND');
        }
        if (err.message === 'EMPTY_CART') {
          throw new AppError('Cart is empty', 422, 'VALIDATION_ERROR', [
            { field: 'productIds', message: 'Your cart is empty' },
          ]);
        }
      }
      throw err;
    }

    const orderId = result.rows[0].order_id;

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

  // List order. Non-admin hanya melihat order miliknya; admin melihat SEMUA order.
  static async list({ userId = null, isAdmin = false, page = 1, limit = 20, status = null } = {}) {
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (!isAdmin) {
      conditions.push(`o.user_id = $${idx}`);
      params.push(userId);
      idx += 1;
    }
    if (status) {
      conditions.push(`o.status = $${idx}`);
      params.push(status);
      idx += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total tanpa LIMIT/OFFSET.
    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM orders o ${whereClause}`,
      params
    );
    const total = countResult.rows[0].total;

    params.push(limit, offset);
    // LEFT JOIN order_items untuk item_count per order. GROUP BY id (PK) cukup
    // karena kolom lain orders bergantung fungsional pada PK.
    const listResult = await db.query(
      `SELECT o.id, o.user_id, o.total_amount, o.status, o.created_at,
              o.shipping_name, o.shipping_phone, o.shipping_address, o.shipping_city,
              o.shipping_province, o.shipping_postal_code, o.shipping_note, o.payment_method,
              COUNT(oi.id)::int AS item_count
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       ${whereClause}
       GROUP BY o.id
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    return {
      orders: listResult.rows.map(mapOrder),
      total,
      page,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  // Detail order + items (JOIN products untuk nama produk).
  // Non-admin hanya bisa melihat order miliknya; bila tidak ditemukan ATAU bukan
  // miliknya → 404 ORDER_NOT_FOUND yang sama (hindari info leak via 403/404).
  static async detail(orderId, userId = null, isAdmin = false) {
    const params = [orderId];
    let where = 'id = $1';
    if (!isAdmin) {
      where = 'id = $1 AND user_id = $2';
      params.push(userId);
    }

    const headerResult = await db.query(
      `SELECT ${ORDER_COLUMNS} FROM orders WHERE ${where}`,
      params
    );
    if (!headerResult.rows[0]) {
      throw new NotFoundError('Order not found', [], 'ORDER_NOT_FOUND');
    }
    const order = mapOrder(headerResult.rows[0]);

    const itemsResult = await db.query(
      `SELECT oi.id, oi.product_id, oi.quantity, oi.price_at_purchase, p.name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1
       ORDER BY oi.id ASC`,
      [orderId]
    );

    order.items = itemsResult.rows.map((row) => ({
      id: row.id,
      product_id: row.product_id,
      name: row.name,
      quantity: row.quantity,
      price_at_purchase: Number(row.price_at_purchase),
      subtotal: Number(row.price_at_purchase) * row.quantity,
    }));

    return order;
  }
}

module.exports = OrdersService;
