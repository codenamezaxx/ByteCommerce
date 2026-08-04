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
--   * Pembuatan order header + order items dalam satu transaksi implisit.
-- Return: id order yang baru dibuat.
-- =============================================================================
CREATE OR REPLACE FUNCTION buy_flash_sale_item(
    p_user_id INT,
    p_product_id INT,
    p_quantity INT
) RETURNS INT AS $$
DECLARE
    v_stock INT;
    v_flash_stock INT;
    v_price DECIMAL(12, 2);
    v_flash_price DECIMAL(12, 2);
    v_is_flash BOOLEAN;
    v_order_id INT;
BEGIN
    SELECT stock, flash_sale_stock, price, flash_sale_price, is_flash_sale
    INTO v_stock, v_flash_stock, v_price, v_flash_price, v_is_flash
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

    -- Stok flash sale habis / belum dialokasikan → OUT_OF_STOCK.
    -- (p_quantity >= 1 selalu terjamin oleh validasi controller.)
    IF v_flash_stock IS NULL OR v_flash_stock < p_quantity THEN
        RAISE EXCEPTION 'OUT_OF_STOCK';
    END IF;

    UPDATE products
    SET flash_sale_stock = flash_sale_stock - p_quantity
    WHERE id = p_product_id;

    INSERT INTO orders (user_id, total_amount, status)
    VALUES (p_user_id, v_flash_price * p_quantity, 'PAID')
    RETURNING id INTO v_order_id;

    INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
    VALUES (v_order_id, p_product_id, p_quantity, v_flash_price);

    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;
