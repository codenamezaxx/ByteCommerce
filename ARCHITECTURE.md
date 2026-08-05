# System Architecture Document — ByteCommerce

> **Project Name**: ByteCommerce  
> **Backend Engine**: Express.js (Node.js 20 LTS)  
> **Database Engine**: PostgreSQL 16 Native (PL/pgSQL Stored Procedures)  
> **Cache & Session**: Redis 7 (Alpine Container)  
> **Deployment Target**: Vercel (Frontend) + Render / VPS (Backend Stack)  

---

## 1. System Overview & Tech Stack

ByteCommerce mengadopsi arsitektur *Monolith-Modular* pada backend Express.js. Struktur ini memisahkan setiap domain bisnis ke dalam modul independen untuk memudahkan kolaborasi AI Agent (OpenCode, Kiro) tanpa menyebabkan konflik pada berkas utama.

| Layer | Teknologi | Peran & Alasan Pemilihan |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14+ (App Router) | SSR/SSG untuk katalog produk, di-host di Vercel CDN. |
| **Backend API** | Express.js (Node.js 20) | Ringan, *event-driven*, dan memiliki *middleware pipeline* yang sangat fleksibel. |
| **Primary Database** | PostgreSQL 16 Native | Penyimpan data utama. Memanfaatkan *Row-Level Locking* (`FOR UPDATE`) & PL/pgSQL Stored Procedure untuk transaksi *atomic*. |
| **In-Memory Cache** | Redis 7 Alpine | *Pre-checking* kuota stok Flash Sale, Rate Limiting, dan *Guest Session Store*. |
| **Containerization** | Docker & Docker Compose | Mengisolasi runtime Express, Postgres, dan Redis dalam *bridge network* lokal/produksi. |

---

## 2. Directory Structure

```text
bytecommerce/
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD Pipeline (lint, test, build, deploy)
├── database/
│   ├── init.sql                    # Skema tabel, indeks, & Stored Procedures
│   └── seeds.sql                   # Data dummy produk & admin
├── backend/
│   ├── src/
│   │   ├── config/                 # Konfigurasi Koneksi & Environment
│   │   │   ├── db.js               # PostgreSQL Pool (pg)
│   │   │   ├── redis.js            # Redis Client (ioredis)
│   │   │   └── env.js              # Validasi variabel lingkungan
│   │   ├── middlewares/            # Middleware Pipeline Express
│   │   │   ├── auth.js             # Verifikasi Token JWT
│   │   │   ├── guestTracker.js     # Validasi / Inject Guest UUID
│   │   │   ├── rateLimiter.js      # Redis-based Rate Limiter
│   │   │   └── errorHandler.js     # Global Error Handling
│   │   ├── modules/                # Domain-Driven Feature Modules
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.js
│   │   │   │   ├── auth.service.js
│   │   │   │   └── auth.routes.js
│   │   │   ├── products/
│   │   │   │   ├── products.controller.js
│   │   │   │   ├── products.service.js
│   │   │   │   └── products.routes.js
│   │   │   ├── flashsale/
│   │   │   │   ├── flashsale.controller.js
│   │   │   │   ├── flashsale.service.js
│   │   │   │   └── flashsale.routes.js
│   │   │   ├── cart/
│   │   │   │   ├── cart.controller.js
│   │   │   │   ├── cart.service.js
│   │   │   │   └── cart.routes.js
│   │   │   ├── orders/
│   │   │   │   ├── orders.controller.js
│   │   │   │   ├── orders.service.js
│   │   │   │   └── orders.routes.js
│   │   │   └── admin/
│   │   │       ├── admin.controller.js
│   │   │       ├── admin.service.js
│   │   │       └── admin.routes.js
│   │   ├── utils/                  # Helper Utilities
│   │   │   ├── asyncWrapper.js     # Handling Promise Rejections
│   │   │   └── responseFormatter.js# Standard JSON Response Format
│   │   └── app.js                  # Express App Initialization & Routes Entry
│   ├── tests/                      # Backend Test Suite (154 tests, 10 suites)
│   │   ├── auth.test.js            # Auth module tests
│   │   ├── products.test.js        # Products module tests
│   │   ├── cart.test.js            # Cart module tests
│   │   ├── flashsale.test.js       # Flash sale tests
│   │   ├── orders.test.js          # Orders module tests
│   │   ├── admin.test.js           # Admin module tests
│   │   ├── concurrency.test.js     # Race condition tests
│   │   ├── redis-fallback.test.js  # Redis failure fallback tests
│   │   ├── ratelimiter.test.js     # Rate limiter tests
│   │   ├── e2e-flow.test.js        # End-to-end user flow tests
│   │   ├── load-test.js            # autocannon load test (500 concurrent)
│   │   └── cleanup-loadtest.js     # Post-load-test cleanup script
│   ├── Dockerfile
│   ├── package.json
│   └── server.js                   # HTTP Server Entry Point (listen port)
├── frontend/                       # Next.js 14 Application
│   ├── app/                        # Pages (App Router)
│   ├── components/                 # Reusable UI components
│   ├── contexts/                   # React Context (AuthContext)
│   ├── lib/                        # API client, utilities
│   ├── __tests__/                  # Frontend Test Suite (65 tests, 16 suites)
│   │   ├── components/             # Component tests
│   │   ├── pages/                  # Page tests
│   │   ├── mocks/                  # MSW handlers for API mocking
│   │   └── setupTests.ts           # Test setup (jest-dom, MSW lifecycle)
│   ├── jest.config.js              # Jest configuration
│   └── package.json
├── docker-compose.yml              # Development stack
├── docker-compose.prod.yml         # Production stack
├── PRD.md                          # Product Requirement Document
├── ARCHITECTURE.md                 # System Architecture (Dokumen Ini)
├── AGENTS.md                       # Coding Standard untuk AI
├── TASK.md                         # Master task list
├── API.md                          # API endpoint reference
└── DEPLOYMENT.md                   # Deployment guide
```

