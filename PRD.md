# Product Requirement Document (PRD) — ByteCommerce

> **Project Name**: ByteCommerce  
> **Version**: 1.0.0 (MVP)  
> **Status**: Approved  
> **Document Owner**: Lead Developer / System Architect  
> **Target Release**: Q3 2026  

---

## 1. Executive Summary & Core Objectives

**ByteCommerce** adalah platform e-commerce modular berarsitektur *multi-container* yang dibangun untuk menangani lonjakan trafik ekstrem (*high-concurrency flash sale*). Proyek ini memprioritaskan **ACID Compliance** dan **Zero-Oversell Guarantee** menggunakan fitur bawaan PostgreSQL murni (*Row-Level Locking* & Stored Procedure) dan Redis 7 sebagai *caching layer*, tanpa ketergantungan pada PaaS/BaaS eksternal.

### Key Success Metrics
* **Zero Oversell**: Stok produk *flash sale* dijamin tidak pernah bernilai di bawah 0.
* **Low Latency Pre-check**: Respons pengecekan kuota di Redis < 10 ms.
* **High-Throughput Checkout**: Sanggup memproses hingga 500 *concurrent requests* per detik di PostgreSQL dengan waktu tanggap < 500 ms.

---

## 2. Target Audience & User Roles

| Role | Identifikasi | Hak Akses & Batasan Utama |
| :--- | :--- | :--- |
| **Guest** | Pengunjung anonim (`guest_id` via UUID Cookie/Local Storage). | • Melihat katalog produk & *countdown* Flash Sale.<br>• Menambah produk reguler ke keranjang belanja.<br>• **Diisolasi**: Wajib Login/SignUp untuk *checkout* produk Flash Sale. |
| **Registered User** | Pengguna terautentikasi (memiliki `user_id` & JWT Token). | • Akses penuh *checkout* produk reguler & Flash Sale.<br>• Penggabungan keranjang (*cart merging*) otomatis saat login.<br>• Akses riwayat transaksi & nota digital. |
| **Admin** | Pengelola sistem & infrastruktur (`role = 'ADMIN'`). | • Akses penuh *Admin Command Center*.<br>• Pengelolaan katalog, alokasi stok, & *cache warming*.<br>• Akses tombol darurat *Emergency Kill-Switch*. |

---

## 3. Detailed Functional Requirements

### 3.1. Guest Management & Authentication System
* **Anonymous Session Tracking**:
  * Pengunjung baru tanpa sesi otomatis mendapatkan `guest_id` berbasis UUID v4.
  * *Guest Cart* disimpan sementara di Local Storage / Redis Hash.
* **Authentication Pipeline**:
  * **Sign Up**: Form registrasi sederhana (Nama, Email, Password). Password di-hash menggunakan `bcrypt` / `argon2`.
  * **Login**: Verifikasi kredensial dan penerbitan **JWT Token** yang disimpan di *HTTP-Only Cookie*.
* **Seamless Cart Merging**:
  * Saat Guest melakukan Login atau Sign Up, barang di dalam *Guest Cart* otomatis dimigrasikan ke `user_id` terkait di database.

### 3.2. Product Discovery & Real-Time Catalog
* **Product Catalog**: Menampilkan produk reguler dan produk Flash Sale dengan badge khusus, harga diskon, dan indikator persentase stok.
* **Real-Time Stock Updates**: Sisa stok produk di-push ke UI antarmuka tanpa *refresh* menggunakan Redis Pub/Sub dan Server-Sent Events (SSE) / WebSocket.

### 3.3. High-Concurrency Flash Sale Engine (Core Feature)
* **Synchronized Countdown**: Timer waktu mundur tersinkronisasi presisi dengan jam server pada kontainer Docker backend.
* **Anti-Double-Submit Guard**: Tombol "Beli Sekarang" otomatis berubah ke status *disabled* dan menampilkan *loading spinner* dalam < 10 ms setelah diklik.
* **Two-Tier Stock Validation**:
  * **Tier 1 (Redis In-Memory)**: Pengecekan pra-transaksi kilat. Jika stok di Redis = 0, *request* langsung ditolak tanpa membebani database.
  * **Tier 2 (PostgreSQL PL/pgSQL)**: Eksekusi pemotongan stok murni menggunakan Stored Procedure `buy_flash_sale_item` dengan *Row-Level Locking* (`FOR UPDATE`).

### 3.4. Order & Invoice Management
* **Instant Transaction Feedback**: Pengguna mendapatkan kepastian transaksi dalam < 1 detik (*SUCCESS* atau *OUT OF STOCK*).
* **Order History**: Menampilkan status pesanan (`PAID`, `FAILED`, `CANCELLED`) beserta detail rincian item.

### 3.5. Admin Command Center
* **Inventory & Catalog CRUD**: Mengelola data master produk, kategori, dan penambahan stok utama (*restock*).
* **Flash Sale Scheduler & Cache Warming**:
  * Menentukan waktu mulai/selesai event dan kuota stok Flash Sale.
  * Pemicu otomatis untuk memasukkan kuota stok ke Redis (*Cache Warming*) sebelum event dimulai.
