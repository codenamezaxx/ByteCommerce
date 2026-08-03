# ByteCommerce

Platform e-commerce dengan fitur flash sale berkonkurensi tinggi yang menjamin zero-oversell melalui transaksi atomik di database.

## Tech Stack

| Layer | Teknologi |
| --- | --- |
| Backend | Express.js (Node.js 20 LTS, CommonJS) |
| Database | PostgreSQL 16 native + PL/pgSQL stored procedures |
| Cache | Redis 7 (ioredis) |
| Frontend | Next.js 14 App Router (TypeScript) |
| Container | Docker & Docker Compose |
| Deployment | Vercel (frontend) + Render (backend) |

## Struktur Project

```text
bytecommerce/
├── backend/          # REST API Express.js (modular: auth, products, flashsale, cart, orders)
├── frontend/         # Aplikasi Next.js 14 App Router (TypeScript)
├── database/         # init.sql (skema) dan seeds.sql (data awal)
├── public/           # Prototype HTML statis
├── docs/             # Dokumentasi teknis
├── docker-compose.yml
├── PRD.md
├── ARCHITECTURE.md
├── DESIGN.md
├── AGENTS.md
└── TASK.md
```

## Prerequisites

- Docker Desktop
- Node.js 20+ (LTS)
- npm

## Setup

1. Jalankan infrastruktur (PostgreSQL, Redis, dan backend) dengan Docker Compose:

   ```bash
   docker compose up -d
   ```

   File `database/init.sql` dan `database/seeds.sql` otomatis dieksekusi pada saat pertama kali container PostgreSQL dibuat.

2. Jalankan backend untuk development:

   ```bash
   cd backend
   npm install
   npm run dev
   ```

3. Jalankan frontend untuk development:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Kredensial Default

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@bytecommerce.com | Admin@123 |

Password disimpan dalam bentuk hash bcrypt di `database/seeds.sql`. Ganti kredensial ini sebelum digunakan di production.

## Environment Variables

| Variable | Deskripsi |
| --- | --- |
| `PORT` | Port yang digunakan backend API (default: 5000) |
| `DATABASE_URL` | URL koneksi PostgreSQL, contoh: `postgresql://dev_user:dev_password@localhost:5432/bytecommerce_db` |
| `REDIS_URL` | URL koneksi Redis, contoh: `redis://localhost:6379` |
| `JWT_SECRET` | Secret key untuk signing dan verifikasi JWT |
| `NODE_ENV` | Environment runtime: `development`, `production`, atau `test` |

Lihat file `.env.example` untuk template lengkap.

## API Overview

| Base Path | Deskripsi |
| --- | --- |
| `/api/auth` | Registrasi, login, dan manajemen sesi pengguna |
| `/api/products` | Katalog dan detail produk |
| `/api/cart` | Keranjang belanja (pengguna terautentikasi dan guest) |
| `/api/flashsale` | Produk flash sale dan pemrosesan stok saat checkout |
| `/api/orders` | Order dan invoice pengguna |
| `/api/admin` | Manajemen produk dan flash sale untuk admin |

Detail endpoint selengkapnya tersedia di `ARCHITECTURE.md`.

## Dokumen Terkait

- [PRD.md](PRD.md) - Product Requirements Document
- [ARCHITECTURE.md](ARCHITECTURE.md) - Desain arsitektur dan spesifikasi teknis
- [DESIGN.md](DESIGN.md) - Pedoman desain UI
- [AGENTS.md](AGENTS.md) - Standar kode dan panduan kontribusi
- [TASK.md](TASK.md) - Daftar task dan progres project
