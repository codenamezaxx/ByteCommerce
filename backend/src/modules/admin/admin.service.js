// P8.1 — Admin service: metrics dashboard.
// Murni baca dari PostgreSQL (Redis TIDAK dipakai — metrics live Redis P8.2
// ditunda per TASK.md). Semua query parameterized ($1, $2, ...) meskipun
// endpoint ini tidak menerima user input.
const db = require('../../config/db');

const RECENT_ORDERS_LIMIT = 10;

class AdminService {
  static async getDashboardMetrics() {
    const [usersResult, productsResult, ordersTodayResult, flashSaleResult, recentOrdersResult] =
      await Promise.all([
        db.query('SELECT COUNT(*)::int AS total FROM users'),
        db.query('SELECT COUNT(*)::int AS total FROM products'),
        // created_at bertipe TIMESTAMPTZ (database/init.sql). CURRENT_DATE di-resolve
        // pada session timezone server sehingga "hari ini" konsisten dengan DB.
        db.query(
          'SELECT COUNT(*)::int AS total FROM orders WHERE created_at >= CURRENT_DATE'
        ),
        // DB adalah sumber kebenaran katalog flash sale (killswitch P6 hanya
        // zeroing Redis; produk tetap is_flash_sale = TRUE).
        db.query(
          'SELECT COUNT(*)::int AS total FROM products WHERE is_flash_sale = TRUE'
        ),
        db.query(
          `SELECT o.id, o.total_amount, o.status, o.created_at,
                  u.id AS user_id, u.name AS user_name, u.email AS user_email
           FROM orders o
           JOIN users u ON u.id = o.user_id
           ORDER BY o.created_at DESC, o.id DESC
           LIMIT $1`,
          [RECENT_ORDERS_LIMIT]
        ),
      ]);

    return {
      totalUsers: usersResult.rows[0].total,
      totalProducts: productsResult.rows[0].total,
      ordersToday: ordersTodayResult.rows[0].total,
      flashSaleActiveCount: flashSaleResult.rows[0].total,
      recentOrders: recentOrdersResult.rows.map((row) => ({
        id: row.id,
        user: {
          id: row.user_id,
          name: row.user_name,
          email: row.user_email,
        },
        total_amount: Number(row.total_amount),
        status: row.status,
        created_at: row.created_at,
      })),
    };
  }
}

module.exports = AdminService;
