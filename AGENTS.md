# AI Agent Guidelines & Coding Standards — ByteCommerce

> **Purpose**: Dokumen ini adalah panduan kerja wajib untuk semua AI Coding Assistant (seperti Kiro, OpenCode, Cursor, Windsurf, Copilot, dsb.) yang berkontribusi pada repositori **ByteCommerce**.
> **Core Principle**: Utamakan kestabilan transaksi (*ACID Compliance*), *high-concurrency safety*, dan pemisahan modul yang rapi. Jangan pernah mengubah keputusan arsitektur utama tanpa instruksi eksplisit dari pengguna.

---

## 1. Non-Negotiable Tech Stack Boundaries

Setiap kode yang dihasilkan **wajib** mematuhi batasan teknologi berikut:

* **Backend**: Node.js 20 LTS + **Express.js** (CommonJS Syntax: `require` / `module.exports`).
* **Database**: **PostgreSQL 16 Native** dengan driver `pg` (node-postgres).
  * ❌ **STRICTLY FORBIDDEN**: Dilarang menginstal atau menggunakan ORM/Query Builder seperti Prisma, Sequelize, TypeORM, atau Knex.
  * ✅ **REQUIRED**: Gunakan Raw SQL dengan *Parameterized Queries* (`$1, $2`) dan PL/pgSQL Stored Procedure untuk logika transaksi atomik.
* **In-Memory Cache**: **Redis 7** dengan driver `ioredis`.
* **Containerization**: **Docker** & **Docker Compose**.
* **Frontend**: Next.js 14+ App Router (TypeScript / React).

---

## 2. Directory Structure & Modular Isolation

Setiap fitur baru harus diletakkan dalam folder modulnya masing-masing di bawah `backend/src/modules/`:

```text
src/modules/<feature_name>/
├── <feature_name>.controller.js  # Layer penanganan request/response HTTP & status code
├── <feature_name>.service.js     # Layer logika bisnis, transaksi DB, & interaksi Redis
└── <feature_name>.routes.js      # Definisi endpoint Express & penempelan middleware
```

### Modular Rules
1. **Controller Layer**: Hanya bertugas membaca data dari `req` (params, query, body, user), memanggil *Service*, dan mengembalikan respons JSON. **Dilarang keras menaruh logika SQL atau query Redis di Controller.**
2. **Service Layer**: Menampung logika bisnis. Boleh memanggil `config/db.js` atau `config/redis.js`.
3. **Cross-Module Calls**: Jika Modul A membutuhkan fungsi dari Modul B, panggil melalui *Service Class*-nya, bukan langsung ke *Controller* atau meretas rutenya.

---

## 3. High-Concurrency & Anti-Race-Condition Rules

Fitur Flash Sale adalah bagian paling kritis dalam sistem ini. Saat mengedit atau menulis kode di area ini, AI wajib mengikuti aturan berikut:

### 3.1. Zero-Oversell Guarantee
* **Pencegahan Double-Check**: Selalu lakukan pengecekan tingkat 1 di Redis (`flash_sale:stock:{product_id}`) untuk meredam beban sebelum menyentuh PostgreSQL.
* **Row-Level Locking**: Setiap query pengurangan stok di PostgreSQL **wajib** menggunakan klausa `FOR UPDATE` atau dieksekusi di dalam Stored Procedure PL/pgSQL yang memiliki mekanisme transaksi atomik.
* **No Client-Side Calculation**: Dilarang menghitung stok baru di sisi JavaScript (contoh salah: `let newStock = currentStock - 1; UPDATE ... SET stock = newStock`). Pemotongan stok harus dieksekusi langsung secara atomik di database (`UPDATE products SET stock = stock - qty`).

### 3.2. Redis Caching Conventions
* **Key Naming Rules**:
  * Stock Flash Sale: `flash_sale:stock:<product_id>`
  * Session Guest: `guest:cart:<guest_uuid>`
  * Rate Limiter: `ratelimit:<ip_or_user_id>:<endpoint>`
* **Fallback Strategy**: Jika Redis mengalami kegagalan/koneksi terputus (*cache miss* atau error), sistem harus secara anggun (*graceful fallback*) meneruskan pengecekan ke PostgreSQL tanpa membuat aplikasi *crash*.

---

## 4. Code Quality & Security Standards

### 4.1. SQL Security (Prevent SQL Injection)
* ❌ **JANGAN PERNAH** menggabungkan string (*string concatenation* / *template literal*) untuk membuat query SQL!
  ```javascript
  // ❌ SANGAT BERBAHAYA
  db.query(`SELECT * FROM users WHERE email = '${email}'`);
  ```
