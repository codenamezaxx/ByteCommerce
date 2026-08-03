# ByteCommerce — Design System

Dokumen ini adalah **sumber kebenaran tunggal (single source of truth)** untuk tampilan visual ByteCommerce. Menggantikan/menyempurnakan bagian visual di dokumen spesifikasi lain, dan menjadi acuan utama untuk semua pengembangan selanjutnya.

> **MANDAT AKURASI 100%** — Versi pengembangan Next.js (dan seluruh versi produksi berikutnya) WAJIB memiliki desain tampilan yang **100% akurat** terhadap versi prototipe (`public/*.html` + `public/style.css`). Artinya:
> - Semua warna, font, ukuran, jarak, radius, bayangan, dan transisi harus identik dengan prototipe.
> - Tidak boleh ada perombakan visual, "peningkatan" estetika sewenang-wenang, atau penyimpangan token di luar dokumen ini.
> - Setiap komponen baru wajib mengikuti token dan pola di dokumen ini, bukan menciptakan gaya sendiri.
> - Perubahan desain apa pun harus melalui persetujuan eksplisit dan diperbarui di dokumen ini terlebih dahulu.

---

## 1. Arah Desain

**Professional Minimal** — bersih, tenang, dan profesional. Fokus pada keterbacaan dan kepercayaan, tanpa dekorasi berlebihan.

Karakteristik:
- Latar terang netral `#FAFBFC`, konten di atas surface putih.
- Aksen biru `#2563EB` dipakai hemat: CTA utama, tautan, elemen aktif.
- Merah `#DC2626` hanya untuk diskon flash sale, harga coret, dan error/danger.
- Hierarki dibangun lewat tipografi dan spasi, bukan kotak/garis yang ramai.
- Tanpa gradien, tanpa emoji, tanpa drop-shadow berlebihan (aturan anti-AI-slop — lihat §6).

## 2. Prinsip Desain

1. **Token dulu, komponen kedua.** Semua nilai visual harus lewat CSS custom properties (`:root`), bukan hardcode di tiap komponen. Satu-satunya pengecualian: permukaan statis yang memang selalu gelap (`hero`, `flash-banner`).
2. **Kontras untuk keterbacaan.** Teks primer `--fg`, sekunder `--muted`. Warna teks pada aksen selalu lewat `--on-accent` / `--on-danger`.
3. **Spasi 0.5rem (8px) base.** Grid `--max-width: 1120px`, padding horizontal container `1.25rem`.
4. **Responsif satu breakpoint:** 768px. Di bawah itu, pola mobile sederhana (lihat §8).
5. **Semua interaktif punya state:** `:hover`, `:focus` (ring), `:disabled` / `.loading`.

## 3. Tokens Warna

### 3.1 Tema Terang (default, `:root`)

| Token | Nilai | Penggunaan |
|---|---|---|
| `--bg` | `#FAFBFC` | Latar halaman |
| `--surface` | `#FFFFFF` | Kartu, panel, formulir |
| `--fg` | `#0F172A` | Teks utama, judul |
| `--muted` | `#64748B` | Teks sekunder, deskripsi |
| `--border` | `#E2E8F0` | Garis tepi |
| `--accent` | `#2563EB` | Aksen utama (CTA, link, aktif) |
| `--accent-hover` | `#1D4ED8` | Hover aksen |
| `--on-accent` | `#FFFFFF` | Teks di atas aksen |
| `--danger` | `#DC2626` | Flash sale, harga coret, error |
| `--danger-hover` | `#B91C1C` | Hover danger |
| `--on-danger` | `#FFFFFF` | Teks di atas danger |
| `--success` | `#059669` | Status sukses, tren naik |
| `--warning` | `#D97706` | Peringatan, stok menipis |

**Surface semantik (soft backgrounds):**

| Token | Nilai | Penggunaan |
|---|---|---|
| `--accent-soft` | `#EFF6FF` | Badge/latar aksen lembut |
| `--success-soft` | `#F0FDF4` | Badge sukses, ikon invoice |
| `--warning-soft` | `#FFFBEB` | Badge peringatan |
| `--neutral-soft` | `#F1F5F9` | Badge netral |
| `--danger-soft` | `#FEF2F2` | Badge danger, ikon error |
| `--disabled-bg` | `#CBD5E1` | Tombol nonaktif |
| `--disabled-fg` | `#64748B` | Teks tombol nonaktif |
| `--navbar-bg` | `rgba(255,255,255,.92)` | Navbar (efek translusen) |
| `--placeholder` | `#94A3B8` | Placeholder input |
| `--ph-bg` | `#F1F5F9` | Placeholder gambar |
| `--ph-fg` | `#94A3B8` | Teks/ikon placeholder gambar |
| `--toast-success-bg` | `#F0FDF4` | Toast sukses |
| `--toast-success-border` | `#BBF7D0` | Border toast sukses |
| `--toast-success-fg` | `#065F46` | Teks toast sukses |
| `--toast-error-bg` | `#FEF2F2` | Toast error |
| `--toast-error-border` | `#FECACA` | Border toast error |
| `--toast-error-fg` | `#991B1B` | Teks toast error |
| `--table-hover` | `#FAFBFC` | Hover baris tabel |
| `--overlay` | `rgba(15,23,42,.4)` | Latar modal |

