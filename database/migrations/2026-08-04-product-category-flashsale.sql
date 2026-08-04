-- =============================================================================
-- ByteCommerce - Migration: 2026-08-04-product-category-flashsale
-- PostgreSQL 16 | Tanggal: 2026-08-04
--
-- Isi migrasi:
--   1. Kolom kategori produk (untuk filter list produk).
--   2. Kolom kuota flash sale terpisah (flash_sale_stock) + jendela waktu
--      (flash_sale_start / flash_sale_end) — stok flash sale TIDAK lagi
--      menyentuh kolom stock (alokasi khusus flash).
--   3. Backfill kategori untuk 13 produk seed.
--   4. Backfill flash_sale_stock = stock untuk item flash sale yang sudah ada.
--   5. Versi BARU stored procedure buy_flash_sale_item yang memakai
--      flash_sale_stock (bukan stock).
--
-- CARA EKSEKUSI (manual, sekali jalan):
--   psql "$DATABASE_URL" -f database/migrations/2026-08-04-product-category-flashsale.sql
-- atau jalankan isi file ini di dalam satu transaksi psql.
-- =============================================================================
BEGIN;

-- =============================================================================
-- 1. Kolom baru pada tabel products
-- =============================================================================
ALTER TABLE products ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT 'Lainnya';
ALTER TABLE products ADD COLUMN flash_sale_stock INT;
ALTER TABLE products ADD COLUMN flash_sale_start TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN flash_sale_end TIMESTAMPTZ;

CREATE INDEX idx_products_category ON products(category);

-- =============================================================================
-- 2. Backfill kategori (13 produk live sesuai seeds.sql)
-- =============================================================================
UPDATE products SET category='Elektronik'
WHERE name IN ('Smartwatch X100','Wireless Earbuds Pro','Smart TV LED 32 Inch','Headphone ANC Silent','Kabel USB-C Braided','Power Bank 10000mAh');
UPDATE products SET category='Fashion'
WHERE name IN ('Sneaker Run Ultralight','Tas Ransel Urban 30L','Kemeja Oxford Premium');
UPDATE products SET category='Aksesoris'
WHERE name IN ('Jam Tangan Classic','Dompet Slim RFID','Tumbler Stainless 750ml');
UPDATE products SET category='Kesehatan'
WHERE name='Suplemen Vitamin C 1000mg';

-- =============================================================================
-- 3. Kuota flash sale nyata untuk item flash yang sudah ada
--    (stok flash = stok asli saat ini; kolom stock TIDAK disentuh).
-- =============================================================================
UPDATE products SET flash_sale_stock = stock WHERE is_flash_sale = TRUE;

-- =============================================================================
-- 4. Versi BARU stored procedure buy_flash_sale_item
--    Perubahan inti vs versi lama: pemotongan stok dilakukan pada
--    flash_sale_stock (alokasi khusus flash sale), bukan stock.
--    Zero-oversell tetap terjamin: SELECT ... FOR UPDATE + validasi stok flash
--    + decrement atomik di database.
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

COMMIT;
