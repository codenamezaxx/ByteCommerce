# ByteCommerce — API Endpoint Reference

Base URL: `http://localhost:5000` (development) atau `https://api.bytecommerce.com` (production)

---

## Authentication

Semua endpoint yang ditandai **🔒 JWT** memerlukan header `Authorization: Bearer <token>` atau cookie `token`. Endpoint **🔒 Admin** memerlukan JWT dengan `role: "ADMIN"`.

---

## Auth & Session

### `POST /api/auth/signup`

Registrasi pengguna baru.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response `201 Created`:**
```json
{
  "success": true,
  "message": "Registrasi berhasil",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "USER"
    }
  }
}
```

**Error:**
- `400` — Missing required fields
- `409` — Email already exists (tidak membedakan antara exist dan tidak untuk anti-enumeration)

---

### `POST /api/auth/login`

Verifikasi kredensial dan terbitkan JWT HTTP-Only Cookie.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123",
  "guest_id": "optional-uuid-for-cart-merge"
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Login berhasil",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "USER"
    }
  }
}
```

**Side Effects:**
- Set cookie `token` (HTTP-only, SameSite=Lax)
- Jika `guest_id` disertakan, merge cart guest → user

**Error:**
- `401` — Invalid credentials

---

### `POST /api/auth/logout`

Hapus cookie token.

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Logout berhasil"
}
```

---

### `GET /api/auth/me` 🔒 JWT

Ambil data profile user aktif.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "USER",
      "created_at": "2026-08-03T10:00:00Z"
    }
  }
}
```

---

## Products

### `GET /api/products`

Ambil daftar produk dengan pagination dan filter.

**Query Parameters:**
| Parameter | Type | Default | Deskripsi |
|-----------|------|---------|-----------|
| `page` | int | 1 | Halaman |
| `limit` | int | 10 | Item per halaman |
| `search` | string | — | Cari berdasarkan nama |
| `category` | string | — | Filter kategori |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 1,
        "name": "Laptop Gaming RGB",
        "description": "Laptop high-end untuk gaming",
        "price": 15000000,
        "stock": 50,
        "is_flash_sale": false,
        "flash_sale_price": null,
        "image_url": "https://example.com/laptop.jpg"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 13,
      "totalPages": 2
    }
  }
}
```

---

### `GET /api/products/:id`

Ambil detail satu produk.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": 1,
      "name": "Laptop Gaming RGB",
      "description": "Laptop high-end untuk gaming",
      "price": 15000000,
      "stock": 50,
      "is_flash_sale": false,
      "flash_sale_price": null,
      "image_url": "https://example.com/laptop.jpg",
      "created_at": "2026-08-03T10:00:00Z"
    }
  }
}
```

**Error:**
- `404` — Product not found

---

## Cart

### `GET /api/cart` 🔒 JWT atau Guest Header

Ambil rincian keranjang. Mendukung header `X-Guest-ID` untuk guest atau JWT untuk registered user.

**Headers (salah satu):**
- `Authorization: Bearer <token>` — untuk registered user
- `X-Guest-ID: <uuid>` — untuk guest

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "cart": {
      "id": 1,
      "items": [
        {
          "id": 1,
          "product_id": 1,
          "name": "Laptop Gaming RGB",
          "price": 15000000,
          "quantity": 2,
          "subtotal": 30000000
        }
      ],
      "total": 30000000,
      "itemCount": 2
    }
  }
}
```

---

### `POST /api/cart/items` 🔒 JWT atau Guest Header

Tambah produk ke keranjang.

**Headers:** `X-Guest-ID` atau JWT (salah satu)

**Request Body:**
```json
{
  "product_id": 1,
  "quantity": 2
}
```

**Response `201 Created`:**
```json
{
  "success": true,
  "message": "Produk ditambahkan ke keranjang",
  "data": {
    "cartItem": {
      "id": 1,
      "product_id": 1,
      "quantity": 2
    }
  }
}
```

**Error:**
- `400` — Invalid quantity atau product not found
- `404` — Cart not found

---

### `POST /api/cart/merge` 🔒 JWT

Pemicu migrasi keranjang Guest ke User ID saat login.

**Request Body:**
```json
{
  "guest_id": "uuid-of-guest"
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Keranjang berhasil digabung"
}
```

---

## Flash Sale

### `GET /api/flashsale/active`

