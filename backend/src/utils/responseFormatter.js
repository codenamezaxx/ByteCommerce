// P2.3 — Standardized API response format (AGENTS.md §4.2).
// Success: { success: true, message, data }
// Error:   { success: false, message, code, errors? }

function success(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

function created(res, data = null, message = 'Created') {
  return success(res, data, message, 201);
}

function error(res, message = 'Error', code = 'BAD_REQUEST', statusCode = 400, errors = []) {
  const body = { success: false, message, code };
  if (Array.isArray(errors) && errors.length > 0) {
    body.errors = errors;
  }
  return res.status(statusCode).json(body);
}

module.exports = { success, created, error };
