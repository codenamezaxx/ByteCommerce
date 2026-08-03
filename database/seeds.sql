-- =============================================================================
-- ByteCommerce - Seed Data Script (PostgreSQL 16)
-- =============================================================================
-- Skrip ini DIRANCANG untuk berjalan hanya pada database FRESH, yaitu tepat
-- setelah init.sql dieksekusi pada saat container pertama kali dijalankan
-- (docker-entrypoint-initdb.d). Semua statement dibungkus dalam satu transaksi
-- (BEGIN/COMMIT) agar konsisten.
--
-- CATATAN IDEMPOTENCY:
-- * Bukan skrip idempotent seperti migrasi biasa. Jika database sudah terisi,
--   jangan jalankan ulang tanpa persiapan.
-- * Untuk melakukan re-seed secara manual pada database yang sudah ada,
--   TRUNCATE tabel terlebih dahulu dengan urutan yang benar:
--       TRUNCATE order_items, orders, cart_items, carts, products, users
--       RESTART IDENTITY CASCADE;
--   Kemudian jalankan file ini.
-- * Karena init.sql baru saja berjalan, nilai SERIAL dimulai dari 1. Id eksplisit
--   digunakan agar statement berikutnya (mis. order_items) dapat mereferensikan
--   id produk/user secara langsung dan deterministik.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Seed Users
-- Password hash di bawah adalah hasil bcrypt (cost 10) dari plaintext
-- 'Admin@123' dan dipakai untuk kedua akun demo.
-- CATATAN: plaintext password 'Admin@123' didokumentasikan di README.md.
-- =============================================================================
INSERT INTO users (id, name, email, password_hash, role) VALUES
    (1, 'Admin ByteCommerce', 'admin@bytecommerce.com', '$2b$10$ONr/fzOgFB8.QBS4ne.JoeNnLcYncD3bv8Tp/Qf7uY8FplmdNQ8I6', 'ADMIN'),
    (2, 'Budi Santoso',       'budi@example.com',       '$2b$10$ONr/fzOgFB8.QBS4ne.JoeNnLcYncD3bv8Tp/Qf7uY8FplmdNQ8I6', 'USER');

