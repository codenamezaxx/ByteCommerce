// P2.2 — Global error handler (must be mounted LAST in Express).
// AppError subclasses map to their own statusCode; anything else is a 500.
const config = require('../config/env');
const { AppError } = require('../utils/CustomError');

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by the 4-arg signature
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let errors = [];

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    errors = err.errors || [];
  } else if (err && err.type === 'entity.parse.failed') {
    // Malformed JSON body from express.json()
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON payload';
  } else if (err && err.name === 'SyntaxError' && err.status === 400) {
    statusCode = 400;
    code = 'BAD_REQUEST';
    message = 'Malformed request body';
  }

  // Always log; stack trace only printed in non-production.
  const logLine = `[error] ${req.method} ${req.originalUrl} -> ${statusCode} ${message}`;
  if (statusCode >= 500) {
    console.error(logLine, err);
  } else {
    console.warn(logLine);
  }

  const body = { success: false, message, code };
  if (errors.length > 0) {
    body.errors = errors;
  }
  // Never expose stack trace in production.
  if (!config.isProduction && statusCode >= 500 && err && err.stack) {
    body.stack = err.stack;
  }

  return res.status(statusCode).json(body);
}

module.exports = errorHandler;