### 3.2 Tema Gelap (opsional, dua mekanisme — lihat §7)

| Token | Nilai |
|---|---|
| `--bg` | `#0F172A` |
| `--surface` | `#1E293B` |
| `--fg` | `#F1F5F9` |
| `--muted` | `#94A3B8` |
| `--border` | `#334155` |
| `--accent` | `#60A5FA` |
| `--accent-hover` | `#3B82F6` |
| `--on-accent` | `#0F172A` |
| `--danger` | `#F87171` |
| `--danger-hover` | `#EF4444` |
| `--on-danger` | `#0F172A` |
| `--success` | `#34D399` |
| `--warning` | `#FBBF24` |
| `--accent-soft` | `rgba(59,130,246,.16)` |
| `--success-soft` | `rgba(5,150,105,.16)` |
| `--warning-soft` | `rgba(217,119,6,.16)` |
| `--neutral-soft` | `rgba(148,163,184,.14)` |
| `--danger-soft` | `rgba(220,38,38,.16)` |
| `--disabled-bg` | `#334155` |
| `--disabled-fg` | `#64748B` |
| `--navbar-bg` | `rgba(15,23,42,.85)` |
| `--placeholder` | `#64748B` |
| `--ph-bg` | `rgba(148,163,184,.1)` |
| `--ph-fg` | `#64748B` |
| `--toast-success-bg` | `rgba(5,150,105,.16)` |
| `--toast-success-border` | `rgba(16,185,129,.4)` |
| `--toast-success-fg` | `#6EE7B7` |
| `--toast-error-bg` | `rgba(220,38,38,.16)` |
| `--toast-error-border` | `rgba(248,113,113,.4)` |
| `--toast-error-fg` | `#FCA5A5` |
| `--table-hover` | `rgba(148,163,184,.06)` |
| `--overlay` | `rgba(2,6,23,.6)` |

**Ring focus (kedua tema):**

| Token | Terang | Gelap |
|---|---|---|
| `--ring-accent` | `0 0 0 3px rgba(37,99,235,.12)` | `0 0 0 3px rgba(96,165,250,.25)` |
| `--ring-danger` | `0 0 0 3px rgba(220,38,38,.12)` | `0 0 0 3px rgba(248,113,113,.25)` |

**Bayangan (kedua tema):**