* **Emergency Kill-Switch**: Tombol satu-klik untuk menghentikan Flash Sale secara serentak (menghapus *key* Redis & membatalkan alokasi stok).
* **Live Monitoring Dashboard**: Grafis pemantauan trafik *order* per detik, jumlah koneksi aktif PostgreSQL, dan penggunaan memori Redis.

---

## 4. System & User Workflows

### 4.1. Guest to Registered User Flow
```text
[Guest Datang] ──► Auto-generate UUID (guest_id) ──► Browsing & Tambah Cart
                                                             │
                                                             ▼
                                               [Klik "Beli" Flash Sale]
                                                             │
                                                             ▼
                                                (Modal Quick Auth Prompt)
                                                             │
                                                             ▼
                                               [Sukses Login / Sign Up]
                                                             │
                                                             ▼
                                                 (Migrasi Guest Cart)
                                                             │
                                                             ▼
                                                   [Lanjut ke Checkout]
```

### 4.2. Critical Flash Sale Execution Flow
```text
[User Klik "Beli Sekarang"]
            │
            ▼
[Frontend]: Disable Button & Submit API Request (JWT Auth)
            │
            ▼
[Express.js]: Validasi Rate Limiter & Sesi JWT
            │
            ▼
[Redis Cache]: Check Key `flash_sale:stock:{product_id}`
            │
            ├─► [Stok = 0] ──► Return Respons "OUT_OF_STOCK" (Sub-10ms)
            │
            └─► [Stok > 0] ──► Eksekusi PL/pgSQL Stored Procedure
                                       │
                                       ▼
                       [PostgreSQL Primary Database]
                       1. SELECT stock FROM products FOR UPDATE;
                       2. IF stock >= qty THEN
                             UPDATE products SET stock = stock - qty;
                             INSERT INTO orders (status = 'PAID');
                             RETURN order_id;
                          ELSE
                             RAISE EXCEPTION 'OUT_OF_STOCK';
                          END IF;
                                       │
                                       ▼
                       [Return DB Result to Express.js]
                                       │
                                       ▼
                       [Redirect User to Invoice Page]
```

### 4.3. Admin Kill-Switch Workflow
```text
[Admin Klik "Emergency Kill-Switch"]
                 │
                 ▼
[Express.js API]: Hapus / Set `flash_sale:stock:{product_id}` = 0 di Redis
                 │
                 ▼
[PostgreSQL]: Commit Transaction Rollback sisa kuota ke stok reguler
                 │
                 ▼
[Redis Pub/Sub]: Broadcast event "EVENT_CANCELLED" ke semua Client
```

---

## 5. Non-Functional Requirements (NFR)

### 5.1. Performance & Throughput
* Latency pra-pengecekan Redis < 10 ms.
* Latency transaksi PostgreSQL < 500 ms pada pengujian beban 500 *concurrent requests*.
* Ukuran citra Docker menggunakan varian *Alpine Linux* untuk efisiensi memori dan waktu *booting*.

### 5.2. Security & Isolation
* **Docker Network Isolation**: Database PostgreSQL (port `5432`) dan Redis (port `6379`) diisolasi total dalam *Docker Internal Bridge Network* dan tidak membuka port ke internet pada lingkungan produksi.
* **Rate Limiting**: Maksimal 5 kali percobaan *checkout* per *user* dalam kurun waktu 10 detik via Redis Rate Limiter.
* **SQL Injection Protection**: Penggunaan *Parameterized Queries* murni dan Stored Procedure pada prapemrosesan SQL.

### 5.3. Scalability & Architecture Style
* **Stateless Express API**: Instance backend Express.js dibuat *stateless* sehingga dapat di-*scale horizontally* via Docker Compose (`docker compose up --scale backend_api=N`).
* **Hybrid Deployment**:
  * **Frontend (Next.js)**: Di-host di **Vercel** untuk distribusi CDN global.
  * **Backend Stack (Docker)**: Di-host di **Render** (Express.js API, PostgreSQL Native, dan Redis Container).

---

## 6. MVP Scope Boundaries

### In-Scope (Wajib Ada pada v1.0)
- [x] Sistem Sesi Guest (UUID) dan Autentikasi User (JWT + Password Hashing).
- [x] Auto-Migrasi Cart dari Guest ke Registered User.
- [x] Katalog Produk Reguler & Flash Sale Engine.
- [x] Stored Procedure PL/pgSQL dengan *Row-Level Locking* (`FOR UPDATE`).
- [x] Redis Stock Cache & Pre-checking System.
- [x] Admin Panel (CRUD, Cache Warming, Emergency Kill-Switch).
- [x] Docker Compose multi-container setup & Deployment Hybrid (Vercel + Render).

### Out-of-Scope (Ditunda ke v2.0)
- Payment Gateway Pihak Ketiga (Midtrans/Stripe) — *Menggunakan simulasi pembayaran otomatis langsung PAID*.
- Integrasi API Ekspedisi / Pengiriman Logistik.
- Fitur Ulasan (*Review*) dan Rating Produk.