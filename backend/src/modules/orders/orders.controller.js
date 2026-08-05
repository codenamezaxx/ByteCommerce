// P7.2 — Order controller.
// Layer ini HANYA membaca req (params/query/user), memanggil service, dan
// mengirim respons — TANPA SQL (AGENTS.md modular rules).
const ordersService = require('./orders.service');
const { AppError, ValidationError } = require('../../utils/CustomError');

const MAX_LIMIT = 100;
// Nilai valid dari CHECK constraint schema orders.status (database/init.sql).
const ORDER_STATUSES = ['PENDING', 'PAID', 'FAILED', 'CANCELLED'];

// Metode pembayaran valid sesuai CHECK constraint schema orders.payment_method.
const VALID_PAYMENT_METHODS = ['BANK_TRANSFER', 'COD', 'QRIS'];

// Field alamat pengiriman wajib + batas panjang (sesuai kolom orders).
const SHIPPING_REQUIRED_FIELDS = [
  { key: 'name', max: 100 },
  { key: 'phone', max: 20 },
  { key: 'address', max: null }, // TEXT
  { key: 'city', max: 100 },
  { key: 'province', max: 100 },
  { key: 'postalCode', max: 20 },
];

// Validasi body POST /api/orders/checkout.
// Mengembalikan dua kelompok error (pola sama dengan flashsale.controller):
//   * errors        → pelanggaran tipe dasar (productIds) → 400.
//   * shippingErrors → pelanggaran nilai shipping/paymentMethod → 422 (kontrak API).
function validateCartCheckout(body = {}) {
  const errors = [];
  const shippingErrors = [];

  // productIds: array non-kosong berisi bilangan bulat positif.
  const rawProductIds = body.productIds;
  let productIds = [];
  if (!Array.isArray(rawProductIds) || rawProductIds.length === 0) {
    errors.push({ field: 'productIds', message: 'productIds must be a non-empty array of positive integers' });
  } else {
    const normalized = [];
    for (const pid of rawProductIds) {
      const num = Number(pid);
      if (!Number.isInteger(num) || num <= 0) {
        errors.push({ field: 'productIds', message: 'productIds must contain only positive integers' });
        break;
      }
      normalized.push(num);
    }
    // Dedupe agar produk yang sama tidak diproses dua kali dalam satu checkout.
    productIds = [...new Set(normalized)];
  }

  // --- shipping object ---
  const rawShipping = body.shipping && typeof body.shipping === 'object' && !Array.isArray(body.shipping)
    ? body.shipping
    : {};
  const shipping = {};

  for (const { key, max } of SHIPPING_REQUIRED_FIELDS) {
    const value = typeof rawShipping[key] === 'string' ? rawShipping[key].trim() : '';
    if (!value) {
      shippingErrors.push({ field: `shipping.${key}`, message: `shipping.${key} is required` });
    } else if (max !== null && value.length > max) {
      shippingErrors.push({ field: `shipping.${key}`, message: `shipping.${key} must be at most ${max} characters` });
    } else {
      shipping[key] = value;
    }
  }

  // note opsional (TEXT).
  const rawNote = rawShipping.note;
  if (rawNote !== undefined && rawNote !== null && rawNote !== '') {
    if (typeof rawNote !== 'string' || rawNote.length > 10000) {
      shippingErrors.push({ field: 'shipping.note', message: 'shipping.note must be a string of at most 10000 characters' });
    } else {
      shipping.note = rawNote.trim();
    }
  } else {
    shipping.note = null;
  }

  // --- paymentMethod ---
  const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod : '';
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    shippingErrors.push({
      field: 'paymentMethod',
      message: `paymentMethod must be one of: ${VALID_PAYMENT_METHODS.join(', ')}`,
    });
  }

  return {
    errors,
    shippingErrors,
    productIds,
    shipping,
    paymentMethod,
  };
}

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

  checkout: async (req, res) => {
    const { errors, shippingErrors, productIds, shipping, paymentMethod } = validateCartCheckout(req.body);
    if (errors.length > 0) {
      // Pelanggaran tipe dasar (productIds) — pola existing → 400.
      throw new ValidationError('Cart checkout validation failed', errors);
    }
    if (shippingErrors.length > 0) {
      // Payload JSON valid tapi shipping/paymentMethod gagal aturan → 422 (kontrak API).
      throw new AppError('Cart checkout validation failed', 422, 'VALIDATION_ERROR', shippingErrors);
    }
    const order = await ordersService.checkoutCart(req.user.id, productIds, shipping, paymentMethod);
    res.created(order, 'Order created successfully');
  },
};

module.exports = ordersController;
