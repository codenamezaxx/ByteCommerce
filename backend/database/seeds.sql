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
-- 2. Seed Products (28 produk)
-- Nama & harga produk 1-9 mengikuti prototipe public/home.html dan
-- public/product-detail.html (fidelity). Produk 10, 12, 13 diekstrapolasi
-- dengan gaya nama produk Indonesia yang sama. Produk 5, 11 diekstrapolasi
-- untuk memenuhi kuota flash sale (5) dan low stock (3). Produk 14-28
-- merupakan ekstensi katalog reguler.
--
--   Id 1-5  : FLASH SALE (stok 10-20, diskon 40-46% dari harga normal)
--   Id 6-10 : REGULER (stok 50-100, harga normal)
--   Id 11-13: LOW STOCK (stok 2-5, harga normal)
--   Id 14-28: REGULER (katalog tambahan)
--
-- Kolom image_url berisi key relatif ('products/product-N.jpg') yang disimpan
-- di dalam container (backend/uploads/products). File gambar di-copy saat
-- image backend di-build; jangan menghapus folder backend/uploads/products.
-- =============================================================================
INSERT INTO products (id, name, description, category, price, stock, is_flash_sale, flash_sale_price, flash_sale_stock, image_url) VALUES
    -- FLASH SALE (5)
    (1, 'Smartwatch X100',
     'Smartwatch X100 hadir dengan desain premium dan layar AMOLED 1.4 inch yang tajam. Dilengkapi GPS built-in, pemantauan detak jantung 24/7, dan ketahanan air hingga 50 meter. Cocok untuk gaya hidup aktif sehari-hari.',
     'Elektronik', 1499000.00, 12, TRUE, 899000.00, 12, 'products/product-1.jpg'),
    (2, 'Wireless Earbuds Pro',
     'Wireless Earbuds Pro menawarkan kualitas audio premium dengan Active Noise Cancellation dan daya tahan baterai hingga 30 jam. Desain ergonomis untuk kenyamanan sepanjang hari.',
     'Elektronik', 899000.00, 10, TRUE, 549000.00, 10, 'products/product-2.jpg'),
    (3, 'Sneaker Run Ultralight',
     'Sneaker run dengan bobot super ringan dan sol responsif untuk kenyamanan maksimal saat berlari. Upper mesh breathable menjaga kaki tetap sejuk sepanjang aktivitas.',
     'Fashion', 799000.00, 20, TRUE, 429000.00, 20, 'products/product-3.jpg'),
    (4, 'Tas Ransel Urban 30L',
     'Tas ransel urban berkapasitas 30L dengan kompartemen khusus laptop 15 inch dan bahan anti air. Cocok untuk aktivitas harian maupun perjalanan singkat.',
     'Fashion', 499000.00, 15, TRUE, 299000.00, 15, 'products/product-4.jpg'),
    (5, 'Smart TV LED 32 Inch',
     'Smart TV LED 32 inch dengan resolusi HD dan sistem operasi Android TV. Dilengkapi koneksi WiFi, Bluetooth, dan berbagai aplikasi streaming favorit.',
     'Elektronik', 2999000.00, 18, TRUE, 1799000.00, 18, 'products/product-5.jpg'),

    -- REGULER (5)
    (6, 'Kemeja Oxford Premium',
     'Kemeja oxford premium dengan bahan katun yang nyaman dan jahitan rapi. Cocok untuk gaya formal maupun kasual sehari-hari.',
     'Fashion', 249000.00, 100, FALSE, NULL, NULL, 'products/product-6.jpg'),
    (7, 'Headphone ANC Silent',
     'Headphone over-ear dengan fitur Active Noise Cancellation dan kualitas suara premium. Baterai tahan hingga 40 jam pemakaian.',
     'Elektronik', 1299000.00, 80, FALSE, NULL, NULL, 'products/product-7.jpg'),
    (8, 'Jam Tangan Classic',
     'Jam tangan classic dengan desain elegan dan strap kulit asli. Cocok untuk melengkapi penampilan formal maupun semi formal.',
     'Aksesoris', 699000.00, 60, FALSE, NULL, NULL, 'products/product-8.jpg'),
    (9, 'Dompet Slim RFID',
     'Dompet slim dengan pelindung RFID untuk mengamankan kartu dari pembacaan ilegal. Desain tipis dan ringkas muat di dalam saku.',
     'Aksesoris', 179000.00, 75, FALSE, NULL, NULL, 'products/product-9.jpg'),
    (10, 'Suplemen Vitamin C 1000mg',
     'Suplemen vitamin C 1000mg untuk membantu menjaga daya tahan tubuh. Dikemas dalam botol isi 60 tablet.',
     'Kesehatan', 85000.00, 90, FALSE, NULL, NULL, 'products/product-10.jpg'),

    -- LOW STOCK (3)
    (11, 'Kabel USB-C Braided',
     'Kabel USB-C braided dengan material anyaman yang kuat dan tahan lama. Mendukung fast charging hingga 60W.',
     'Elektronik', 99000.00, 3, FALSE, NULL, NULL, 'products/product-11.jpg'),
    (12, 'Power Bank 10000mAh',
     'Power bank kapasitas 10000mAh dengan dual output USB dan dukungan fast charging. Ringan dan mudah dibawa bepergian.',
     'Elektronik', 349000.00, 5, FALSE, NULL, NULL, 'products/product-12.jpg'),
    (13, 'Tumbler Stainless 750ml',
     'Tumbler stainless steel 750ml dengan isolasi ganda untuk menjaga suhu minuman hingga 12 jam.',
     'Aksesoris', 149000.00, 2, FALSE, NULL, NULL, 'products/product-13.jpg'),

    -- REGULER TAMBAHAN (15)
    (14, 'Keyboard Mechanical RGB',
     'Keyboard mechanical dengan switch red yang responsif dan backlight RGB 16 juta warna. Aluminium frame kokoh dengan hot-swappable switch.',
     'Elektronik', 549000.00, 45, FALSE, NULL, NULL, 'products/product-14.jpg'),
    (15, 'Mouse Wireless Ergo',
     'Mouse wireless ergonomis dengan sensor presisi 1600 DPI dan koneksi 2.4GHz. Hening saat diklik dan nyaman untuk pemakaian lama.',
     'Elektronik', 279000.00, 60, FALSE, NULL, NULL, 'products/product-15.jpg'),
    (16, 'Monitor IPS 24 Inch',
     'Monitor 24 inch panel IPS Full HD dengan refresh rate 75Hz dan bezel tipis. Dilengkapi port HDMI dan DisplayPort.',
     'Elektronik', 1749000.00, 25, FALSE, NULL, NULL, 'products/product-16.jpg'),
    (17, 'Laptop 14 Inch Ryzen 5',
     'Laptop 14 inch ringan dengan prosesor Ryzen 5, RAM 16GB dan SSD 512GB. Layar FHD IPS untuk produktivitas harian.',
     'Elektronik', 7999000.00, 15, FALSE, NULL, NULL, 'products/product-17.jpg'),
    (18, 'Speaker Bluetooth Portable',
     'Speaker bluetooth portabel dengan suara 360 derajat dan bass bertenaga. Baterai tahan hingga 20 jam, tahan cipratan air.',
     'Elektronik', 899000.00, 40, FALSE, NULL, NULL, 'products/product-18.jpg'),
    (19, 'Kamera Mirrorless 24MP',
     'Kamera mirrorless 24MP dengan sensor APS-C dan video 4K30. Fokus otomatis cepat dengan eye detection.',
     'Elektronik', 9499000.00, 8, FALSE, NULL, NULL, 'products/product-19.jpg'),
    (20, 'Hoodie Premium Cotton',
     'Hoodie berbahan cotton fleece premium yang lembut dan hangat. Desain oversized dengan kantong depan yang fungsional.',
     'Fashion', 399000.00, 55, FALSE, NULL, NULL, 'products/product-20.jpg'),
    (21, 'Celana Jeans Slim Fit',
     'Celana jeans slim fit dengan denim stretch yang nyaman. Warna indigo serbaguna untuk gaya kasual sehari-hari.',
     'Fashion', 329000.00, 48, FALSE, NULL, NULL, 'products/product-21.jpg'),
    (22, 'Topi Baseball Casual',
     'Topi baseball casual dengan bahan twill nyaman dan jahitan rapi. Buckle belakang yang dapat disesuaikan.',
     'Fashion', 99000.00, 70, FALSE, NULL, NULL, 'products/product-22.jpg'),
    (23, 'Kacamata Hitam Polarized',
     'Kacamata hitam polarized dengan proteksi UV400 dan frame ringan. Desain klasik yang cocok untuk segala bentuk wajah.',
     'Fashion', 249000.00, 65, FALSE, NULL, NULL, 'products/product-23.jpg'),
    (24, 'Botol Minum Sport 1L',
     'Botol minum sport 1 liter dengan tutup anti bocor dan material Tritan bebas BPA. Mudah dibawa saat olahraga.',
     'Aksesoris', 129000.00, 80, FALSE, NULL, NULL, 'products/product-24.jpg'),
    (25, 'Tas Selempang Mini',
     'Tas selempang mini dengan beberapa kompartemen dan bahan kanvas tebal. Tali panjang yang dapat diatur.',
     'Aksesoris', 219000.00, 50, FALSE, NULL, NULL, 'products/product-25.jpg'),
    (26, 'Fitness Tracker Band',
     'Fitness tracker dengan layar AMOLED 1.1 inch, pemantauan detak jantung dan sleep tracking. Tahan air 5ATM.',
     'Aksesoris', 449000.00, 35, FALSE, NULL, NULL, 'products/product-26.jpg'),
    (27, 'Skincare Set Wajah',
     'Skincare set lengkap dengan facial wash, serum dan moisturizer untuk kulit sehat. Formula ringan untuk semua jenis kulit.',
     'Kesehatan', 379000.00, 30, FALSE, NULL, NULL, 'products/product-27.jpg'),
    (28, 'Masker KN95 50pcs',
     'Masker KN95 50 pcs dengan filtrasi 95% dan 5 layer perlindungan. Nyaman dipakai sepanjang hari.',
     'Kesehatan', 149000.00, 120, FALSE, NULL, NULL, 'products/product-28.jpg');

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
