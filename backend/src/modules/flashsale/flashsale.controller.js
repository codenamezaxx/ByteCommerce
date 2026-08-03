// P6.2 — Flash sale controller.
// Layer ini HANYA membaca req (params/query/body/user), memanggil service,
// dan mengirim respons — TANPA SQL & TANPA Redis (AGENTS.md modular rules).
const flashsaleService = require('./flashsale.service');
const { ValidationError } = require('../../utils/CustomError');

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
};

module.exports = flashsaleController;
