# ByteCommerce Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 7 pure HTML+CSS prototype pages covering ByteCommerce's full user flow — guest browsing through flash sale checkout to admin dashboard.

**Architecture:** Shared CSS design system (`style.css`) with per-page HTML files under `public/`. Each page is a standalone HTML file referencing the shared CSS. No JavaScript frameworks, no backend — all data hardcoded as simulation.

**Tech Stack:** HTML5, CSS3 (custom properties, grid, flexbox, container queries)

## Global Constraints

- **Pure HTML + CSS** — zero JavaScript frameworks, zero runtime dependencies
- **No backend** — all data hardcoded inline as simulation
- **No CSS preprocessor** — raw CSS only
- **Responsive** — mobile-first, breakpoint at 768px
- **Design tokens** — must use the 10 CSS custom properties defined in the spec (`--bg`, `--surface`, `--fg`, `--muted`, `--border`, `--accent`, `--accent-hover`, `--danger`, `--danger-hover`, `--success`, `--warning`)
- **Typography** — sans-serif heading stack (system-ui), sans body stack, mono for prices/countdowns
- **data-od-id** — every `<section>` needs a `data-od-id="kebab-case-id"` attribute
- **Image placeholders** — use `.ph-img` styled placeholder divs, never link to external stock photos
- **Copy in Indonesian (id)** — all user-visible text in Bahasa Indonesia

---
## File Structure

All prototype files go under `public/`:

```
public/
├── style.css           # Shared design system — tokens, reset, typography, components
├── home.html           # Landing page — catalog + flash sale banner
├── product-detail.html # Detail produk — countdown + stock + CTA
├── cart.html           # Keranjang belanja
├── auth.html           # Login / Sign Up
├── checkout.html       # Checkout flash sale — loading + result states
├── invoice.html        # Sukses transaksi
└── admin.html          # Admin dashboard — CRUD + monitoring + kill-switch
```

---

### Task 1: Shared Design System CSS (`style.css`)

**Files:**
- Create: `public/style.css`

**Consumes:** Design spec color tokens, typography stacks, spacing rules
**Produces:** Complete CSS file with variables, reset, typography, and reusable component classes that all 7 pages import

- [ ] **Step 1: Write `public/style.css`**

Create the shared CSS file containing:

```css
/* ============================================
   ByteCommerce — Design System
   Pure CSS — prototype phase
   ============================================ */

/* ----- Custom Properties ----- */
:root {
  --bg:             #FAFBFC;
  --surface:        #FFFFFF;
  --fg:             #0F172A;
  --muted:          #64748B;
  --border:         #E2E8F0;
  --accent:         #2563EB;
  --accent-hover:   #1D4ED8;
  --danger:         #DC2626;
  --danger-hover:   #B91C1C;
  --success:        #059669;
  --warning:        #D97706;

--font-display:   system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-body:      -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;
  --font-mono:      ui-monospace, 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;

  --max-width:      1120px;
  --radius-sm:      8px;
  --radius-md:      12px;
  --shadow-sm:      0 1px 3px rgba(0,0,0,.06);
  --shadow-md:      0 4px 12px rgba(0,0,0,.08);
  --transition:     200ms ease;
}
```

Then include:

1. **CSS Reset** — minimal box-sizing, margin, body defaults
2. **Typography** — h1-h6 using `--font-display`, body using `--font-body`, `.mono` class, `.eyebrow` class (small uppercase muted label)
3. **Layout** — `.container` (max-width + padding), `.page` (vertical rhythm wrapper)
4. **Navbar** — `.navbar` flex layout, `.navbar-brand`, `.navbar-links`, `.navbar-auth`, responsive collapse
5. **Button system** — `.btn`, `.btn-primary`, `.btn-outline`, `.btn-danger`, `.btn-lg`, `.btn-block`, `.btn:disabled` (loading state with spinner pseudo-element)
6. **Card** — `.card` (white surface, border, radius, padding, shadow on hover)
7. **Badge system** — `.badge`, `.badge-danger` (flash sale), `.badge-success` (PAID), `.badge-warning`
8. **Form elements** — `.form-group`, `.form-label`, `.form-input`, `.form-error`
9. **Grid** — `.product-grid` (auto-fill minmax(280px, 1fr))
10. **Table** — `.table` (clean bordered table for admin)
11. **Modal overlay** — `.modal-overlay`, `.modal-content` (for admin CRUD, confirmation)
12. **Flash sale countdown** — `.countdown` (mono font, colon separators)
13. **Stock bar** — `.stock-bar` (progress bar), `.stock-bar-fill` (colored fill)
14. **Notification/toast** — `.toast`, `.toast-success`, `.toast-error`
15. **Spinner** — `.spinner` (CSS-only spinning ring for button loading state)
16. **Footer** — `.footer` minimal style
17. **Sidebar (admin)** — `.sidebar`, `.sidebar-link`
18. **Stat card (admin)** — `.stat-card`, `.stat-value`, `.stat-label`
19. **Responsive breakpoint at 768px** — stack nav, single column grids, full-width modals