-- =============================================================================
-- 2. Seed Products (13 produk)
-- Nama & harga produk 1-9 mengikuti prototipe public/home.html dan
-- public/product-detail.html (fidelity). Produk 10, 12, 13 diekstrapolasi
-- dengan gaya nama produk Indonesia yang sama. Produk 5, 11 diekstrapolasi
-- untuk memenuhi kuota flash sale (5) dan low stock (3).
--
--   Id 1-5  : FLASH SALE (stok 10-20, diskon 40-46% dari harga normal)
--   Id 6-10 : REGULER (stok 50-100, harga normal)
--   Id 11-13: LOW STOCK (stok 2-5, harga normal)
-- =============================================================================
INSERT INTO products (id, name, description, price, stock, is_flash_sale, flash_sale_price) VALUES
    -- FLASH SALE (5)
    (1, 'Smartwatch X100',
     'Smartwatch X100 hadir dengan desain premium dan layar AMOLED 1.4 inch yang tajam. Dilengkapi GPS built-in, pemantauan detak jantung 24/7, dan ketahanan air hingga 50 meter. Cocok untuk gaya hidup aktif sehari-hari.',
     1499000.00, 12, TRUE, 899000.00),
    (2, 'Wireless Earbuds Pro',
     'Wireless Earbuds Pro menawarkan kualitas audio premium dengan Active Noise Cancellation dan daya tahan baterai hingga 30 jam. Desain ergonomis untuk kenyamanan sepanjang hari.',
     899000.00, 10, TRUE, 549000.00),
    (3, 'Sneaker Run Ultralight',
     'Sneaker run dengan bobot super ringan dan sol responsif untuk kenyamanan maksimal saat berlari. Upper mesh breathable menjaga kaki tetap sejuk sepanjang aktivitas.',
     799000.00, 20, TRUE, 429000.00),
    (4, 'Tas Ransel Urban 30L',
     'Tas ransel urban berkapasitas 30L dengan kompartemen khusus laptop 15 inch dan bahan anti air. Cocok untuk aktivitas harian maupun perjalanan singkat.',
     499000.00, 15, TRUE, 299000.00),
    (5, 'Smart TV LED 32 Inch',
     'Smart TV LED 32 inch dengan resolusi HD dan sistem operasi Android TV. Dilengkapi koneksi WiFi, Bluetooth, dan berbagai aplikasi streaming favorit.',
     2999000.00, 18, TRUE, 1799000.00),

    -- REGULER (5)
    (6, 'Kemeja Oxford Premium',
     'Kemeja oxford premium dengan bahan katun yang nyaman dan jahitan rapi. Cocok untuk gaya formal maupun kasual sehari-hari.',
     249000.00, 100, FALSE, NULL),
    (7, 'Headphone ANC Silent',
     'Headphone over-ear dengan fitur Active Noise Cancellation dan kualitas suara premium. Baterai tahan hingga 40 jam pemakaian.',
     1299000.00, 80, FALSE, NULL),
    (8, 'Jam Tangan Classic',
     'Jam tangan classic dengan desain elegan dan strap kulit asli. Cocok untuk melengkapi penampilan formal maupun semi formal.',
     699000.00, 60, FALSE, NULL),
    (9, 'Dompet Slim RFID',
     'Dompet slim dengan pelindung RFID untuk mengamankan kartu dari pembacaan ilegal. Desain tipis dan ringkas muat di dalam saku.',
     179000.00, 75, FALSE, NULL),
    (10, 'Suplemen Vitamin C 1000mg',
     'Suplemen vitamin C 1000mg untuk membantu menjaga daya tahan tubuh. Dikemas dalam botol isi 60 tablet.',
     85000.00, 90, FALSE, NULL),

    -- LOW STOCK (3)
    (11, 'Kabel USB-C Braided',
     'Kabel USB-C braided dengan material anyaman yang kuat dan tahan lama. Mendukung fast charging hingga 60W.',
     99000.00, 3, FALSE, NULL),
    (12, 'Power Bank 10000mAh',
     'Power bank kapasitas 10000mAh dengan dual output USB dan dukungan fast charging. Ringan dan mudah dibawa bepergian.',
     349000.00, 5, FALSE, NULL),
    (13, 'Tumbler Stainless 750ml',
     'Tumbler stainless steel 750ml dengan isolasi ganda untuk menjaga suhu minuman hingga 12 jam.',
     149000.00, 2, FALSE, NULL);

-- =============================================================================
-- 3. Seed Sample Orders (riwayat transaksi user "Budi Santoso", user_id = 2)
-- price_at_purchase disesuaikan dengan harga saat transaksi: harga flash untuk
-- produk flash sale, harga normal untuk produk reguler. created_at memakai
-- tanggal tetap (timestamptz, offset +07 WIB) sekitar 1-2 hari sebelum hari ini.
-- =============================================================================
INSERT INTO orders (id, user_id, total_amount, status, created_at) VALUES
    -- Order 1: 1x Smartwatch X100 (harga flash)
    (1, 2, 899000.00, 'PAID', '2026-07-28 09:15:00+07'),
    -- Order 2: 2x Kemeja Oxford Premium
    (2, 2, 498000.00, 'PAID', '2026-07-29 14:30:00+07'),
    -- Order 3: 1x Wireless Earbuds Pro (harga flash) + 1x Dompet Slim RFID
    (3, 2, 728000.00, 'PAID', '2026-07-29 20:05:00+07');

INSERT INTO order_items (id, order_id, product_id, quantity, price_at_purchase) VALUES
    (1, 1, 1, 1, 899000.00),
    (2, 2, 6, 2, 249000.00),
    (3, 3, 2, 1, 549000.00),
    (4, 3, 9, 1, 179000.00);

-- =============================================================================
-- 4. Sinkronisasi Sequence (safety)
-- Karena id eksplisit dipakai di atas, sequence SERIAL perlu disetel agar
-- nilai id selanjutnya tidak bertabrakan dengan data seed.
-- =============================================================================
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));
SELECT setval('orders_id_seq', (SELECT MAX(id) FROM orders));
SELECT setval('order_items_id_seq', (SELECT MAX(id) FROM order_items));

COMMIT;
