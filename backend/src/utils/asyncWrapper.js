// P2.3 — Wraps an async route handler so rejected promises are
// forwarded to the global error middleware via next(err).
const asyncWrapper = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncWrapper;
