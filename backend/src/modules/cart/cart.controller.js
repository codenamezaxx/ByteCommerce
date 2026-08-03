// P5.2 — Cart controller.
// Layer ini HANYA membaca req (params/query/body/user/guestId), memanggil service,
// dan mengirim respons — TANPA SQL (AGENTS.md modular rules).
const cartService = require('./cart.service');
const { ValidationError } = require('../../utils/CustomError');

function parsePositiveInt(value, field) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new ValidationError('Invalid parameters', [
      { field, message: `${field} must be a positive integer` },
    ]);
  }
  return num;
}

function resolveCartOwner(req) {
  return {
    userId: (req.user && req.user.id) || null,
    guestId: req.guestId || null,
  };
}

function validateAddItem(body = {}) {
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

const cartController = {
  getCart: async (req, res) => {
    const cart = await cartService.getOrCreateCart(resolveCartOwner(req));
    const { items, total } = await cartService.getCartItems(cart.id);
    res.success({ cart, items, total }, 'Cart fetched successfully');
  },

  addItem: async (req, res) => {
    const { errors, productId, quantity } = validateAddItem(req.body);
    if (errors.length > 0) {
      throw new ValidationError('Cart item validation failed', errors);
    }

    const cart = await cartService.getOrCreateCart(resolveCartOwner(req));
    const item = await cartService.addItem(cart.id, productId, quantity);
    res.created(item, 'Item added to cart');
  },

  updateItemQuantity: async (req, res) => {
    const itemId = parsePositiveInt(req.params.itemId, 'itemId');

    const quantity = req.body && req.body.quantity;
    if (quantity === undefined || quantity === null || !Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
      throw new ValidationError('Quantity validation failed', [
        { field: 'quantity', message: 'quantity must be an integer greater than or equal to 1' },
      ]);
    }

    const cart = await cartService.getOrCreateCart(resolveCartOwner(req));
    const item = await cartService.updateItemQuantity(cart.id, itemId, Number(quantity));
    res.success(item, 'Item quantity updated');
  },

  removeItem: async (req, res) => {
    const itemId = parsePositiveInt(req.params.itemId, 'itemId');

    const cart = await cartService.getOrCreateCart(resolveCartOwner(req));
    await cartService.removeItem(cart.id, itemId);
    res.success({ id: itemId }, 'Item removed from cart');
  },

  mergeCart: async (req, res) => {
    const result = await cartService.mergeGuestCart(req.guestId, req.user.id);
    res.success(result, 'Cart merged successfully');
  },
};

module.exports = cartController;
