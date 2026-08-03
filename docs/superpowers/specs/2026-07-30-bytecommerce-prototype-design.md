# ByteCommerce — UI Prototype Design Spec

> **Project**: ByteCommerce — E-commerce Flash Sale Platform
> **Version**: v1.0 (Prototype Phase)
> **Date**: 2026-07-30
> **Status**: Approved by user

---

## 1. Design Direction

**Professional Minimal** — clean, structured, whitespace-driven. Vibe antara Linear dan Shopify: percaya diri lewat hierarki tipografi dan tata letak, bukan dekorasi. Aksen warna muncul hanya di momen kritis (CTA, flash sale urgency, status transaksi).

## 2. Design System

### 2.1. Color Tokens

```css
:root {
  --bg:       #FAFBFC;   /* Latar halaman */
  --surface:  #FFFFFF;   /* Kartu, sidebar, modal */
  --fg:       #0F172A;   /* Teks utama */
  --muted:    #64748B;   /* Label, keterangan */
  --border:   #E2E8F0;   /* Garis pemisah */
  --accent:   #2563EB;   /* Tombol utama, link aktif */
  --accent-hover: #1D4ED8;
  --danger:   #DC2626;   /* Flash sale badge, error */
  --danger-hover: #B91C1C;
  --success:  #059669;   /* Status PAID, sukses */
  --warning:  #D97706;   /* Peringatan */
}
```

### 2.2. Typography

| Role | Stack |
|---|---|
| Display/Heading | `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` |
| Body | `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif` |
| Mono (harga, stok, countdown) | `ui-monospace, 'SF Mono', 'Cascadia Code', 'Fira Code', monospace` |

**Catatan**: Heading menggunakan system-ui stack (sans-serif) dengan weight 700 untuk kesan modern & profesional. Body menggunakan stack yang sama namun weight 400/500.

### 2.3. Spacing & Layout

- Max-width konten: `1120px`
- Grid konsisten: padding `16px–32px` responsif
- Card border-radius: `12px`
- Tombol border-radius: `8px`
- Mobile breakpoint: `768px`

### 2.4. Component Patterns

- **Navbar**: Sticky top, logo kiri, menu kanan + auth state toggle
- **Cards**: White surface, subtle border, rounded, hover shadow
- **Buttons**: Solid accent untuk CTA, outline/ghost untuk sekunder
- **Badges**: Flash sale = red capsule, stok indicator = progress bar
- **Countdown**: Mono font, colon-separated, blink on last 10s

## 3. Page Inventory & Flows

### 3.1. Public Flow (6 halaman)

| # | Halaman | File | Konten |
|---|---|---|---|
| 1 | **Home** | `home.html` | Navbar, hero flash sale banner, grid produk (reguler + flash sale badge), footer |
| 2 | **Detail Produk** | `product-detail.html` | Gambar produk, info, harga diskon, countdown, progress bar stok, tombol "Beli Sekarang", breadcrumb |
| 3 | **Cart** | `cart.html` | Daftar item, quantity control, subtotal, tombol checkout, guest → login prompt |
| 4 | **Auth** | `auth.html` | Tab Login / Sign Up, form input, tombol submit, link lupa password |
| 5 | **Checkout Flash Sale** | `checkout.html` | Ringkasan pesanan, alamat (static), tombol konfirmasi + loading state, result SUCCESS/OUT_OF_STOCK |
| 6 | **Invoice** | `invoice.html` | Status badge, order ID, detail item, total, tombol kembali belanja |

### 3.2. Admin Flow (1 halaman)

| # | Halaman | File | Konten |
|---|---|---|---|
| 7 | **Admin Dashboard** | `admin.html` | Sidebar nav, stat cards (orders/s, active users), tabel produk + CRUD modal, flash sale scheduler + cache warming, kill-switch button, logs |

### 3.3. State Coverage per Halaman

Setiap halaman mencakup state berikut:
- **Default** — data tersedia, tampilan normal
- **Empty** — belum ada data (cart kosong, belum ada pesanan)
- **Error** — form validation, stok habis, gagal login
- **Loading** — button loading spinner saat checkout
- **Flash sale active** — countdown aktif, progress bar stok

## 4. Critical Interaction Details

### 4.1. Flash Sale Checkout Flow
1. User lihat produk flash sale → badge merah + countdown
2. Klik "Beli Sekarang" → button disabled + spinner
3. Animasi loading → 2 detik (simulasi)
4. Hasil: SUCCESS → redirect invoice ATAU OUT_OF_STOCK → alert

### 4.2. Guest → Auth Flow
1. Guest tambah item ke cart (via UUID di localStorage)
2. Klik checkout → modal "Login untuk melanjutkan"
3. Login/Sign Up → cart merging
4. Lanjut checkout

### 4.3. Admin Kill-Switch
1. Tombol merah "Emergency Stop" di sidebar
2. Konfirmasi modal "Yakin ingin menghentikan Flash Sale?"
3. Konfirmasi → animasi "Kill-Switch Activated"
4. Status semua flash sale berubah jadi CANCELLED

## 5. File Structure

```
bytecommerce/
├── docs/superpowers/specs/2026-07-30-bytecommerce-prototype-design.md  ← ini
├── public/                    ← folder prototype
│   ├── home.html
│   ├── product-detail.html
│   ├── cart.html
│   ├── auth.html
│   ├── checkout.html
│   ├── invoice.html
│   └── admin.html
```

## 6. Technical Constraints (Prototype Phase Only)

- **Pure HTML + CSS** — zero JavaScript frameworks, zero dependencies
- **No backend** — semua data hardcoded sebagai simulasi
- **CSS murni** — tidak ada preprocessor (SCSS/Less)
- **Responsive** — mobile-first via media query `768px`
- **Semua file self-contained** — tidak ada external CSS/JS (kecuali Google Fonts jika diperlukan)
