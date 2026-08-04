// P6.2 — Flash sale controller.
// Layer ini HANYA membaca req (params/query/body/user), memanggil service,
// dan mengirim respons — TANPA SQL & TANPA Redis (AGENTS.md modular rules).
const flashsaleService = require('./flashsale.service');
const { AppError, ValidationError } = require('../../utils/CustomError');

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

// Validasi body POST /api/flashsale/checkout.
// Mengembalikan dua kelompok error:
//   * errors        → pelanggaran tipe dasar (productId/quantity) → 400 (pola existing).
//   * shippingErrors → pelanggaran nilai shipping/paymentMethod → 422 (kontrak API).
function validateCheckout(body = {}) {
  const errors = [];
  const shippingErrors = [];

  const productId = body.productId;
  if (productId === undefined || productId === null || !Number.isInteger(Number(productId)) || Number(productId) <= 0) {
    errors.push({ field: 'productId', message: 'productId must be a positive integer' });
  }

  const quantity = body.quantity === undefined || body.quantity === null ? 1 : body.quantity;
  if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
    errors.push({ field: 'quantity', message: 'quantity must be an integer greater than or equal to 1' });
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
    productId: Number(productId),
    quantity: Number(quantity),
    shipping,
    paymentMethod,
  };
}

// Validasi body POST /api/admin/flashsale/items.
// Catatan: pelanggaran aturan bisnis pada endpoint ini memakai status 422
// (Unprocessable Entity) sesuai spec endpoint admin flash sale items.
function validateSetFlashSaleItem(body = {}) {
  const errors = [];

  const productId = body.productId;
  if (productId === undefined || productId === null || !Number.isInteger(Number(productId)) || Number(productId) <= 0) {
    errors.push({ field: 'productId', message: 'productId must be a positive integer' });
  }

  const flashSalePrice = body.flashSalePrice;
  if (flashSalePrice === undefined || flashSalePrice === null || flashSalePrice === '') {
    errors.push({ field: 'flashSalePrice', message: 'flashSalePrice is required' });
  } else if (typeof flashSalePrice !== 'number' || !Number.isFinite(flashSalePrice) || flashSalePrice <= 0) {
    errors.push({ field: 'flashSalePrice', message: 'flashSalePrice must be a number greater than 0' });
  }

  const flashSaleStock = body.flashSaleStock;
  if (flashSaleStock === undefined || flashSaleStock === null || flashSaleStock === '') {
    errors.push({ field: 'flashSaleStock', message: 'flashSaleStock is required' });
  } else if (!Number.isInteger(flashSaleStock) || flashSaleStock < 0) {
    errors.push({ field: 'flashSaleStock', message: 'flashSaleStock must be a non-negative integer' });
  }

  // startAt/endAt opsional; bila diisi harus berupa ISO date yang valid.
  let startAt = null;
  if (body.startAt !== undefined && body.startAt !== null && body.startAt !== '') {
    const parsed = new Date(body.startAt);
    if (Number.isNaN(parsed.getTime())) {
      errors.push({ field: 'startAt', message: 'startAt must be a valid ISO date string' });
    } else {
      startAt = parsed.toISOString();
    }
  }

  let endAt = null;
  if (body.endAt !== undefined && body.endAt !== null && body.endAt !== '') {
    const parsed = new Date(body.endAt);
    if (Number.isNaN(parsed.getTime())) {
      errors.push({ field: 'endAt', message: 'endAt must be a valid ISO date string' });
    } else {
      endAt = parsed.toISOString();
    }
  }

  return {
    errors,
    productId: Number(productId),
    flashSalePrice,
    flashSaleStock,
    startAt,
    endAt,
  };
}

function parseProductIdParam(value) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new ValidationError('Invalid product id', [
      { field: 'productId', message: 'productId must be a positive integer' },
    ]);
  }
  return num;
}

const flashsaleController = {
  getActiveFlashSale: async (req, res) => {
    const products = await flashsaleService.getActiveFlashSale();
    res.success({ products, count: products.length }, 'Active flash sale products fetched');
  },

  checkout: async (req, res) => {
    const { errors, shippingErrors, productId, quantity, shipping, paymentMethod } = validateCheckout(req.body);
    if (errors.length > 0) {
      // Pelanggaran tipe dasar (productId/quantity) — pola existing → 400.
      throw new ValidationError('Flash sale checkout validation failed', errors);
    }
    if (shippingErrors.length > 0) {
      // Payload JSON valid tapi shipping/paymentMethod gagal aturan → 422 (kontrak API).
      throw new AppError('Flash sale checkout validation failed', 422, 'VALIDATION_ERROR', shippingErrors);
    }
    const order = await flashsaleService.checkout(req.user.id, productId, quantity, shipping, paymentMethod);
    res.created(order, 'Flash sale purchase successful');
  },

  warmup: async (req, res) => {
    const result = await flashsaleService.warmupFlashSaleStock();
    res.success(result, 'Flash sale stock warmed up to Redis');
  },

  killswitch: async (req, res) => {
    const result = await flashsaleService.killswitchFlashSale();
    res.success(result, 'Flash sale disabled');
  },

  setFlashSaleItem: async (req, res) => {
    const { errors, productId, flashSalePrice, flashSaleStock, startAt, endAt } = validateSetFlashSaleItem(req.body);
    if (errors.length > 0) {
      // 422 = payload JSON valid tapi gagal aturan bisnis/validasi nilai.
      throw new AppError('Flash sale item validation failed', 422, 'VALIDATION_ERROR', errors);
    }
    const product = await flashsaleService.setFlashSaleItem({
      productId,
      flashSalePrice,
      flashSaleStock,
      startAt,
      endAt,
    });
    res.created(product, 'Flash sale item created');
  },

  removeFlashSaleItem: async (req, res) => {
    const productId = parseProductIdParam(req.params.productId);
    const product = await flashsaleService.removeFlashSaleItem(productId);
    res.success(product, 'Flash sale item removed');
  },
};

module.exports = flashsaleController;
