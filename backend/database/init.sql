-- =============================================================================
-- ByteCommerce - Database Initialization Script (PostgreSQL 16)
-- =============================================================================
-- File ini dimuat secara otomatis oleh container PostgreSQL melalui volume
-- mount ke /docker-entrypoint-initdb.d/init.sql pada saat container pertama
-- kali dijalankan dengan volume data yang masih kosong (fresh start).
-- Skrip ini hanya dieksekusi SATU KALI saat inisialisasi volume; perubahan
-- skema selanjutnya harus dilakukan secara manual (migrasi).
-- Sintaks: PostgreSQL 16 native (DDL murni, tanpa ORM / Query Builder).
-- =============================================================================

-- =============================================================================
-- Clean up existing tables (defensive; hanya relevan untuk fresh database)
-- Urutan drop mengikuti hierarki foreign key dari tabel dependen ke induk.
-- =============================================================================
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS carts CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =============================================================================
-- 1. Table: users
-- =============================================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
    -- Kredensial profil pengguna (diisi via halaman /profile, dipakai auto-fill checkout).
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 2. Table: products
-- =============================================================================
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'Lainnya',
    price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    stock INT NOT NULL CHECK (stock >= 0),
    is_flash_sale BOOLEAN DEFAULT FALSE,
    flash_sale_price DECIMAL(12, 2),
    -- Kuota khusus flash sale (tidak menyentuh kolom stock) + jendela waktu event.
    flash_sale_stock INT,
    flash_sale_start TIMESTAMPTZ,
    flash_sale_end TIMESTAMPTZ,
    -- Key file gambar di uploads/products (path publik: storage.service.getPublicPath).
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 3. Table: carts & cart_items
-- Dual-owner cart: XOR user_id (login) atau guest_id (anonym).
-- =============================================================================
CREATE TABLE carts (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    guest_id VARCHAR(64) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
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
    UNIQUE (cart_id, product_id)
);

-- =============================================================================
-- 4. Table: orders & order_items
-- price_at_purchase adalah snapshot harga saat transaksi (tidak berubah
-- walaupun harga produk berubah di kemudian hari).
-- =============================================================================
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(30) DEFAULT 'PAID' CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED')),
    -- Alamat pengiriman (opsional per order lama; wajib diisi untuk order baru via checkout).
    shipping_name VARCHAR(100),
    shipping_phone VARCHAR(20),
    shipping_address TEXT,
    shipping_city VARCHAR(100),
    shipping_province VARCHAR(100),
    shipping_postal_code VARCHAR(20),
    shipping_note TEXT,
    payment_method VARCHAR(30) NOT NULL DEFAULT 'BANK_TRANSFER'
        CHECK (payment_method IN ('BANK_TRANSFER', 'COD', 'QRIS')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    price_at_purchase DECIMAL(12, 2) NOT NULL
);

-- =============================================================================
-- Optimization Indexes
-- =============================================================================
CREATE INDEX idx_products_flash_sale ON products(is_flash_sale) WHERE is_flash_sale = TRUE;
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_carts_guest ON carts(guest_id);
CREATE INDEX idx_carts_user ON carts(user_id);

-- =============================================================================
-- 5. Atomic Stored Procedure: buy_flash_sale_item
-- Engine pembelian flash sale yang aman terhadap race condition (zero-oversell):
--   * Row-Level Locking (SELECT ... FOR UPDATE) pada baris produk.
--   * Validasi keberadaan produk, status flash sale, harga flash, dan stok.
--   * Pemotongan stok ATOMIK di database pada flash_sale_stock (alokasi khusus
--     flash sale; kolom stock asli TIDAK disentuh) — bukan kalkulasi di client.
--   * Pembuatan order header (termasuk alamat pengiriman & metode pembayaran)
--     + order items dalam satu transaksi implisit.
-- Return: id order yang baru dibuat.
-- =============================================================================
CREATE OR REPLACE FUNCTION buy_flash_sale_item(
    p_user_id INT,
    p_product_id INT,
    p_quantity INT,
    p_shipping_name VARCHAR(100),
    p_shipping_phone VARCHAR(20),
    p_shipping_address TEXT,
    p_shipping_city VARCHAR(100),
    p_shipping_province VARCHAR(100),
    p_shipping_postal_code VARCHAR(20),
    p_shipping_note TEXT,
    p_payment_method VARCHAR(30)
) RETURNS INT AS $$
DECLARE
    v_stock INT;
    v_flash_stock INT;
    v_price DECIMAL(12, 2);
    v_flash_price DECIMAL(12, 2);
    v_is_flash BOOLEAN;
    v_flash_start TIMESTAMPTZ;
    v_flash_end TIMESTAMPTZ;
    v_order_id INT;