All styles in one file. No external dependencies.

---

### Task 2: Home Page (`home.html`)

**Files:**
- Create: `public/home.html`
- Uses: `public/style.css`

**Consumes:** CSS variables + component classes from Task 1
**Produces:** Landing page with hero banner, flash sale highlight, product grid, footer

- [ ] **Step 1: Create `public/home.html`**

Structure:
```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ByteCommerce — Belanja Cepat, Aman, Terpercaya</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <!-- Navbar -->
  <nav class="navbar">...</nav>

  <main>
    <!-- Hero Banner Flash Sale -->
    <section data-od-id="hero-flashsale" class="hero">
      Flash sale banner with headline, countdown, CTA
    </section>

    <!-- Produk Flash Sale -->
    <section data-od-id="section-flash-products" class="container">
      <h2>Flash Sale</h2>
      <div class="product-grid">
        <!-- 3 flash sale product cards with badge, discount price, stock bar -->
      </div>
    </section>

    <!-- Semua Produk -->
    <section data-od-id="section-all-products" class="container">
      <h2>Produk Lainnya</h2>
      <div class="product-grid">
        <!-- 6 regular product cards -->
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="footer">...</footer>
</body>
</html>
```

Each product card includes: image placeholder, product name, price, badge (if flash sale), stock bar (if flash sale). Navbar shows ByteCommerce logo left, links center, Login/Daftar buttons right.

---

### Task 3: Product Detail Page (`product-detail.html`)

**Files:**
- Create: `public/product-detail.html`
- Uses: `public/style.css`

**Consumes:** CSS design system
**Produces:** Product detail page with full info, flash sale countdown, stock indicator, CTA

- [ ] **Step 1: Create `public/product-detail.html`**

Structure:
```html
<nav class="navbar">...</nav>
<main>
  <!-- Breadcrumb -->
  <section data-od-id="breadcrumb" class="container">
    Beranda > Flash Sale > [Product Name]
  </section>

  <!-- Product Detail -->
  <section data-od-id="product-detail" class="container product-detail">
    <div class="product-gallery"> <!-- image placeholder --> </div>
    <div class="product-info">
      <h1>Product Name</h1>
      <span class="badge badge-danger">Flash Sale</span>
      <p class="product-price">
        <span class="price-discount">Rp 149.000</span>
        <span class="price-original">Rp 299.000</span>
      </p>
      <!-- Countdown -->
      <div class="countdown">
        <span>02</span>:<span>45</span>:<span>30</span>
      </div>
      <!-- Stock bar -->
      <div class="stock-bar"><div class="stock-bar-fill" style="width:35%"></div></div>
      <p class="stock-text">Sisa 35 dari 100</p>
      <!-- CTA -->
      <button class="btn btn-primary btn-lg btn-block">Beli Sekarang</button>
    </div>
  </section>
</main>
```

---

### Task 4: Cart Page (`cart.html`)

**Files:**
- Create: `public/cart.html`
- Uses: `public/style.css`

**Consumes:** CSS design system
**Produces:** Cart page with items list, quantity control, subtotal, guest checkout prompt

- [ ] **Step 1: Create `public/cart.html`**

States covered:
1. **Default** — 3 cart items with quantity buttons, subtotal
2. **Empty cart** — when no items, show empty state illustration + "Belanja Yuk" CTA
3. **Guest view** — show "Login untuk melanjutkan" prompt before checkout button
4. **User view** — show "Checkout" button

Include a small notice banner at top: "Kamu belanja sebagai Guest — Login untuk menyimpan keranjang"

---

### Task 5: Auth Page (`auth.html`)

**Files:**
- Create: `public/auth.html`
- Uses: `public/style.css`

**Consumes:** CSS design system
**Produces:** Login / Sign Up page with tabs, forms, validation states

- [ ] **Step 1: Create `public/auth.html`**

Structure:
```html
<nav class="navbar">...</nav>
<main>
  <section data-od-id="auth-section" class="container auth-container">
    <div class="auth-card">
      <!-- Tab toggle: Masuk | Daftar -->
      <div class="auth-tabs">
        <button class="auth-tab active">Masuk</button>
        <button class="auth-tab">Daftar</button>
      </div>

      <!-- Login Form -->
      <form class="auth-form active">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" type="email" placeholder="contoh@email.com">
          <span class="form-error">Email tidak valid</span>
        </div>
        <div class="form-group">
          <label class="form-label">Kata Sandi</label>
          <input class="form-input" type="password" placeholder="Min. 8 karakter">
        </div>
        <button class="btn btn-primary btn-block">Masuk</button>
        <p class="auth-alt">Belum punya akun? <a href="#">Daftar</a></p>
      </form>

      <!-- Register Form -->
      <form class="auth-form">
        <div class="form-group">
          <label class="form-label">Nama Lengkap</label>
          <input class="form-input" type="text" placeholder="Nama kamu">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" type="email" placeholder="contoh@email.com">
        </div>
        <div class="form-group">
          <label class="form-label">Kata Sandi</label>
          <input class="form-input" type="password" placeholder="Min. 8 karakter">
        </div>
        <button class="btn btn-primary btn-block">Daftar</button>
        <p class="auth-alt">Sudah punya akun? <a href="#">Masuk</a></p>
      </form>
    </div>
  </section>
</main>
```

