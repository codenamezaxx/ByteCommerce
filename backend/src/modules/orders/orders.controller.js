// P7.2 — Order controller.
// Layer ini HANYA membaca req (params/query/user), memanggil service, dan
// mengirim respons — TANPA SQL (AGENTS.md modular rules).
const ordersService = require('./orders.service');
const { ValidationError } = require('../../utils/CustomError');

const MAX_LIMIT = 100;
// Nilai valid dari CHECK constraint schema orders.status (database/init.sql).
const ORDER_STATUSES = ['PENDING', 'PAID', 'FAILED', 'CANCELLED'];

// --- Query param parsers ------------------------------------------------------

function parsePositiveInt(value, field, { min, max, fallback }, errors) {
  if (value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || (max !== null && num > max)) {
    errors.push({
      field,
      message: `${field} must be an integer between ${min} and ${max === null ? 'unlimited' : max}`,
    });
    return fallback;
  }
  return num;
}

// Status filter: case-insensitive (input di-uppercase), divalidasi terhadap
// daftar status di schema.
function parseStatusFilter(value, errors) {
  if (value === undefined || value === '') return null;
  const status = String(value).toUpperCase();
  if (!ORDER_STATUSES.includes(status)) {
    errors.push({
      field: 'status',
      message: `status must be one of: ${ORDER_STATUSES.join(', ')}`,
    });
    return null;
  }
  return status;
}

// --- Handlers -------------------------------------------------------------------

const ordersController = {
  list: async (req, res) => {
    const errors = [];
    const page = parsePositiveInt(req.query.page, 'page', { min: 1, max: null, fallback: 1 }, errors);
    const limit = parsePositiveInt(req.query.limit, 'limit', { min: 1, max: MAX_LIMIT, fallback: 20 }, errors);
    const status = parseStatusFilter(req.query.status, errors);

    if (errors.length > 0) {
      throw new ValidationError('Invalid query parameters', errors);
    }

    const result = await ordersService.list({
      userId: req.user.id,
      isAdmin: req.user.role === 'ADMIN',
      page,
      limit,
      status,
    });
    res.success(result, 'Orders fetched successfully');
  },

  detail: async (req, res) => {
    // Validasi id param — non-integer tidak boleh 500.
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError('Invalid order id', [
        { field: 'id', message: 'id must be a positive integer' },
      ]);
    }

    const order = await ordersService.detail(id, req.user.id, req.user.role === 'ADMIN');
    res.success(order, 'Order fetched successfully');
  },
};

module.exports = ordersController;
