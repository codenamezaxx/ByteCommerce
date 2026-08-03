# ByteCommerce — Master Task List

> **Project**: ByteCommerce — E-Commerce Platform (High-Concurrency Flash Sale)
> **Tech Stack**: Express.js + PostgreSQL 16 Native + Redis 7 + Next.js 14 + Docker
> **Target**: Q3 2026 | **Status**: 🟢 Planning

---

## 📋 Task Structure

Setiap task menggunakan format:

```
[PHASE-X] [TASK-ID] Deskripsi Tugas
☐ Subtask checklist (bisa dicentang saat progress)
```

**Legend Status**:
- 🟢 `Done` — Selesai
- 🟡 `In Progress` — Sedang dikerjakan
- 🔴 `Not Started` — Belum dimulai
- ⚪ `Blocked` — Terhambat task lain

---

## ═══════════════════════════════════════════
## PHASE 0: Project Initialization & Scaffolding
## ═══════════════════════════════════════════

### [P0.1] Inisialisasi Repository & Struktur Folder
- [x] Buat folder `bytecommerce/` sebagai root project
- [x] Inisialisasi Git: `git init`
- [x] Buat file `.gitignore` (node_modules, .env, *.log, docker volumes)
- [x] Buat file `.env.example` (template environment variables)
- [x] Buat file `README.md` dengan deskripsi project & setup guide
- [x] Buat struktur direktori sesuai ARCHITECTURE.md:

```
bytecommerce/
├── .github/workflows/
├── database/
│   ├── init.sql
│   └── seeds.sql
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── middlewares/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── products/
│   │   │   ├── flashsale/
│   │   │   ├── cart/
│   │   │   └── orders/
│   │   └── utils/
│   ├── Dockerfile
│   └── package.json
├── frontend/
├── docker-compose.yml
├── PRD.md
├── ARCHITECTURE.md
├── AGENTS.md
└── TASK.md
```

### [P0.2] Backend — package.json & Dependencies
- [x] Inisialisasi `npm init` di `backend/`
- [x] Install dependencies produksi:
  - `express` — framework HTTP
  - `pg` — driver PostgreSQL (NO ORM)
  - `ioredis` — client Redis
  - `bcrypt` atau `argon2` — hashing password
  - `jsonwebtoken` — JWT signing/verification
  - `cookie-parser` — parsing HTTP-only cookie
  - `cors` — CORS policy
  - `dotenv` — environment variables
  - `uuid` — generate UUID v4 untuk guest_id
- [x] Install devDependencies:
  - `nodemon` — hot-reload development
  - `jest` + `supertest` — unit & integration testing
- [x] Tambahkan script `"start"`, `"dev"`, `"test"` di package.json

### [P0.3] Frontend — Next.js Initialization
- [x] Bootstrap Next.js 14+ dengan App Router di `frontend/` (Next.js 14.2.35)
- [x] Setup TypeScript
- [x] Install Tailwind CSS untuk styling
- [x] Konfigurasi `next.config.mjs` untuk proxy API ke backend
- [ ] Setup struktur folder pages: *(dikerjakan bersama Phase 9)*
  - `app/page.tsx` — Landing / catalog
  - `app/auth/login/page.tsx`
  - `app/auth/signup/page.tsx`
  - `app/products/[id]/page.tsx`
  - `app/cart/page.tsx`
  - `app/orders/page.tsx`
  - `app/admin/page.tsx`

### [P0.4] Environment & Docker Compose Skeleton
- [x] Buat file `backend/.env` untuk development:

```
PORT=5000
DATABASE_URL=postgresql://dev_user:dev_password@localhost:5432/bytecommerce_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=bytecommerce_jwt_dev_secret_2026
NODE_ENV=development
```

- [x] Buat `docker-compose.yml` dengan 3 service:
  - `postgres_db` — PostgreSQL 16 Alpine
  - `redis_cache` — Redis 7 Alpine
  - `backend_api` — Express.js (build dari `backend/Dockerfile`)
- [x] Setup Docker bridge network `bytecommerce_net`
- [x] Setup named volumes untuk PostgreSQL & Redis data persistence
- [x] Konfigurasi healthcheck untuk postgres (`pg_isready`)
- [x] Konfigurasi `depends_on` dengan condition `service_healthy`

---

