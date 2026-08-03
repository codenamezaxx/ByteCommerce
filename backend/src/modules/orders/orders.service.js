// P7.3 — Order service: logika bisnis order.
// Murni baca dari PostgreSQL (Redis TIDAK dipakai — TASK.md).
// Semua query parameterized ($1, $2, ...). Dynamic WHERE dibangun dengan array
// params + placeholder counter — TANPA string concatenation nilai user.
const db = require('../../config/db');
const { NotFoundError } = require('../../utils/CustomError');

const ORDER_COLUMNS = 'id, user_id, total_amount, status, created_at';

// pg mengembalikan DECIMAL/NUMERIC sebagai string — normalisasi ke Number untuk JSON.
function mapOrder(row) {
  if (!row) return row;
  return { ...row, total_amount: Number(row.total_amount) };
}

class OrdersService {
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