| Token | Terang | Gelap |
|---|---|---|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,.06)` | `0 1px 3px rgba(0,0,0,.4)` |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,.08)` | `0 4px 12px rgba(0,0,0,.45)` |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,.12)` | `0 8px 24px rgba(0,0,0,.55)` |

## 4. Tipografi

**Semua font sans-serif.** Tidak ada serif di seluruh sistem (keputusan final — menggantikan rencana awal serif heading).

| Token | Font stack | Penggunaan |
|---|---|---|
| `--font-display` | `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | Semua heading (h1–h6) |
| `--font-body` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif` | Teks tubuh, label, tombol |
| `--font-mono` | `ui-monospace, 'SF Mono', 'Cascadia Code', 'Fira Code', monospace` | Harga, countdown, ID invoice, nilai statistik, qty |

### Skala Heading (semua `font-weight: 700`, `line-height: 1.2`, warna `--fg`)

| Elemen | Ukuran | Spasi huruf |
|---|---|---|
| `h1` | `clamp(1.75rem, 4vw, 2.5rem)` | `-0.025em` |
| `h2` | `clamp(1.35rem, 3vw, 1.75rem)` | `-0.015em` |
| `h3` | `clamp(1.1rem, 2vw, 1.35rem)` | normal |
| `h4` | `1.1rem` | normal |
| h5–h6 | inherits | normal |

### Elemen Teks Lain

- `body` — `--font-body`, ukuran default 16px, `line-height: 1.6`, warna `--fg`.
- `.eyebrow` — label kecil uppercase di atas judul section: `0.8rem`, `weight 600`, `uppercase`, `letter-spacing 0.08em`, warna `--muted`.
- `.mono` — helper untuk memakai font mono.
- Deskripsi produk (`.product-desc`) — `0.95rem`, `--muted`, `line-height 1.7`.
- Harga — selalu mono. Harga besar (`.price-current`) `1.75rem`/700, harga coret `1rem`/`line-through`/`--muted`.

## 5. Layout & Spasi

| Token | Nilai | Penggunaan |
|---|---|---|
| `--max-width` | `1120px` | Lebar container |
| `--radius-sm` | `8px` | Input, tombol kecil, gambar kecil |
| `--radius-md` | `12px` | Kartu, modal, panel besar |
| `--transition` | `200ms ease` | Semua transisi interaksi |

- `.container` — `max-width: var(--max-width); margin: 0 auto; padding: 0 1.25rem;`
- `.page` — `padding: 2rem 0`; `.page-lg` — `padding: 4rem 0`.
- Basis spasi: kelipatan `0.5rem` (8px). Utility: `.gap-1/2/3`, `.mt-1/2/3`, `.mb-1/2/3`, `.flex`, `.flex-col`, `.items-center`, `.justify-between`, `.text-center`, `.text-muted`.

## 6. Aturan Anti-AI-Slop

Diterapkan pada prototipe, WAJIB dipertahankan di versi berikutnya:

1. **Tidak ada emoji.** Semua ikon adalah inline SVG (stroke tipis, ukuran konsisten).
2. **Tidak ada gradien.** Warna solid datar; permukaan statis gelap memakai warna solid (`#0F172A` / `#DC2626`).
3. **Tidak ada em-dash (—) atau ellipsis (...) di copy.** Gunakan bahasa biasa dan titik/dua titik.
4. **Tidak ada klaim berlebihan di copy** ("best", "amazing", dll). Bahasa to-the-point.
5. **Tidak ada footer versi/credit** ("© 2026 ... v1.0.0", "Made with ❤", dll).
6. **Hindari kotak bertepi tebal / "UI awal"** — gunakan spasi dan tipografi untuk hierarki.

## 7. Mode Gelap

Dua mekanisme, diimplementasikan di akhir `style.css`:

1. **Otomatis** — `@media (prefers-color-scheme: dark)` menimpa `:root:not([data-theme="light"])`.
2. **Manual** — `<html data-theme="dark">` memaksa gelap, `<html data-theme="light">` memaksa terang (menimpa preferensi OS).

Aturan penting:
- Kedua blok berisi token **identik** — jangan ubah satu tanpa mengubah yang lain.
- Elemen statis (hero, flash-banner) tetap gelap di kedua tema — tidak ikut token.
- `color-scheme: dark` diset di blok gelap agar native controls ikut gelap.

## 8. Responsif

Breakpoint tunggal **`max-width: 768px`**:

| Area | Perilaku di mobile |
|---|---|
| `.navbar-links` | Disembunyikan (`.navbar-auth` tetap tampil) |
| `.product-grid` | `minmax(160px, 1fr)` + `gap 0.85rem` |
| `.product-detail` | Grid 2 kolom → 1 kolom, `gap 1.5rem` |
| `.admin-layout` | Kolom (sidebar jadi bar horizontal atas) |
| `.sidebar` | Lebar 100%, `flex-direction: row`, brand & footer disembunyikan |
| `.stat-grid` | 4 → 2 kolom |
| `.cart-item .ph-img` | 80px → 60px |
| `.hero` | Padding `2.5rem 1rem` |
| `.footer-inner` | Kolom, rata tengah |
| `.invoice-card` | Padding `1.25rem` |

Juga ada container query `@container (min-width: 700px)` untuk `.product-detail` (grid 2 kolom) — pertahankan saat diporting.

## 9. Inventaris Komponen

