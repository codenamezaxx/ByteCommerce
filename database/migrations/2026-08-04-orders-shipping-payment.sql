-- =============================================================================
-- ByteCommerce - Migration: 2026-08-04-orders-shipping-payment
-- PostgreSQL 16 | Tanggal: 2026-08-04
--
-- Isi migrasi:
--   1. Kolom alamat pengiriman (shipping_*) + metode pembayaran (payment_method)
--      pada tabel orders.
--   2. Versi BARU stored procedure buy_flash_sale_item dengan parameter tambahan
--      shipping & payment method. Validasi stok / row-lock / zero-oversell TIDAK
--      berubah — hanya perluasan kolom INSERT orders.
--
-- CARA EKSEKUSI (manual, sekali jalan):
--   docker exec -i bytecommerce_postgres psql -U bytecommerce -d bytecommerce \
--     < database/migrations/2026-08-04-orders-shipping-payment.sql
-- =============================================================================
BEGIN;

-- =============================================================================
-- 1. Kolom baru pada tabel orders
--    payment_method NOT NULL DEFAULT 'BANK_TRANSFER' — order lama otomatis
--    mendapat nilai default; kolom shipping tetap NULL (order lama tanpa data).
-- =============================================================================
ALTER TABLE orders
    ADD COLUMN shipping_name VARCHAR(100),
    ADD COLUMN shipping_phone VARCHAR(20),
    ADD COLUMN shipping_address TEXT,
    ADD COLUMN shipping_city VARCHAR(100),
    ADD COLUMN shipping_province VARCHAR(100),
    ADD COLUMN shipping_postal_code VARCHAR(20),
    ADD COLUMN shipping_note TEXT,
    ADD COLUMN payment_method VARCHAR(30) NOT NULL DEFAULT 'BANK_TRANSFER'
        CHECK (payment_method IN ('BANK_TRANSFER', 'COD', 'QRIS'));

-- =============================================================================
-- 2. Versi BARU stored procedure buy_flash_sale_item
--    Perubahan inti vs versi lama: signature diperluas dengan 8 parameter
--    shipping + payment method; INSERT orders kini mengisi kolom-kolom baru.
--    Semua mekanisme zero-oversell (SELECT ... FOR UPDATE, validasi stok flash,
--    decrement flash_sale_stock atomik) DIKEPERTAHANKAN apa adanya.
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

COMMIT;