## ═══════════════════════════════════════════
## PHASE 1: Database Foundation
## ═══════════════════════════════════════════

### [P1.1] Schema Definition — `database/init.sql`
- [x] Buat DDL untuk tabel **users**:
  - `id SERIAL PRIMARY KEY`
  - `name VARCHAR(100) NOT NULL`
  - `email VARCHAR(150) UNIQUE NOT NULL`
  - `password_hash VARCHAR(255) NOT NULL`
  - `role VARCHAR(20) DEFAULT 'USER' CHECK (IN 'USER', 'ADMIN')`
  - `created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`
- [x] Buat DDL untuk tabel **products**:
  - `id SERIAL PRIMARY KEY`
  - `name VARCHAR(255) NOT NULL`
  - `description TEXT`
  - `price DECIMAL(12,2) NOT NULL CHECK (>= 0)`
  - `stock INT NOT NULL CHECK (>= 0)`
  - `is_flash_sale BOOLEAN DEFAULT FALSE`
  - `flash_sale_price DECIMAL(12,2)`
  - `created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`
- [x] Buat DDL untuk tabel **carts**:
  - Dual-owner constraint: XOR `user_id` atau `guest_id`
  - `check_cart_owner` constraint
- [x] Buat DDL untuk tabel **cart_items**:
  - `UNIQUE(cart_id, product_id)` — mencegah duplikat produk di keranjang
- [x] Buat DDL untuk tabel **orders**:
  - Status: `PENDING`, `PAID`, `FAILED`, `CANCELLED`
- [x] Buat DDL untuk tabel **order_items**:
  - `price_at_purchase` — snapshot harga saat transaksi
- [x] Buat optimization indexes:
  - `idx_products_flash_sale` — partial index WHERE `is_flash_sale = TRUE`
  - `idx_orders_user` — pada `orders(user_id)`
  - `idx_carts_guest` — pada `carts(guest_id)`
  - `idx_carts_user` — pada `carts(user_id)`

### [P1.2] Stored Procedure — `buy_flash_sale_item`
- [x] Buat PL/pgSQL function `buy_flash_sale_item(p_user_id, p_product_id, p_quantity)`
- [x] Implementasi **Row-Level Locking**: `SELECT ... FOR UPDATE`
- [x] Validasi: produk harus ada, `is_flash_sale = TRUE`
- [x] Cek stok: `IF v_stock < p_quantity THEN RAISE EXCEPTION 'OUT_OF_STOCK'`
- [x] Potong stok secara atomik: `UPDATE products SET stock = stock - p_quantity`
- [x] Buat order header + order item dalam satu transaksi
- [x] Return `order_id`
- [x] Handle exceptions: `PRODUCT_NOT_FOUND`, `OUT_OF_STOCK` (plus `NOT_FLASH_SALE`, `FLASH_PRICE_NOT_SET`)

### [P1.3] Seed Data — `database/seeds.sql`
- [x] Insert admin user: email `admin@bytecommerce.com`, role `ADMIN`
- [x] Insert 10-15 produk dummy dengan variasi:
  - 5 produk reguler (stock 50-100, harga normal)
  - 5 produk flash sale (stock 10-20, harga diskon 40-60%)
  - 3 produk stok menipis (stock 2-5)
- [x] Insert sample order data untuk testing riwayat transaksi

---

## ═══════════════════════════════════════════
## PHASE 2: Backend Core Infrastructure
## ═══════════════════════════════════════════

### [P2.1] Configuration Layer — `backend/src/config/`

#### `env.js` — Validasi Environment Variables
- [x] Load `.env` via `dotenv`
- [x] Validasi semua required env vars ada (`PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`)
- [x] Throw error jelas jika ada env var yang missing
- [x] Export object dengan semua config yang sudah divalidasi

#### `db.js` — PostgreSQL Connection Pool
- [x] Inisialisasi `pg.Pool` dengan config dari env
- [x] Pool max: 20 connections
- [x] `idleTimeoutMillis`: 30000
- [x] `connectionTimeoutMillis`: 2000
- [x] Event handler `pool.on('error')` — critical error logging
- [x] Export: `{ query, getClient, pool }`