---

## 3. Database Schema & Stored Procedure (`database/init.sql`)

```sql
-- Clean up existing tables
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS carts CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Table: Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table: Products
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    stock INT NOT NULL CHECK (stock >= 0),
    is_flash_sale BOOLEAN DEFAULT FALSE,
    flash_sale_price DECIMAL(12, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table: Carts & Cart Items (Guest & Registered User)
CREATE TABLE carts (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    guest_id VARCHAR(64) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_cart_owner CHECK (
        (user_id IS NOT NULL AND guest_id IS NULL) OR
        (user_id IS NULL AND guest_id IS NOT NULL)
    )
);

CREATE TABLE cart_items (
    id SERIAL PRIMARY KEY,
    cart_id INT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    UNIQUE(cart_id, product_id)
);

-- 4. Table: Orders & Order Items
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(30) DEFAULT 'PAID' CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    price_at_purchase DECIMAL(12, 2) NOT NULL
);

-- OPTIMIZATION INDEXES
CREATE INDEX idx_products_flash_sale ON products(is_flash_sale) WHERE is_flash_sale = TRUE;
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_carts_guest ON carts(guest_id);
CREATE INDEX idx_carts_user ON carts(user_id);

-- 5. ATOMIC STORED PROCEDURE: Flash Sale Buy Engine
CREATE OR REPLACE FUNCTION buy_flash_sale_item(
    p_user_id INT,
    p_product_id INT,
    p_quantity INT
) RETURNS INT AS $$
DECLARE
    v_stock INT;
    v_price DECIMAL(12, 2);
    v_is_flash BOOLEAN;
    v_order_id INT;
BEGIN
    -- 1. Lock spesifik baris produk (FOR UPDATE) untuk cegah Race Condition
    SELECT stock, price, flash_sale_price, is_flash_sale 
    INTO v_stock, v_price, v_price, v_is_flash
    FROM products
    WHERE id = p_product_id
    FOR UPDATE;

    -- 2. Validasi Keberadaan dan Kelayakan Produk
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
    END IF;

    -- 3. Cek Kecukupan Stok
    IF v_stock < p_quantity THEN
        RAISE EXCEPTION 'OUT_OF_STOCK';
    END IF;

    -- 4. Potong Stok
    UPDATE products 
    SET stock = stock - p_quantity 
    WHERE id = p_product_id;

    -- 5. Buat Header Order
    INSERT INTO orders (user_id, total_amount, status)
    VALUES (p_user_id, v_price * p_quantity, 'PAID')
    RETURNING id INTO v_order_id;

    -- 6. Buat Detail Order Item
    INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
    VALUES (v_order_id, p_product_id, p_quantity, v_price);

    -- 7. Kembalikan ID Order Baru
    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Backend Express Setup Configuration

### 4.1. PostgreSQL Connection Pool (`backend/src/config/db.js`)
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maksimal koneksi simultan per worker Express
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('CRITICAL: Unexpected error on idle PostgreSQL client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
};
```

