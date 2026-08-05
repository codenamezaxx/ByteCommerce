const db = require('../src/config/db');
const Redis = require('ioredis');
const redis = new Redis('redis://localhost:6379');

(async () => {
  // Restore product 2 stock
  await db.query('UPDATE products SET flash_sale_stock = 10, stock = 10 WHERE id = 2');
  await redis.set('flash_sale:stock:2', 10);
  console.log('Product 2 stock restored to 10');

  // Cleanup load test users
  const r = await db.query("DELETE FROM users WHERE email LIKE 'loadtest_%@bytecommerce.test'");
  console.log('Cleaned up', r.rowCount, 'load test users');

  await redis.disconnect();
  await db.pool.end();
})();