#### `redis.js` — Redis Client
- [x] Inisialisasi `ioredis` dengan URL dari env
- [x] `maxRetriesPerRequest: 3`
- [x] `enableReadyCheck: true`
- [x] Event handler: `redis.on('connect')` — log success
- [x] Event handler: `redis.on('error')` — log error (jangan crash)
- [x] **Graceful fallback**: jika Redis gagal, sistem tetap jalan (query langsung ke PostgreSQL)
- [x] Export redis client instance

### [P2.2] Middleware Pipeline — `backend/src/middlewares/`

#### `errorHandler.js` — Global Error Handler
- [x] Tangkap semua error dari `next(err)`
- [x] Format response sesuai standar: `{ success: false, message, code, errors? }`
- [x] Handle spesifik error types:
  - `ValidationError` → 400
  - `AuthenticationError` → 401
  - `ForbiddenError` → 403
  - `NotFoundError` → 404
  - `ConflictError` → 409
  - `default` → 500 (jangan expose stack trace di production)

#### `auth.js` — JWT Verification
- [x] Baca token dari HTTP-Only Cookie (`req.cookies.token`)
- [x] Fallback: baca dari `Authorization: Bearer <token>` header
- [x] Verifikasi JWT dengan `jwt.verify()`
- [x] Inject `req.user = { id, email, role }` jika valid
- [x] Middleware `authenticate` — wajib login (reject jika invalid/expired)
- [x] Middleware `optionalAuth` — inject user jika ada, lanjutkan jika tidak
- [x] Middleware `requireAdmin` — cek `req.user.role === 'ADMIN'`

#### `guestTracker.js` — Guest Session Handler
- [x] Baca `X-Guest-ID` header dari request
- [x] Jika header ada dan valid UUID → inject `req.guestId`
- [x] Jika tidak ada → generate UUID v4 baru → set response header `X-Guest-ID`
- [x] Simpan guest_id ke cookie response untuk persistensi

#### `rateLimiter.js` — Redis-based Rate Limiter
- [x] Key pattern: `ratelimit:<identifier>:<endpoint>`
- [x] Konfigurasi: max 5 request per 10 detik untuk flash sale checkout
- [x] Jika Redis available → gunakan Redis counter dengan TTL
- [x] Jika Redis down → bypass (allow request) — graceful degradation
- [x] Response 429 jika limit tercapai: `{ success: false, code: 'RATE_LIMITED' }`

### [P2.3] Utilities — `backend/src/utils/`

#### `asyncWrapper.js`
- [x] Higher-order function untuk wrap async route handlers
- [x] Catch Promise rejection → `next(err)`
- [x] Export sebagai reusable utility

#### `responseFormatter.js`
- [x] `success(res, data, message, statusCode=200)` — success response
- [x] `created(res, data, message)` — 201 response
- [x] `error(res, message, code, statusCode=400, errors=[])` — error response
- [x] Standarisasi semua response API

#### `CustomError.js` (optional, recommended)
- [x] Class `AppError` extends `Error` dengan properti: `statusCode`, `code`, `isOperational`
- [x] Subclasses: `AuthenticationError`, `ForbiddenError`, `NotFoundError`, `ValidationError`, `ConflictError`

### [P2.4] Express App — `app.js` & `server.js`

#### `app.js`
- [x] Inisialisasi Express app
- [x] Middleware global: `cors()`, `cookie-parser()`, `express.json()`
- [x] Mount responseFormatter ke `res` (as `res.success()`, `res.error()`)
- [x] Import & mount semua route modules
- [x] Global error handler (paling akhir)
- [x] 404 handler untuk route yang tidak dikenal

#### `server.js`
- [x] Import app dari `app.js`
- [x] Listen di port dari env
- [x] Graceful shutdown handler (SIGTERM/SIGINT):
  - Tutup koneksi PostgreSQL pool
  - Quit Redis client
  - Exit process

---

## ═══════════════════════════════════════════
## PHASE 3: Auth Module
## ═══════════════════════════════════════════

### [P3.1] Auth Routes — `auth.routes.js`
- [x] `POST /api/auth/signup` — public
- [x] `POST /api/auth/login` — public
- [x] `POST /api/auth/logout` — authenticated
- [x] `GET /api/auth/me` — authenticated
- [x] Attach middleware: `guestTracker` (untuk cart merging), `authenticate` (untuk protect route)