Validation states: show `.form-error` on email field when invalid, `.form-input.form-input-error` red border.

---

### Task 6: Checkout Flash Sale (`checkout.html`)

**Files:**
- Create: `public/checkout.html`
- Uses: `public/style.css`

**Consumes:** CSS design system
**Produces:** Checkout page with order summary, loading simulation, success/out-of-stock result

- [ ] **Step 1: Create `public/checkout.html`**

Three visual states (use CSS classes to toggle):
1. **Confirmation state** — shows product summary, price, "Konfirmasi Pembelian" button
2. **Loading state** — button disabled with spinner, "Memproses pesanan..." text (simulasi)
3. **Result SUCCESS** — green checkmark, "Pembelian Berhasil!", order ID, "Lihat Invoice" button
4. **Result OUT_OF_STOCK** — red X icon, "Stok Habis!", "Kembali ke Produk" button

This page is the core flash sale interaction — make it feel urgent and responsive.

---

### Task 7: Invoice Page (`invoice.html`)

**Files:**
- Create: `public/invoice.html`
- Uses: `public/style.css`

**Consumes:** CSS design system
**Produces:** Transaction success confirmation with order details

- [ ] **Step 1: Create `public/invoice.html`**

Structure:
```html
<nav class="navbar">...</nav>
<main>
  <section data-od-id="invoice-section" class="container invoice-container">
    <div class="invoice-card">
      <!-- Success Badge -->
      <div class="invoice-header">
        <span class="badge badge-success">PAID</span>
        <h1>Pembelian Berhasil!</h1>
        <p class="invoice-id">Order #INV-20260730-001</p>
      </div>

      <!-- Detail Items -->
      <div class="invoice-details">
        <div class="invoice-row">
          <span>Produk</span>
          <span>[Product Name] x 1</span>
        </div>
        <div class="invoice-row">
          <span>Harga Satuan</span>
          <span>Rp 149.000</span>
        </div>
        <div class="invoice-row">
          <span>Status</span>
          <span class="badge badge-success">LUNAS</span>
        </div>
        <div class="invoice-row invoice-total">
          <span>Total</span>
          <span>Rp 149.000</span>
        </div>
      </div>

      <button class="btn btn-outline">Kembali Belanja</button>
    </div>
  </section>
</main>
```

Include timestamp, payment method (simulasi: "Transfer Bank — Otomatis"), and "Cetak Nota" link.

---

### Task 8: Admin Dashboard (`admin.html`)

**Files:**
- Create: `public/admin.html`
- Uses: `public/style.css`

**Consumes:** CSS design system + sidebar component
**Produces:** Admin panel with sidebar nav, stat cards, product table, CRUD modal, flash sale controls, kill-switch

- [ ] **Step 1: Create `public/admin.html`**

Layout: sidebar (fixed left 260px) + main content (right). No top navbar — sidebar has logo, nav links, user info.

Sidebar sections:
1. **Dashboard** — overview stats
2. **Produk** — product table
3. **Flash Sale** — scheduler + cache warming + kill-switch
4. **Pesanan** — order list

Main content (default tab: Dashboard):
1. **Stat cards row** — Total Produk, Flash Sale Aktif, Pesanan Hari Ini, Pendapatan (with mono font values)
2. **Products tab** — table with columns (Nama, Harga, Stok, Flash Sale, Aksi) + "Tambah Produk" button + modal form
3. **Flash Sale tab** — active flash sale list, "Mulai Flash Sale" form (product select, start time, end time, quota), "Warm Up Cache" button, red **Emergency Kill-Switch** button with confirmation modal
4. **Modal** — reusable overlay for add/edit product form and kill-switch confirmation

Include a live monitoring section with stat cards showing real-time values (Order/s, Active Users, Redis Memory, DB Connections — all simulated static values with mono display).

---

## Spec Coverage Check

| Spec Requirement | Task |
|---|---|
| Design system (colors, typography, spacing) | Task 1 |
| Home — catalog + flash sale banner | Task 2 |
| Product detail — countdown + stock + CTA | Task 3 |
| Cart — guest/user view + empty state | Task 4 |
| Auth — login/sign up tabs + validation | Task 5 |
| Checkout flash sale — loading + result | Task 6 |
| Invoice — success confirmation | Task 7 |
| Admin dashboard — sidebar + CRUD + kill-switch | Task 8 |

All spec requirements covered. No gaps.