BEGIN
    SELECT stock, flash_sale_stock, price, flash_sale_price, is_flash_sale,
           flash_sale_start, flash_sale_end
    INTO v_stock, v_flash_stock, v_price, v_flash_price, v_is_flash,
         v_flash_start, v_flash_end
    FROM products
    WHERE id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
    END IF;

    IF NOT v_is_flash THEN
        RAISE EXCEPTION 'NOT_FLASH_SALE';
    END IF;

    IF v_flash_price IS NULL THEN
        RAISE EXCEPTION 'FLASH_PRICE_NOT_SET';
    END IF;

    -- Validasi jendela waktu flash sale (hanya bila item dijadwalkan):
    -- checkout di luar [flash_sale_start, flash_sale_end] ditolak ATOMIK di
    -- database — integritas durasi & killswitch tidak bergantung pada Redis.
    IF v_flash_start IS NOT NULL AND NOW() < v_flash_start THEN
        RAISE EXCEPTION 'FLASH_SALE_NOT_ACTIVE';
    END IF;
    IF v_flash_end IS NOT NULL AND NOW() > v_flash_end THEN
        RAISE EXCEPTION 'FLASH_SALE_NOT_ACTIVE';
    END IF;

    -- Stok flash sale habis / belum dialokasikan → OUT_OF_STOCK.
    -- (p_quantity >= 1 selalu terjamin oleh validasi controller.)
    IF v_flash_stock IS NULL OR v_flash_stock < p_quantity THEN
        RAISE EXCEPTION 'OUT_OF_STOCK';
    END IF;

    UPDATE products
    SET flash_sale_stock = flash_sale_stock - p_quantity
    WHERE id = p_product_id;

    INSERT INTO orders (
        user_id, total_amount, status,
        shipping_name, shipping_phone, shipping_address, shipping_city,
        shipping_province, shipping_postal_code, shipping_note, payment_method
    )
    VALUES (
        p_user_id, v_flash_price * p_quantity, 'PAID',
        p_shipping_name, p_shipping_phone, p_shipping_address, p_shipping_city,
        p_shipping_province, p_shipping_postal_code, p_shipping_note, p_payment_method
    )
    RETURNING id INTO v_order_id;

    INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
    VALUES (v_order_id, p_product_id, p_quantity, v_flash_price);

    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 6. Atomic Stored Procedure: create_cart_order
-- Engine checkout keranjang REGULER (non-flash-sale) yang aman terhadap race
-- condition (zero-oversell), mirroring buy_flash_sale_item:
--   * Row-Level Locking (SELECT ... FOR UPDATE) pada baris produk.
--   * Guard cart kosong (EMPTY_CART).
--   * Validasi keberadaan produk (PRODUCT_NOT_FOUND) & stok (OUT_OF_STOCK).
--   * Total dihitung SERVER-SIDE (SUM price * qty dari cart), bukan client.
--   * Decrement stok atomik `stock = stock - qty` di database.
--   * Order header + order_items (price_at_purchase = harga reguler) + hapus
--     item cart dalam satu transaksi implisit.
-- Return: id order yang baru dibuat.
-- =============================================================================
CREATE OR REPLACE FUNCTION create_cart_order(
    p_user_id INT,
    p_product_ids INT[],
    p_shipping_name VARCHAR(100),
    p_shipping_phone VARCHAR(20),
    p_shipping_address TEXT,
    p_shipping_city VARCHAR(100),
    p_shipping_province VARCHAR(100),
    p_shipping_postal_code VARCHAR(20),
    p_shipping_note TEXT,
    p_payment_method VARCHAR(30)
) RETURNS INT AS $$
DECLARE
    v_cart_id INT;
    v_product_id INT;
    v_quantity INT;
    v_price DECIMAL(12, 2);
    v_stock INT;
    v_total DECIMAL(12, 2) := 0;
    v_order_id INT;
BEGIN
    -- Guard: daftar produk kosong / NULL → EMTPY_CART.
    IF p_product_ids IS NULL OR COALESCE(array_length(p_product_ids, 1), 0) = 0 THEN
        RAISE EXCEPTION 'EMPTY_CART';
    END IF;

    -- Ambil cart milik user (pola sama dengan cart.service.getOrCreateCart).
    SELECT id INTO v_cart_id
    FROM carts
    WHERE user_id = p_user_id
    ORDER BY id ASC
    LIMIT 1;

    IF v_cart_id IS NULL THEN
        RAISE EXCEPTION 'EMPTY_CART';
    END IF;

    -- Iterasi tiap produk: row-lock, validasi keberadaan + stok, hitung total,
    -- dan decrement stok atomik — SEMUA dalam satu transaksi implisit.
    FOREACH v_product_id IN ARRAY p_product_ids
    LOOP
        SELECT price, stock INTO v_price, v_stock
        FROM products
        WHERE id = v_product_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
        END IF;

        -- Quantity yang dibeli = quantity di cart user (BUKAN kalkulasi client).
        SELECT quantity INTO v_quantity
        FROM cart_items
        WHERE cart_id = v_cart_id AND product_id = v_product_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
        END IF;

        IF v_stock < v_quantity THEN
            RAISE EXCEPTION 'OUT_OF_STOCK';
        END IF;

        v_total := v_total + (v_price * v_quantity);

        UPDATE products
        SET stock = stock - v_quantity
        WHERE id = v_product_id;
    END LOOP;

    INSERT INTO orders (
        user_id, total_amount, status,
        shipping_name, shipping_phone, shipping_address, shipping_city,
        shipping_province, shipping_postal_code, shipping_note, payment_method
    )
    VALUES (
        p_user_id, v_total, 'PAID',
        p_shipping_name, p_shipping_phone, p_shipping_address, p_shipping_city,
        p_shipping_province, p_shipping_postal_code, p_shipping_note, p_payment_method
    )
    RETURNING id INTO v_order_id;

    -- Order items: price_at_purchase = harga REGULER produk saat transaksi
    -- (bukan flash price). JOIN cart_items agar quantity konsisten dengan yang
    -- divalidasi di loop pertama (baris produk masih di-lock sampai COMMIT).
    INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
    SELECT v_order_id, ci.product_id, ci.quantity, p.price
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.cart_id = v_cart_id AND ci.product_id = ANY(p_product_ids);

    -- Hapus HANYA item yang dibeli dari cart user.
    DELETE FROM cart_items
    WHERE cart_id = v_cart_id AND product_id = ANY(p_product_ids);

    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;