### [P3.2] Auth Controller — `auth.controller.js`
- [x] `signup`: validasi body (name, email, password), panggil service, return 201 + data user
- [x] `login`: validasi body (email, password), panggil service, set HTTP-Only Cookie, return 200 + data user
- [x] `logout`: hapus cookie, return 200
- [x] `me`: return `req.user` data dari database

### [P3.3] Auth Service — `auth.service.js`
- [x] `signup(data)`:
  - Cek duplicate email (`SELECT ... FOR UPDATE`)
  - Hash password dengan bcrypt/argon2 (salt rounds: 10-12)
  - INSERT user baru
  - Return user tanpa password_hash
- [x] `login(email, password)`:
  - Query user by email
  - Compare password dengan bcrypt
  - Generate JWT token: payload `{ id, email, role }`, expiresIn: `7d`
  - Set cookie: HTTP-Only, Secure (production), SameSite=Strict, maxAge=7*24*60*60*1000
  - **Cart merging trigger**: panggil CartService.mergeGuestCart(guestId, userId) jika ada guest_id
  - Return user data + token
- [x] `getProfile(userId)`:
  - Query user by ID
  - Return user tanpa password_hash
- [x] Wajib: parameterized queries, NO string concatenation!

---

## ═══════════════════════════════════════════
## PHASE 4: Product Module
## ═══════════════════════════════════════════

### [P4.1] Product Routes — `products.routes.js`
- [x] `GET /api/products` — public, list produk dengan pagination + filter
- [x] `GET /api/products/:id` — public, detail produk
- [x] `POST /api/products` — admin only, create produk
- [x] `PUT /api/products/:id` — admin only, update produk
- [x] `DELETE /api/products/:id` — admin only, delete produk

### [P4.2] Product Controller — `products.controller.js`
- [x] `list`: query params `page`, `limit`, `search`, `flash_sale`, `min_price`, `max_price`
- [x] `detail`: validasi param `id`, return 404 jika not found
- [x] `create`: validasi body, return 201
- [x] `update`: validasi body, return 200
- [x] `remove`: soft delete atau hard delete? (sesuai kebutuhan)

### [P4.3] Product Service — `products.service.js`
- [x] `list(filters)`:
  - Build dynamic WHERE clause dengan parameterized queries
  - Pagination: `LIMIT $x OFFSET $y`
  - Return `{ products, total, page, totalPages }`
- [x] `detail(productId)`: query single product, join dengan... (tidak ada join untuk MVP)
- [x] `create(data)`: INSERT produk baru
- [x] `update(productId, data)`: UPDATE produk, handle jika tidak ditemukan
- [x] `remove(productId)`: DELETE produk

---

## ═══════════════════════════════════════════
## PHASE 5: Cart Module
## ═══════════════════════════════════════════

### [P5.1] Cart Routes — `cart.routes.js`
- [x] `GET /api/cart` — get cart (support X-Guest-ID or JWT)
- [x] `POST /api/cart/items` — add item to cart
- [x] `PATCH /api/cart/items/:itemId` — update quantity
- [x] `DELETE /api/cart/items/:itemId` — remove item
- [x] `POST /api/cart/merge` — trigger cart merging (dipanggil saat login)
- [x] Attach middleware: `guestTracker` + `optionalAuth`

### [P5.2] Cart Controller — `cart.controller.js`
- [x] `getCart`: deteksi apakah user atau guest, panggil service sesuai
- [x] `addItem`: validasi body (productId, quantity), panggil service
- [x] `updateItemQuantity`: validasi
- [x] `removeItem`: validasi
- [x] `mergeCart`: panggil merge service

### [P5.3] Cart Service — `cart.service.js`
- [x] `getOrCreateCart(identifiers)`:
  - Cari cart berdasarkan `user_id` atau `guest_id`
  - Buat cart baru jika belum ada
- [x] `addItem(cartId, productId, quantity)`:
  - Cek apakah produk sudah ada di cart → UPDATE quantity
  - Jika belum → INSERT cart item baru
  - Validasi: produk harus exist, stok > 0
- [x] `getCartItems(cartId)`:
  - JOIN dengan products table untuk dapat nama, harga, gambar
- [x] `mergeGuestCart(guestId, userId)`:
  - Cari cart milik guest
  - Pindahkan semua cart_items ke cart milik user
  - Handle conflict: jika produk sudah ada di cart user, pilih quantity terbesar
  - Hapus/hapus cart guest setelah migrasi
  - **Wajib pakai transaksi SQL** (`BEGIN/COMMIT/ROLLBACK`)