| Komponen | Kelas kunci | Catatan |
|---|---|---|
| Navbar | `.navbar`, `.navbar-inner`, `.navbar-brand`, `.navbar-links`, `.navbar-auth` | Latar `--navbar-bg`, brand punya span aksen |
| Tombol | `.btn`, `.btn-primary`, `.btn-outline`, `.btn-danger`, `.btn-ghost`, `.btn-lg`, `.btn-block`, `.btn.loading` | State hover/focus ring/disabled; `.loading` menampilkan spinner |
| Kartu | `.card`, `.card-flat` | Radius md, hover naik ke `--shadow-md` |
| Badge | `.badge`, `.badge-danger`, `.badge-success`, `.badge-warning`, `.badge-neutral` | Pakai warna solid + `--on-*` untuk kontras |
| Formulir | `.form-group`, `.form-label`, `.form-input`, `.form-input-error`, `.form-error` | Focus pakai `--ring-accent`; error pakai `--danger` + ring |
| Grid produk | `.product-grid`, `.product-card`, `.product-card-body` | `repeat(auto-fill, minmax(200px, 1fr))` |
| Harga | `.product-price`, `.price-current`, `.price-original` | Mono; coret utk diskon |
| Countdown | `.countdown`, `.countdown-label` | Mono, separator `:` |
| Stok bar | `.stock-bar`, `.stock-bar-fill` (+`.danger`/`.warning`), `.stock-text` | Fill hijau/amber/merah |
| Toast | `.toast`, `.toast-success`, `.toast-error` | Border + soft bg + fg khusus |
| Footer | `.footer`, `.footer-inner` | Simpel, muted |
| Admin layout | `.admin-layout`, `.sidebar`, `.sidebar-link`(+`.active`), `.sidebar-divider`, `.admin-main` | Sidebar kiri 220px |
| Statistik | `.stat-grid`, `.stat-card`, `.stat-value`, `.stat-label`, `.stat-trend`(+`.up`/`.down`) | Nilai mono, tren sukses/danger |
| Tabel | `.table-wrap` | Hover baris `--table-hover` |
| Modal | `.modal-overlay`(+`.open`), `.modal-content`, `.modal-header`, `.modal-close`, `.modal-footer` | Overlay `--overlay` |
| Auth tabs | `.auth-tabs`, `.auth-tab`(+`.active`) | Login/daftar switch |
| Hero | `.hero`, `.hero-content` | Latar statis `#0F172A`, teks putih, countdown glassy |
| Detail produk | `.product-detail`, `.product-gallery`, `.product-info`, `.product-prices`, `.product-desc` | 2 kolom desktop |
| Order summary | `.order-summary`, `.summary-row`, `.summary-total` | Panel maks 480px, total mono |
| Invoice | `.invoice-card`, `.invoice-icon`(+`.success`), `.invoice-header`, `.invoice-id`, `.invoice-details`, `.invoice-row`, `.invoice-total` | Ikon sukses pakai `--success-soft` |
| Breadcrumb | `.breadcrumb` | Muted, link aksen, item aktif fg |
| Empty state | `.empty-state` | Rata tengah |
| Cart item | `.cart-item`, `.cart-item-info`, `.cart-item-price`, `.qty-control`, `.qty-btn`, `.qty-value`, `.cart-remove`, `.cart-summary` | Qty stepper mono |
| Flash banner | `.flash-banner` | Latar statis `#DC2626`, teks putih |
| Placeholder gambar | `.ph-img` | `--ph-bg`/`--ph-fg`; produk aspect-ratio 1:1 |
| Spinner | `.spinner`, `.spinner-lg` | Untuk loading state |

## 10. Halaman Prototipe (7 halaman)

| File | Halaman |
|---|---|
| `public/home.html` | Beranda: navbar, hero, flash sale banner, grid produk, footer |
| `public/product-detail.html` | Detail produk: gallery, harga, countdown, stok, order summary |
| `public/cart.html` | Keranjang: item list + qty control, ringkasan |
| `public/auth.html` | Login/daftar: auth tabs + form |
| `public/checkout.html` | Checkout: form + order summary |
| `public/invoice.html` | Konfirmasi pesanan: invoice card |
| `public/admin.html` | Admin: sidebar, stat cards, tabel, modal |

## 11. Verifikasi Akurasi

Sebelum menyatakan versi Next.js "selesai" secara visual, wajib lolos:

1. **Token match** — setiap nilai di kode Next.js identik dengan tabel §3–§5 (boleh dipindah ke Tailwind config / CSS module, tetapi nilainya tidak berubah).
2. **Pemeriksaan visual per halaman** — bandingkan semua 7 halaman prototipe dengan halaman Next.js pada viewport desktop (≥1024px) dan mobile (≤768px).
3. **Dark mode** — kedua mekanisme (OS + `data-theme`) bekerja identik dengan prototipe.
4. **Interaksi** — hover, focus ring, disabled, loading, modal open, qty stepper, tabs: perilaku visual sama.
5. **Copy** — teks identik dengan prototipe (anti-slop: tanpa emoji/em-dash/klaim berlebihan).

---

*Dokumen ini hidup bersama kode. Setiap perubahan desain yang disetujui WAJIB diperbarui di sini terlebih dahulu, lalu direfleksikan di prototipe dan versi Next.js secara bersamaan.*
