// P2.4 — Express app initialization & middleware pipeline.
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const config = require('./config/env');
const { success, created, error } = require('./utils/responseFormatter');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// --- Global middleware -----------------------------------------------------
const corsOrigin = config.clientOrigin === '*' ? '*' : config.clientOrigin.split(',');
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// --- Mount responseFormatter sebagai res helpers ---------------------------
// res.success(data, message?, statusCode?)
// res.created(data, message?)
// res.error(message?, code?, statusCode?, errors?)
app.use((req, res, next) => {
  res.success = (data = null, message = 'Success', statusCode = 200) =>
    success(res, data, message, statusCode);
  res.created = (data = null, message = 'Created') => created(res, data, message);
  res.error = (message = 'Error', code = 'BAD_REQUEST', statusCode = 400, errors = []) =>
    error(res, message, code, statusCode, errors);
  next();
});

// --- Route modules ----------------------------------------------------------
// Daftar route modules. Setiap modul mengekspos express.Router.
const flashsaleRoutes = require('./modules/flashsale/flashsale.routes');

const routeModules = [
  { path: '/api/auth', router: require('./modules/auth/auth.routes') },
  { path: '/api/products', router: require('./modules/products/products.routes') },
  { path: '/api/cart', router: require('./modules/cart/cart.routes') },
  { path: '/api/flashsale', router: flashsaleRoutes.router },
  { path: '/api/admin/flashsale', router: flashsaleRoutes.adminRouter },
  { path: '/api/orders', router: require('./modules/orders/orders.routes') },
  { path: '/api/admin', router: require('./modules/admin/admin.routes') },
];

for (const routeModule of routeModules) {
  app.use(routeModule.path, routeModule.router);
}

// --- Public routes ----------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'OK', data: { status: 'up' } });
});

app.get('/', (req, res) => {
  res.json({ success: true, message: 'ByteCommerce API', data: { version: '0.1.0' } });
});

// --- 404 handler (setelah semua routes) -------------------------------------
app.use((req, res) => {
  res.error(`Route not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND', 404);
});

// --- Global error handler (PALING AKHIR) -------------------------------------
app.use(errorHandler);

module.exports = app;
