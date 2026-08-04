// P6.2 — Flash sale controller.
// Layer ini HANYA membaca req (params/query/body/user), memanggil service,
// dan mengirim respons — TANPA SQL & TANPA Redis (AGENTS.md modular rules).
const flashsaleService = require('./flashsale.service');
const { AppError, ValidationError } = require('../../utils/CustomError');

function validateCheckout(body = {}) {
  const errors = [];

  const productId = body.productId;
  if (productId === undefined || productId === null || !Number.isInteger(Number(productId)) || Number(productId) <= 0) {
    errors.push({ field: 'productId', message: 'productId must be a positive integer' });
  }

  const quantity = body.quantity === undefined || body.quantity === null ? 1 : body.quantity;
  if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
    errors.push({ field: 'quantity', message: 'quantity must be an integer greater than or equal to 1' });
  }

  return { errors, productId: Number(productId), quantity: Number(quantity) };
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
    const { errors, productId, quantity } = validateCheckout(req.body);
    if (errors.length > 0) {
      throw new ValidationError('Flash sale checkout validation failed', errors);
    }
    const order = await flashsaleService.checkout(req.user.id, productId, quantity);
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