---

## ═══════════════════════════════════════════
## PHASE 6: Flash Sale Engine ⚡ (Core Feature)
## ═══════════════════════════════════════════

### [P6.1] Flash Sale Routes — `flashsale.routes.js`
- [x] `GET /api/flashsale/active` — public, list flash sale aktif
- [x] `POST /api/flashsale/checkout` — authenticated only, eksekusi pembelian

### [P6.2] Flash Sale Controller — `flashsale.controller.js`
- [x] `getActiveFlashSales`: return list produk flash sale dengan stok real-time
- [x] `checkout`: validasi body (productId, quantity), panggil service
  - Wajib user authenticated (bukan guest)
  - Anti-double-submit: disable tombol di frontend, cek di backend

### [P6.3] Flash Sale Service — `flashsale.service.js` ⚠️ **KRITIS**
- [x] `getActiveFlashSales()`:
  - Query: `SELECT * FROM products WHERE is_flash_sale = TRUE`
  - Inject stok real-time dari Redis (jika available)
- [x] `processCheckout(userId, productId, quantity=1)`:
  - **TIER 1 — Redis Pre-check** (<10ms):
    - Key: `flash_sale:stock:{productId}`
    - Jika stok di Redis ≤ 0 → return `OUT_OF_STOCK_REDIS`
    - Jika Redis tidak available → skip ke Tier 2
  - **TIER 2 — PostgreSQL Execution**:
    - Panggil stored procedure: `SELECT buy_flash_sale_item($1, $2, $3)`
    - Stored procedure handle: row-locking, validasi, potong stok, buat order
  - **Post-Execution Sync**:
    - `redis.decrby(stockKey, quantity)` — update Redis cache
    - Handle error: jika PostgreSQL return `OUT_OF_STOCK`, set Redis key ke 0
  - **Error handling**:
    - OUT_OF_STOCK → 400 `OUT_OF_STOCK_DB` + sync Redis ke 0
    - PRODUCT_NOT_FOUND → 404
    - Lainnya → 500

### [P6.4] Admin Flash Sale Controls — `admin` routes (in flashsale module or separate)

#### Routes:
- [x] `POST /api/admin/flashsale/warmup` — admin only
- [x] `POST /api/admin/flashsale/killswitch` — admin only

#### Service:
- [x] `warmupCache()`:
  - Query semua produk flash sale dari PostgreSQL
  - Set Redis keys: `flash_sale:stock:{productId}` = product.stock
  - Set Redis TTL sesuai durasi flash sale event (misal 2 jam)
  - Log: jumlah produk yang di-warmup
- [x] `killSwitch()`:
  - Hapus semua Redis keys dengan pattern `flash_sale:stock:*`
  - Set semua `products.is_flash_sale = FALSE` di PostgreSQL (via parameterized query)
  - Kirim event ke Redis Pub/Sub: channel `flash_sale:events`, message `EVENT_CANCELLED`
  - Log: timestamp kill

---

## ═══════════════════════════════════════════
## PHASE 7: Order Module
## ═══════════════════════════════════════════

### [P7.1] Order Routes — `orders.routes.js`
- [ ] `GET /api/orders` — authenticated, list riwayat order user
- [ ] `GET /api/orders/:id` — authenticated, detail order + items

### [P7.2] Order Controller — `orders.controller.js`
- [ ] `list`: query params `page`, `limit`, `status` (filter)
- [ ] `detail`: validasi param `id`, cek kepemilikan (user hanya bisa lihat order sendiri)

### [P7.3] Order Service — `orders.service.js`
- [ ] `list(userId, filters)`:
  - Query orders by user_id dengan pagination
  - Join order_items untuk total item count
  - Return `{ orders, total, page, totalPages }`
- [ ] `detail(orderId, userId)`:
  - Query order header
  - Query order items (JOIN products untuk nama produk)
  - Validasi: order harus milik user yang login (kecuali admin)

---

## ═══════════════════════════════════════════
## PHASE 8: Admin Module
## ═══════════════════════════════════════════

### [P8.1] Admin Routes — hook ke module yang existing
- [ ] Product CRUD (share dengan Phase 4 routes, tambah middleware `requireAdmin`)
- [ ] Flash Sale warmup & killswitch (Phase 6)
- [ ] `GET /api/admin/dashboard` — admin only, monitoring metrics