### 4.2. Redis Client Configuration (`backend/src/config/redis.js`)
```javascript
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

module.exports = redis;
```

### 4.3. High-Concurrency Flash Sale Service (`backend/src/modules/flashsale/flashsale.service.js`)
```javascript
const db = require('../../config/db');
const redis = require('../../config/redis');

class FlashSaleService {
  static async processCheckout(userId, productId, quantity = 1) {
    const stockKey = `flash_sale:stock:${productId}`;

    // TIER 1: Pre-check cepat di Redis Cache (< 10ms)
    const cachedStock = await redis.get(stockKey);
    
    if (cachedStock !== null && parseInt(cachedStock, 10) <= 0) {
      const error = new Error('Stok habis');
      error.statusCode = 400;
      error.code = 'OUT_OF_STOCK_REDIS';
      throw error;
    }

    // TIER 2: Transactional Execution di PostgreSQL Native Stored Procedure
    try {
      const result = await db.query(
        'SELECT buy_flash_sale_item($1, $2, $3) AS order_id',
        [userId, productId, quantity]
      );

      const orderId = result.rows[0].order_id;

      // Sinkronisasi pemotongan kuota stok Redis
      await redis.decrby(stockKey, quantity);

      return { orderId, status: 'PAID' };
    } catch (err) {
      if (err.message === 'OUT_OF_STOCK') {
        // Update Redis cache jika database menyatakan stok sudah 0
        await redis.set(stockKey, 0);
        const error = new Error('Stok habis (DB Sync)');
        error.statusCode = 400;
        error.code = 'OUT_OF_STOCK_DB';
        throw error;
      }
      throw err;
    }
  }
}

module.exports = FlashSaleService;
```

---

## 5. Docker Infrastructure Configuration (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  # Database PostgreSQL Native
  postgres_db:
    image: postgres:16-alpine
    container_name: bytecommerce_postgres
    restart: always
    environment:
      POSTGRES_USER: dev_user
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: bytecommerce_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev_user -d bytecommerce_db"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - bytecommerce_net

  # Cache & Rate Limiter Redis
  redis_cache:
    image: redis:7-alpine
    container_name: bytecommerce_redis
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - bytecommerce_net

  # Express.js REST API
  backend_api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: bytecommerce_backend
    restart: always
    ports:
      - "5000:5000"
    environment:
      PORT: 5000
      DATABASE_URL: "postgresql://dev_user:dev_password@postgres_db:5432/bytecommerce_db"
      REDIS_URL: "redis://redis_cache:6379"
      JWT_SECRET: "bytecommerce_jwt_super_secret_key_2026"
    depends_on:
      postgres_db:
        condition: service_healthy
    networks:
      - bytecommerce_net

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  bytecommerce_net:
    driver: bridge
