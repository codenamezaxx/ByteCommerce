// P4.2 — Product controller.
// Layer ini HANYA membaca req (params/query/body/user), memanggil service,
// dan mengirim respons — TANPA SQL (AGENTS.md modular rules).
const productsService = require('./products.service');
const { ValidationError } = require('../../utils/CustomError');

const MAX_LIMIT = 100;
const MAX_PRICE = 9999999999.99; // batas atas DECIMAL(12,2)
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

function parseFlashSale(value, errors) {
  if (value === undefined || value === '') return null;
  const v = String(value).toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  errors.push({ field: 'flash_sale', message: 'flash_sale must be true or false' });
  return null;
}

function parsePriceFilter(value, field, errors) {
  if (value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > MAX_PRICE) {
    errors.push({ field, message: `${field} must be a non-negative number` });
    return null;
  }
  return num;
}

function parseIdParam(value) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new ValidationError('Invalid product id', [
      { field: 'id', message: 'id must be a positive integer' },
    ]);
  }
  return num;
}

// --- Body validators -----------------------------------------------------------

function validateCreate(body = {}) {
  const errors = [];

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) errors.push({ field: 'name', message: 'name is required' });
  else if (name.length > 255) errors.push({ field: 'name', message: 'name must be at most 255 characters' });

  const price = body.price;
  if (price === undefined || price === null || price === '') {
    errors.push({ field: 'price', message: 'price is required' });
  } else if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > MAX_PRICE) {
    errors.push({ field: 'price', message: 'price must be a number greater than 0' });
  }

  const stock = body.stock;
  if (stock === undefined || stock === null || stock === '') {
    errors.push({ field: 'stock', message: 'stock is required' });
  } else if (!Number.isInteger(stock) || stock < 0) {
    errors.push({ field: 'stock', message: 'stock must be a non-negative integer' });
  }

  if (body.is_flash_sale !== undefined && typeof body.is_flash_sale !== 'boolean') {
    errors.push({ field: 'is_flash_sale', message: 'is_flash_sale must be a boolean' });
  }

  if (body.is_flash_sale === true) {
    const fp = body.flash_sale_price;
    if (fp === undefined || fp === null || fp === '') {
      errors.push({ field: 'flash_sale_price', message: 'flash_sale_price is required when is_flash_sale is true' });
    } else if (typeof fp !== 'number' || !Number.isFinite(fp) || fp <= 0 || fp > MAX_PRICE) {
      errors.push({ field: 'flash_sale_price', message: 'flash_sale_price must be a number greater than 0' });
    }
  } else if (body.flash_sale_price !== undefined) {
    const fp = body.flash_sale_price;
    if (typeof fp !== 'number' || !Number.isFinite(fp) || fp <= 0 || fp > MAX_PRICE) {
      errors.push({ field: 'flash_sale_price', message: 'flash_sale_price must be a number greater than 0' });
    }
  }

  if (
    body.description !== undefined &&
    (typeof body.description !== 'string' || body.description.length > 10000)
  ) {
    errors.push({ field: 'description', message: 'description must be a string of at most 10000 characters' });
  }

  // slug & image_url BELUM ada sebagai kolom di schema — divalidasi tipe saja (forward-compatible).
  if (body.slug !== undefined && (typeof body.slug !== 'string' || !SLUG_REGEX.test(body.slug))) {
    errors.push({ field: 'slug', message: 'slug must be a lowercase URL-safe string' });
  }
  if (
    body.image_url !== undefined &&
    (typeof body.image_url !== 'string' || body.image_url.length > 2048)
  ) {
    errors.push({ field: 'image_url', message: 'image_url must be a string of at most 2048 characters' });
  }

  return errors;
}

function validateUpdate(body = {}) {
  const errors = [];

  if (Object.keys(body).length === 0) {
    errors.push({ field: 'body', message: 'at least one field to update is required' });
  }

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) errors.push({ field: 'name', message: 'name must not be empty' });
    else if (name.length > 255) errors.push({ field: 'name', message: 'name must be at most 255 characters' });
  }

  if (body.price !== undefined) {
    const price = body.price;
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > MAX_PRICE) {
      errors.push({ field: 'price', message: 'price must be a number greater than 0' });
    }
  }

  if (body.stock !== undefined) {
    if (!Number.isInteger(body.stock) || body.stock < 0) {
      errors.push({ field: 'stock', message: 'stock must be a non-negative integer' });
    }
  }

  if (body.is_flash_sale !== undefined && typeof body.is_flash_sale !== 'boolean') {
    errors.push({ field: 'is_flash_sale', message: 'is_flash_sale must be a boolean' });
  }

  if (body.is_flash_sale === true && body.flash_sale_price === undefined) {
    errors.push({ field: 'flash_sale_price', message: 'flash_sale_price is required when is_flash_sale is true' });
  }
  if (body.flash_sale_price !== undefined) {
    const fp = body.flash_sale_price;
    if (typeof fp !== 'number' || !Number.isFinite(fp) || fp <= 0 || fp > MAX_PRICE) {
      errors.push({ field: 'flash_sale_price', message: 'flash_sale_price must be a number greater than 0' });
    }
  }

  if (
    body.description !== undefined &&
    (typeof body.description !== 'string' || body.description.length > 10000)
  ) {
    errors.push({ field: 'description', message: 'description must be a string of at most 10000 characters' });
  }

  return errors;
}

// --- Handlers -------------------------------------------------------------------

const productsController = {
  list: async (req, res) => {
    const errors = [];
    const page = parsePositiveInt(req.query.page, 'page', { min: 1, max: null, fallback: 1 }, errors);
    const limit = parsePositiveInt(req.query.limit, 'limit', { min: 1, max: MAX_LIMIT, fallback: 10 }, errors);
    const flashSale = parseFlashSale(req.query.flash_sale, errors);
    const minPrice = parsePriceFilter(req.query.min_price, 'min_price', errors);
    const maxPrice = parsePriceFilter(req.query.max_price, 'max_price', errors);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    if (errors.length > 0) {
      throw new ValidationError('Invalid query parameters', errors);
    }

    const result = await productsService.list({ page, limit, search, flashSale, minPrice, maxPrice });
    res.success(result, 'Products fetched successfully');
  },

  detail: async (req, res) => {
    const id = parseIdParam(req.params.id);
    const product = await productsService.detail(id);
    res.success(product, 'Product fetched successfully');
  },

  create: async (req, res) => {
    const errors = validateCreate(req.body);
    if (errors.length > 0) {
      throw new ValidationError('Product validation failed', errors);
    }
    const product = await productsService.create(req.body);
    res.created(product, 'Product created successfully');
  },

  update: async (req, res) => {
    const id = parseIdParam(req.params.id);
    const errors = validateUpdate(req.body);
    if (errors.length > 0) {
      throw new ValidationError('Product validation failed', errors);
    }
    const product = await productsService.update(id, req.body);
    res.success(product, 'Product updated successfully');
  },

  remove: async (req, res) => {
    const id = parseIdParam(req.params.id);
    await productsService.remove(id);
    res.success({ id }, 'Product deleted successfully');
  },
};

module.exports = productsController;
