# ByteCommerce

Platform e-commerce dengan fitur flash sale berkonkurensi tinggi yang menjamin zero-oversell melalui transaksi atomik di database.

![Node.js](https://img.shields.io/badge/Node.js-20LTS-339933?style=flat&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?style=flat&logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat&logo=next.js)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-29-C21325?style=flat&logo=jest&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat&logo=typescript&logoColor=white)

---

## Fitur Utama

- **Zero-Oversell Flash Sale** — Stok flash sale dijamin tidak pernah minus melalui PostgreSQL row-level locking (`FOR UPDATE`) + Redis pre-check
- **Guest & Registered Cart** — Keranjang belanja untuk pengunjung anonim yang otomatis merge saat login
- **JWT Authentication** — Sesi pengguna via HTTP-only cookies dengan anti-enumeration
- **Admin Dashboard** — Manajemen produk, flash sale warmup, killswitch monitoring
- **Responsive Frontend** — Next.js 14 App Router dengan Tailwind CSS

---

## Tech Stack

| Layer | Teknologi | Peran |
| --- | --- | --- |
| Backend | Express.js (Node.js 20 LTS, CommonJS) | REST API, middleware pipeline |
| Database | PostgreSQL 16 Native + PL/pgSQL | Penyimpanan data, stored procedures transaksi atomik |
| Cache | Redis 7 (ioredis) | Pre-check stok, rate limiting, session store |
| Frontend | Next.js 14 App Router (TypeScript) | SSR/SSG katalog produk, UI flash sale |
| Container | Docker & Docker Compose | Isolasi runtime, multi-container orchestration |
| Testing | Jest + Supertest + MSW | Unit test, integration test, frontend mock |
| Deployment | Vercel (frontend) + Render (backend) | CDN global, managed infrastructure |

---

## Struktur Project

```text
bytecommerce/
├── backend/                  # REST API Express.js
│   ├── src/
│   │   ├── config/           # Konfigurasi koneksi (db.js, redis.js, env.js)
│   │   ├── middlewares/       # Auth, rate limiter, error handler, guest tracker
│   │   ├── modules/          # Domain modules (auth, products, flashsale, cart, orders, admin)
│   │   ├── utils/            # Helpers (asyncWrapper, responseFormatter, CustomError)
│   │   └── app.js            # Express app initialization
│   ├── tests/                # Backend test suite (154 tests, 10 suites)
│   │   ├── auth.test.js
│   │   ├── products.test.js
│   │   ├── cart.test.js
│   │   ├── flashsale.test.js
│   │   ├── orders.test.js
│   │   ├── admin.test.js
│   │   ├── concurrency.test.js
│   │   ├── redis-fallback.test.js
│   │   ├── ratelimiter.test.js
│   │   ├── e2e-flow.test.js
│   │   ├── load-test.js      # autocannon load test (500 concurrent)
│   │   └── cleanup-loadtest.js
│   ├── Dockerfile
│   └── server.js
├── frontend/                 # Next.js 14 App Router
│   ├── app/                  # Pages (routes)
│   ├── components/           # Reusable UI components
│   ├── contexts/             # React Context (AuthContext)
│   ├── lib/                  # API client, utilities
│   ├── __tests__/            # Frontend test suite (65 tests, 16 suites)
│   │   ├── components/       # Component tests (Spinner, Navbar, Footer, etc.)
│   │   ├── pages/            # Page tests (Homepage, Cart, Checkout, etc.)
│   │   ├── mocks/            # MSW handlers for API mocking
│   │   └── setupTests.ts     # Test setup (jest-dom, MSW lifecycle)
│   └── jest.config.js
├── database/
│   ├── init.sql              # Skema tabel, indeks, stored procedures
│   └── seeds.sql             # Data awal (13 produk, admin user)
├── docs/                     # Dokumentasi teknis
├── docker-compose.yml        # Development stack
├── docker-compose.prod.yml   # Production stack
├── .github/workflows/        # CI/CD pipeline
├── ARCHITECTURE.md
├── AGENTS.md
├── TASK.md
└── DEPLOYMENT.md
```

---

## Prerequisites

- Docker Desktop (untuk PostgreSQL & Redis)
- Node.js 20+ (LTS)
- npm

---

## Setup

### 1. Jalankan Infrastruktur

```bash
docker compose up -d
```

File `database/init.sql` dan `database/seeds.sql` otomatis dieksekusi saat pertama kali container PostgreSQL dibuat.

### 2. Backend (Development)

```bash
cd backend
npm install
npm run dev
```

Backend berjalan di `http://localhost:5000`.

### 3. Frontend (Development)

```bash
cd frontend
npm install
npm run dev
```

Frontend berjalan di `http://localhost:3000`.

### 4. Seed Data

13 produk sudah termasuk dalam `database/seeds.sql`. Untuk menambah data, edit file tersebut lalu restart container PostgreSQL.

---

## Kredensial Default

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@bytecommerce.com | Admin@123 |

Password disimpan dalam bentuk hash bcrypt. **Ganti kredensial ini sebelum deployment production.**

---

## Environment Variables

| Variable | Deskripsi | Default |
| --- | --- | --- |
| `PORT` | Port backend API | `5000` |
| `DATABASE_URL` | URL koneksi PostgreSQL | `postgresql://dev_user:dev_password@localhost:5432/bytecommerce_db` |
| `REDIS_URL` | URL koneksi Redis | `redis://localhost:6379` |
| `JWT_SECRET` | Secret key untuk signing JWT | _(wajib diisi)_ |
| `NODE_ENV` | Environment runtime | `development` |

Lihat `.env.example` untuk template lengkap.

---

## Testing

### Backend Tests (154 tests, 10 suites)

```bash
cd backend
npm test                    # Run all tests
npx jest --coverage         # Run with coverage report
```

| Suite | Tests | Deskripsi |
| --- | --- | --- |
| auth.test.js | 17 | Signup, login, logout, session |
| products.test.js | 24 | Catalog CRUD, pagination, filter |
| cart.test.js | 18 | Guest & registered cart, merge |
| flashsale.test.js | 13 | Flash sale checkout, zero-oversell |
| orders.test.js | 14 | Order history, invoice |
| admin.test.js | 4 | Dashboard metrics |
| concurrency.test.js | — | Race condition testing |
| redis-fallback.test.js | 11 | Redis failure graceful fallback |
| ratelimiter.test.js | — | Rate limiting behavior |
| e2e-flow.test.js | — | End-to-end user flow |

### Frontend Tests (65 tests, 16 suites)

```bash
cd frontend
npm test                    # Run all tests
npx jest --coverage         # Run with coverage report
```

| Category | Suites | Tests |
| --- | --- | --- |
| Components | 7 (Spinner, PhantomSkeleton, Footer, Navbar, CountdownTimer, ProductImage, InvoiceCard) | 23 |
| Pages | 9 (Signup, Orders, Admin, Homepage, Cart, ProductDetail, Login, Profile, Checkout) | 42 |

Coverage: 42.2% statements, 35.12% branch, 45.33% lines

### Load Testing

```bash
cd backend
node tests/load-test.js     # Run 500 concurrent checkout load test
node tests/cleanup-loadtest.js  # Cleanup test data after load test
```

**Results (500 concurrent, 30s):**
- Zero oversell: ✅ PASS (500 orders from 500 stock)
- Throughput: ~765 req/s avg
- Latency p99: 1850ms (single PostgreSQL bottleneck — expected at this concurrency)

---

## API Overview

| Base Path | Deskripsi | Auth |
| --- | --- | --- |
| `/api/auth` | Registrasi, login, logout, session | Public/Private |
| `/api/products` | Katalog dan detail produk | Public |
| `/api/cart` | Keranjang belanja | Guest/JWT |
| `/api/flashsale` | Produk flash sale & checkout | JWT |
| `/api/orders` | Riwayat order & invoice | JWT |
| `/api/admin` | Dashboard, CRUD, flash sale control | JWT (Admin) |

Detail endpoint selengkapnya: [API.md](API.md) atau [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Dokumen Terkait

| Dokumen | Deskripsi |
| --- | --- |
| [PRD.md](PRD.md) | Product Requirements Document |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Arsitektur sistem, skema DB, spesifikasi endpoint |
| [DESIGN.md](DESIGN.md) | Pedoman desain UI |
| [AGENTS.md](AGENTS.md) | Standar kode dan panduan kontribusi AI |
| [TASK.md](TASK.md) | Daftar task dan progres project |
| [API.md](API.md) | API endpoint reference lengkap |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Panduan deployment production |

---

## License

MIT