```

---

## 6. API Endpoint Specifications

### Auth & Session (`/api/auth`)
* `POST /api/auth/signup` — Registrasi pengguna baru.
* `POST /api/auth/login` — Verifikasi kredensial & terbitkan JWT HTTP-Only Cookie.
* `POST /api/auth/logout` — Hapus cookie token.
* `GET  /api/auth/me` — Ambil data profile user aktif.

### Cart Management (`/api/cart`)
* `GET  /api/cart` — Ambil rincian keranjang (mendukung Header `X-Guest-ID` atau JWT).
* `POST /api/cart/items` — Tambah produk ke keranjang.
* `POST /api/cart/merge` — Pemicu migrasi keranjang Guest ke User ID saat login.

### Flash Sale Engine (`/api/flashsale`)
* `GET  /api/flashsale/active` — Ambil daftar produk flash sale aktif.
* `POST /api/flashsale/checkout` — Eksekusi pembelian barang flash sale (Wajib JWT Auth).

### Admin Control (`/api/admin`)
* `POST /api/admin/flashsale/warmup` — Memuat stok dari PostgreSQL ke Redis Cache.
* `POST /api/admin/flashsale/killswitch` — Mematikan event flash sale secara mendadak.

---

## 7. Testing Infrastructure

### 7.1. Backend Tests (Jest + Supertest)

```text
backend/tests/
├── auth.test.js            # 17 tests — signup, login, logout, session
├── products.test.js        # 24 tests — catalog CRUD, pagination, filter
├── cart.test.js            # 18 tests — guest & registered cart, merge
├── flashsale.test.js       # 13 tests — flash sale checkout, zero-oversell
├── orders.test.js          # 14 tests — order history, invoice
├── admin.test.js           # 4 tests — dashboard metrics
├── concurrency.test.js     # Race condition testing
├── redis-fallback.test.js  # 11 tests — Redis failure graceful fallback
├── ratelimiter.test.js     # Rate limiting behavior
├── e2e-flow.test.js        # End-to-end user flow
├── load-test.js            # autocannon load test (500 concurrent)
└── cleanup-loadtest.js     # Post-load-test cleanup
```

**Total**: 154 tests, 10 suites

### 7.2. Frontend Tests (Jest + MSW)

```text
frontend/__tests__/
├── components/             # Component tests
│   ├── Spinner.test.tsx
│   ├── PhantomSkeleton.test.tsx
│   ├── Footer.test.tsx
│   ├── Navbar.test.tsx
│   ├── CountdownTimer.test.tsx
│   ├── ProductImage.test.tsx
│   └── InvoiceCard.test.tsx
├── pages/                  # Page tests
│   ├── Homepage.test.tsx
│   ├── Login.test.tsx
│   ├── Signup.test.tsx
│   ├── Cart.test.tsx
│   ├── Checkout.test.tsx
│   ├── ProductDetail.test.tsx
│   ├── Orders.test.tsx
│   ├── Profile.test.tsx
│   └── Admin.test.tsx
├── mocks/                  # MSW handlers
│   ├── handlers.ts
│   ├── server.ts
│   └── phantom-ui.ts
└── setupTests.ts           # jest-dom + MSW lifecycle
```

**Total**: 65 tests, 16 suites | Coverage: 42.2% stmts, 35.12% branch, 45.33% lines

### 7.3. Load Testing (autocannon)

Load test menggunakan `autocannon` untuk menguji zero-oversell guarantee di bawah tekanan tinggi.

**Setup**:
1. Buat 500 test users langsung di database
2. Generate JWT tokens untuk setiap user
3. Jalankan `node tests/load-test.js` (500 connections × 30s)

**Hasil**:
- Zero oversell: ✅ PASS (500 orders dari 500 stock, row-level locking PostgreSQL)
- Throughput: ~765 req/s avg
- Latency p99: 1850ms (single PostgreSQL bottleneck — expected)

---

## 8. Migration & Cart Merging Strategy

1. **Pengunjung Anonim (Guest)**: Frontend menyimpan `guest_id` di Local Storage / Cookie. Setiap pemanggilan API keranjang menyertakan header `X-Guest-ID: <UUID>`.
2. **Saat Guest Login/Sign Up**:
   - Frontend mengirimkan *payload* berisi `guest_id` ke endpoint `/api/auth/login`.
   - Service melakukan query SQL untuk memindahkan seluruh baris `cart_items` dari `guest_id` ke `user_id`.
   - Record keranjang lama bertanda `guest_id` dihilangkan.