### [P8.2] Admin Controller & Service
- [ ] `getDashboardMetrics()`:
  - Total users count
  - Total products count
  - Total orders hari ini
  - Flash sale active count
  - Recent orders (last 10)
- [ ] Bonus: Redis-based live metrics (opsional, bisa ditunda)

---

## ═══════════════════════════════════════════
## PHASE 9: Frontend — Next.js App
## ═══════════════════════════════════════════

### [P9.1] Layout & Common Components
- [ ] Root layout dengan navbar + footer
- [ ] Navbar: logo, search bar, cart icon (dengan badge jumlah item), login/logout button
- [ ] Guest ID management: generate + store di localStorage, kirim via header
- [ ] API client utility (`lib/api.js`):
  - Base URL dari env `NEXT_PUBLIC_API_URL`
  - Interceptor untuk attach Guest-ID header
  - Standard error handling
- [ ] Auth context/provider untuk manage user state

### [P9.2] Auth Pages
- [ ] `/auth/login` — form login (email + password)
  - On success: redirect ke halaman sebelumnya, trigger cart merge
  - Loading state + error handling
- [ ] `/auth/signup` — form registrasi (name + email + password + confirm password)
  - Client-side validation
  - On success: auto-login + redirect

### [P9.3] Product Pages
- [ ] `/` (home) — product catalog grid:
  - Featured flash sale banner/carousel
  - Regular products grid
  - Search bar + filter (by price range, flash sale only)
  - Pagination / infinite scroll
  - Flash sale badge + countdown timer
- [ ] `/products/[id]` — product detail:
  - Image gallery (placeholder untuk MVP)
  - Harga reguler vs flash sale price
  - Stok indikator
  - Add to cart button
  - Jika flash sale: countdown + disable saat stok habis

### [P9.4] Cart Page
- [ ] `/cart` — cart overview:
  - List item dengan quantity controls (+/-)
  - Subtotal per item + total keseluruhan
  - Remove item button
  - Checkout button (untuk flash sale: redirect ke halaman khusus)
  - If guest: prompt untuk login saat checkout flash sale

### [P9.5] Flash Sale Checkout Experience ⚡
- [ ] Anti-double-submit: button disable + loading spinner on click
- [ ] Real-time feedback: Success → redirect ke invoice / Error → tampilkan alert
- [ ] Stock countdown: real-time update via polling atau SSE
- [ ] Jika user guest saat checkout → modal "Login to continue"

### [P9.6] Order Pages
- [ ] `/orders` — riwayat order:
  - List order dengan status badge (PAID, FAILED, CANCELLED)
  - Total amount + date
- [ ] `/orders/[id]` — invoice detail:
  - Order info (ID, date, status)
  - List purchased items
  - Total amount

### [P9.7] Admin Pages
- [ ] `/admin` — dashboard:
  - Stat cards: total users, products, orders today
  - Recent orders table
- [ ] `/admin/products` — product management:
  - Table CRUD dengan modal form
  - Flash sale toggle + price setting
- [ ] `/admin/flashsale` — flash sale management:
  - Warmup cache button (with confirmation)
  - Kill-switch button (RED, with double confirmation)
  - Active flash sale status

---

## ═══════════════════════════════════════════
## PHASE 10: Docker Image & CI/CD
## ═══════════════════════════════════════════

### [P10.1] Backend Dockerfile (`backend/Dockerfile`)
- [ ] Multi-stage build (production):
  - Stage 1: `node:20-alpine` — npm install
  - Stage 2: `node:20-alpine` — copy only production artifacts
- [ ] Production: `NODE_ENV=production`
- [ ] Expose port 5000
- [ ] CMD: `node server.js`

### [P10.2] CI/CD Pipeline (`.github/workflows/deploy.yml`)
- [ ] Trigger: push ke `main` / `develop`
- [ ] Jobs:
  - `test`: run integration tests
  - `build`: build Docker image
  - `deploy`: deploy ke Render/VPS via SSH atau GitHub Actions deployment

### [P10.3] Deployment Configuration
- [ ] Setup Render blueprint / Docker Compose for production
- [ ] Production environment variables (beda dengan dev)
- [ ] Setup PostgreSQL managed or containerized
- [ ] Setup Redis managed or containerized
- [ ] Domain & SSL configuration
- [ ] Frontend: deploy ke Vercel, connect to production API

