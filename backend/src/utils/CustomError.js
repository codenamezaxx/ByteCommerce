// P2.3 — AppError base class + operational error subclasses.
// isOperational=true marks expected, controllable errors (not bugs/crashes).

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', errors = []) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.errors = Array.isArray(errors) ? errors : [];
    Error.captureStackTrace(this, this.constructor);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', errors = [], code = 'AUTHENTICATION_FAILED') {
    super(message, 401, code, errors);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden access', errors = [], code = 'FORBIDDEN') {
    super(message, 403, code, errors);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', errors = [], code = 'NOT_FOUND') {
    super(message, 404, code, errors);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = [], code = 'VALIDATION_ERROR') {
    super(message, 400, code, errors);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict', errors = [], code = 'CONFLICT') {
    super(message, 409, code, errors);
  }
}

module.exports = {
  AppError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
};
