// P2.2 — Guest session tracker.
// Reads `X-Guest-ID` header; validates UUID v4. If missing/invalid, generates a new
// UUID v4 and persists it via response header `X-Guest-ID` + cookie `guest_id` (30 days).
// Never overwrites a valid guest id sent by the client.
const { v4: uuidv4 } = require('uuid');

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuidV4(value) {
  return typeof value === 'string' && UUID_V4_REGEX.test(value);
}

const GUEST_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 hari

function guestTracker(req, res, next) {
  const headerGuestId = req.headers['x-guest-id'];

  // Header valid — pakai apa adanya, jangan timpa.
  if (isValidUuidV4(headerGuestId)) {
    req.guestId = headerGuestId;
    return next();
  }

  // Fallback: cookie guest_id yang valid dari kunjungan sebelumnya.
  const cookieGuestId = req.cookies && req.cookies.guest_id;
  if (isValidUuidV4(cookieGuestId)) {
    req.guestId = cookieGuestId;
    return next();
  }

  // Tidak ada identitas valid — generate UUID baru + persist ke header & cookie.
  const newGuestId = uuidv4();
  req.guestId = newGuestId;
  res.setHeader('X-Guest-ID', newGuestId);
  res.cookie('guest_id', newGuestId, {
    maxAge: GUEST_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });

  return next();
}

module.exports = guestTracker;