Ambil daftar produk flash sale yang sedang aktif.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 5,
        "name": "Smartphone Flagship",
        "original_price": 12000000,
        "flash_sale_price": 8000000,
        "stock": 100,
        "starts_at": "2026-08-05T10:00:00Z",
        "ends_at": "2026-08-05T18:00:00Z"
      }
    ],
    "count": 3
  }
}
```

---

### `POST /api/flashsale/checkout` 🔒 JWT

Eksekusi pembelian barang flash sale. Menggunakan 2-tier defense: Redis pre-check + PostgreSQL stored procedure.

**Request Body:**
```json
{
  "product_id": 5,
  "quantity": 1
}
```

**Response `201 Created`:**
```json
{
  "success": true,
  "message": "Checkout berhasil",
  "data": {
    "orderId": 123,
    "status": "PAID"
  }
}
```

**Error:**
- `400` — OUT_OF_STOCK (Redis atau DB)
- `404` — Product not found atau bukan flash sale

**Flow:**
1. Redis pre-check (`flash_sale:stock:{product_id}`) — jika ≤ 0, langsung return 400
2. PostgreSQL stored procedure `buy_flash_sale_item()` — row-level locking, atomic transaction
3. Redis sync — decrement stock setelah DB success

---

## Orders

### `GET /api/orders` 🔒 JWT

Ambil riwayat order pengguna.

**Query Parameters:**
| Parameter | Type | Default | Deskripsi |
|-----------|------|---------|-----------|
| `page` | int | 1 | Halaman |
| `limit` | int | 10 | Item per halaman |
| `status` | string | — | Filter status (PENDING, PAID, FAILED, CANCELLED) |

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": 123,
        "total_amount": 8000000,
        "status": "PAID",
        "created_at": "2026-08-05T12:00:00Z",
        "item_count": 1
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

---

### `GET /api/orders/:id` 🔒 JWT

Ambil detail order (termasuk items).

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": 123,
      "total_amount": 8000000,
      "status": "PAID",
      "created_at": "2026-08-05T12:00:00Z",
      "items": [
        {
          "product_name": "Smartphone Flagship",
          "quantity": 1,
          "price_at_purchase": 8000000
        }
      ]
    }
  }
}
```

**Error:**
- `403` — Order bukan milik user ini (ownership check)
- `404` — Order not found

---

## Admin

### `POST /api/admin/flashsale/warmup` 🔒 Admin

Memuat stok produk flash sale dari PostgreSQL ke Redis Cache.

**Request Body:**
```json
{
  "product_ids": [5, 6, 7]
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Flash sale stock warmed up",
  "data": {
    "warmed": 3
  }
}
```

---

### `POST /api/admin/flashsale/killswitch` 🔒 Admin

Mematikan event flash sale secara mendadak.

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Flash sale killed"
}
```

---

### `GET /api/admin/dashboard` 🔒 Admin

Ambil metrik dashboard admin.

**Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "totalUsers": 150,
      "totalProducts": 13,
      "totalOrders": 200,
      "totalRevenue": 150000000,
      "flashSaleOrders": 50
    }
  }
}
```

---

## Standard Response Format

### Success
```json
{
  "success": true,
  "message": "Deskripsi aksi",
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "message": "Pesan error yang ramah pengguna",
  "code": "ERROR_CODE",
  "errors": []
}
```

### Error Codes
| Code | HTTP Status | Deskripsi |
|------|-------------|-----------|
| `OUT_OF_STOCK` | 400 | Stok habis |
| `OUT_OF_STOCK_REDIS` | 400 | Stok habis (detected by Redis) |
| `OUT_OF_STOCK_DB` | 400 | Stok habis (confirmed by DB) |
| `PRODUCT_NOT_FOUND` | 404 | Produk tidak ditemukan |
| `UNAUTHORIZED` | 401 | Tidak terautentikasi |
| `FORBIDDEN` | 403 | Tidak punya akses |
| `RATE_LIMITED` | 429 | Terlalu banyak request |

---

## Rate Limiting

- **Window**: 15 menit
- **Limit**: 100 requests per IP per window
- **Header**: `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Response**: `429 Too Many Requests` jika limit tercapai

---

## Guest Session

Guest menggunakan header `X-Guest-ID` (UUID v4) yang disimpan di localStorage browser. Guest cart otomatis merge ke registered user saat login/signup.

---

*Last Updated: 2026-08-05*