* ✅ **Wajib** menggunakan *parameterized values*:
  ```javascript
  // ✅ AMAN
  db.query('SELECT * FROM users WHERE email = $1', [email]);
  ```

### 4.2. Standardized API Response Format
Setiap endpoint API wajib mengembalikan format JSON yang konsisten menggunakan struktur berikut:

* **Respon Sukses (`200 OK` / `201 Created`)**:
  ```json
  {
    "success": true,
    "message": "Pesan deskriptif aksi",
    "data": { ... } // Object atau Array
  }
  ```
* **Respon Error (`4xx` / `5xx`)**:
  ```json
  {
    "success": false,
    "message": "Pesan kesalahan yang ramah pengguna",
    "code": "ERROR_CODE_UPPERCASE",
    "errors": [] // Opsional, untuk validasi form
  }
  ```

### 4.3. Asynchronous Error Handling
* Semua *async controller* wajib dibungkus dengan utilitas `asyncWrapper` atau blok `try-catch` yang meneruskan error ke `next(err)` agar ditangani oleh *Global Error Middleware*. Dilarang membiarkan *unhandled promise rejection*.

```javascript
// Example: src/utils/asyncWrapper.js
const asyncWrapper = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

---

## 5. Workflow Protocols for AI Assistants

Saat diminta mengerjakan tugas oleh pengguna, AI Agent harus mengikuti langkah kerja berikut:

1. **Analisis Dampak**: Sebelum menulis kode, periksa apakah perubahan mempengaruhi file `database/init.sql`, `ARCHITECTURE.md`, atau modul lain.
2. **Kelengkapan Kode**: Dilarang memberikan potongan kode yang menggantung (misal: `// ... sisanya sama` atau `// TODONEXT`). Tuliskan kode secara lengkap dan berfungsi penuh.
3. **Pembaruan Schema DB**: Jika menambahkan fitur yang membutuhkan kolom/tabel baru, buatkan script DDL SQL tambahan yang sinkron dengan file `database/init.sql`.
4. **Verifikasi Jalur Error**: Saat membuat fitur baru, selalu pertimbangkan *edge cases* (contoh: stok bernilai 0, JWT kedaluwarsa, `guest_id` tidak valid, koneksi Redis mati).

---

## 6. Testing Standards

### 6.1. Backend Testing (Jest + Supertest)
- **Framework**: Jest dengan Supertest untuk HTTP assertions
- **Location**: `backend/tests/` — satu file per module (`auth.test.js`, `products.test.js`, dll.)
- **Pattern**: Setiap test suite menguji satu module secara independen
- **Setup**: Gunakan `beforeAll` untuk setup database, `afterAll` untuk cleanup
- **Mocking**: Mock Redis calls saat testing Redis-dependent features

### 6.2. Frontend Testing (Jest + MSW)
- **Framework**: Jest dengan ts-jest + babel-jest transform
- **Mocking**: MSW (Mock Service Worker) untuk intercept API calls
- **Setup**: `frontend/__tests__/setupTests.ts` — setup jest-dom + MSW lifecycle
- **Location**: `frontend/__tests__/` — organized by `components/` and `pages/`
- **Pattern**: Render component → assert DOM → verify API calls

### 6.3. Load Testing (autocannon)
- **Tool**: autocannon (npm) untuk HTTP load testing
- **Location**: `backend/tests/load-test.js`
- **Pattern**: Generate JWT tokens → spawn concurrent connections → verify zero-oversell
- **Cleanup**: `backend/tests/cleanup-loadtest.js` untuk restore stock & delete test users

### 6.4. Writing Testable Code
- Controller harus menerima `req`, `res`, `next` — tidak langsung import DB
- Service harus menerima dependencies sebagai parameters (dependency injection)
- Gunakan `asyncWrapper` untuk async handlers
- Format response harus konsisten (`success`, `message`, `data`)

---

## 7. Commit & Pull Request Guidelines

Saat menghasilkan pesan komit atau deskripsi PR, gunakan standar **Conventional Commits**:

* `feat(flashsale)`: Menambahkan logika atau endpoint baru.
* `fix(cart)`: Memperbaiki bug atau race condition.
* `refactor(db)`: Mengoptimalkan query SQL tanpa mengubah fungsionalitas.
* `docs(readme)`: Memperbarui dokumentasi teknis.