---

## ═══════════════════════════════════════════
## PHASE 11: Testing & Quality Assurance
## ═══════════════════════════════════════════

### [P11.1] Backend Unit Tests
- [ ] Test Auth Service: signup (success, duplicate email, weak password)
- [ ] Test Auth Service: login (success, wrong password, user not found)
- [ ] Test Product Service: CRUD operations
- [ ] Test Cart Service: add items, merge cart edge cases
- [ ] Test Flash Sale Service: checkout flow, out of stock, product not found
- [ ] Test middleware: auth (valid/invalid token), rate limiter

### [P11.2] Integration Tests
- [ ] Setup test database (PostgreSQL container)
- [ ] Full flow test: signup → login → add to cart → checkout
- [ ] Flash sale concurrency test: 10+ simultaneous checkout requests
- [ ] Cart merge test: guest adds items → login → verify items migrated
- [ ] Rate limiter: exceed limit → verify 429 response
- [ ] Redis failure: kill Redis → verify graceful fallback to PostgreSQL

### [P11.3] Frontend Tests (Optional untuk MVP)
- [ ] Auth pages: form validation, error display
- [ ] Cart: add/remove items, quantity updates
- [ ] Product catalog: pagination, filter, search
- [ ] Flash sale UI: button disable state, countdown timer

### [P11.4] Load Testing
- [ ] Setup k6 atau autocannon untuk load test
- [ ] Scenario: 500 concurrent users checkout flash sale
- [ ] Verify: zero oversell, response time < 500ms
- [ ] Test: Redis cache hit ratio, PostgreSQL connection pool saturation

---

## ═══════════════════════════════════════════
## PHASE 12: Documentation & Finalization
## ═══════════════════════════════════════════

### [P12.1] Technical Documentation
- [ ] Update `README.md` dengan:
  - Deskripsi project & fitur utama
  - Tech stack badges
  - Prerequisites (Docker, Node.js 20)
  - Setup guide: clone → `docker compose up` → seed → run
  - API documentation overview
  - Environment variables reference
- [ ] Update `ARCHITECTURE.md` jika ada perubahan
- [ ] Update `AGENTS.md` jika ada standar baru

### [P12.2] API Documentation
- [ ] Buat API endpoint reference (bisa di README atau file terpisah `API.md`)
- [ ] Dokumentasi tiap endpoint: method, path, headers, body, response, error codes
- [ ] Contoh request/response untuk setiap endpoint

### [P12.3] Post-Launch Checklist
- [ ] Security audit: JWT secret strength, SQL injection, CORS config
- [ ] Performance audit: query performance, N+1 problems
- [ ] Docker image size optimization
- [ ] Error monitoring setup
- [ ] Backup strategy untuk PostgreSQL
- [ ] Rollback plan

---

## 📊 Progress Tracker

| Phase | Tasks | Status |
|-------|-------|--------|
| P0: Project Scaffolding | 4 Task Groups | 🟢 Done |
| P1: Database Foundation | 3 Task Groups | 🟢 Done |
| P2: Backend Core | 4 Task Groups | 🟢 Done |
| P3: Auth Module | 3 Task Groups | 🟢 Done |
| P4: Product Module | 3 Task Groups | 🟢 Done |
| P5: Cart Module | 3 Task Groups | 🟢 Done |
| P6: Flash Sale Engine | 4 Task Groups | 🟢 Done |
| P7: Order Module | 3 Task Groups | 🔴 Not Started |
| P8: Admin Module | 2 Task Groups | 🔴 Not Started |
| P9: Frontend App | 7 Task Groups | 🔴 Not Started |
| P10: Docker & CI/CD | 3 Task Groups | 🔴 Not Started |
| P11: Testing & QA | 4 Task Groups | 🔴 Not Started |
| P12: Documentation | 3 Task Groups | 🔴 Not Started |

---

## 🔗 Quick Reference

| Dokumen | Tujuan |
|---------|--------|
| `PRD.md` | Product requirements & MVP scope |
| `ARCHITECTURE.md` | System architecture, schema, endpoint specs |
| `AGENTS.md` | Coding standards & AI agent guidelines |
| `TASK.md` | **Master task list (dokumen ini)** |

---

*Last Updated: 2026-08-03*
