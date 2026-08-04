// P4.4 — Storage layer untuk gambar produk.
// Bertanggung jawab menulis/menghapus file gambar ke disk di bawah
// uploads/products/ dan menghasilkan path publik `/uploads/products/<file>`.
//
// KEY convention: key SELALU mengandung prefix relatif `products/` terhadap
// UPLOAD_ROOT, contoh: `products/<uuid>.png`. Dengan begitu:
//   * save()      menulis ke <UPLOAD_ROOT>/products/<uuid>.<ext>
//   * remove()    me-resolve key langsung terhadap UPLOAD_ROOT (aman anti traversal)
//   * getPublicPath() = /uploads/<key> = /uploads/products/<file>
//   * seed image (`products/<id>-<slug>.jpg`) ikut konsisten tanpa diblokir.
//
// Keamanan:
//   * Extensi SELALU ditentukan dari whitelist MIME (jpeg/png/webp), TIDAK
//     pernah dari originalname user (mencegah eksekusi file berbahaya).
//   * Nama file upload memakai crypto.randomUUID() — tidak bisa ditebak/ditabrak.
//   * Setiap key di-resolve lalu diverifikasi tetap berada di bawah root
//     uploads (anti path traversal saat remove).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Whitelist MIME → ekstensi file.
const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Root uploads dari env UPLOAD_DIR (default 'uploads'), di-resolve terhadap cwd
// (backend saat `node server.js`; /app di dalam container Docker).
const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || 'uploads');
const PRODUCTS_DIR = path.join(UPLOAD_ROOT, 'products');

// Pastikan folder tujuan ada (idempotent, aman dipanggil berulang).
fs.mkdirSync(PRODUCTS_DIR, { recursive: true });

function isAllowedMime(mime) {
  return Object.prototype.hasOwnProperty.call(MIME_EXT, mime);
}

function extForMime(mime) {
  return MIME_EXT[mime] || null;
}

// Resolve key relatif menjadi path absolut, dengan guard anti path traversal.
// Key contoh: `products/<uuid>.png` → <UPLOAD_ROOT>/products/<uuid>.png
function resolveKey(key) {
  const full = path.resolve(UPLOAD_ROOT, key);
  if (full !== UPLOAD_ROOT && !full.startsWith(UPLOAD_ROOT + path.sep)) {
    throw new Error(`Invalid upload key: ${key}`);
  }
  return full;
}

// Menyimpan buffer gambar ke <UPLOAD_ROOT>/products/<uuid>.<ext>.
// Mengembalikan KEY (`products/<uuid>.<ext>`) — yang disimpan ke kolom
// products.image_url. Nama tidak pernah diambil dari originalname.
async function save(buffer, { mime }) {
  const ext = extForMime(mime);
  if (!ext) {
    throw new Error(`Unsupported image mime: ${mime}`);
  }
  const key = `products/${crypto.randomUUID()}.${ext}`;
  const filePath = resolveKey(key);
  await fs.promises.writeFile(filePath, buffer);
  return key;
}

// Menghapus file. ENOENT dianggap sukses (file sudah tidak ada).
async function remove(key) {
  if (!key) return;
  const filePath = resolveKey(key);
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

// Path publik yang dipakai klien untuk memuat gambar via static serving.
function getPublicPath(key) {
  return `/uploads/${key}`;
}

module.exports = {
  save,
  remove,
  getPublicPath,
  isAllowedMime,
  extForMime,
  UPLOAD_ROOT,
  PRODUCTS_DIR,
};
