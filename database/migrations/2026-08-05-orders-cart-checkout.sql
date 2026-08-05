-- =============================================================================
-- ByteCommerce - Migration: 2026-08-05-orders-cart-checkout
-- PostgreSQL 16 | Tanggal: 2026-08-05
--
-- Isi migrasi:
--   1. Stored procedure BARU create_cart_order untuk checkout keranjang REGULER
--      (non-flash-sale). Atomik & anti-race-condition (zero-oversell):
--      * Row-Level Locking (SELECT ... FOR UPDATE) pada baris produk.
--      * Validasi keberadaan produk (PRODUCT_NOT_FOUND) & stok (OUT_OF_STOCK).
--      * Guard cart kosong (EMPTY_CART).
--      * Total dihitung SERVER-SIDE (SUM price * qty dari cart) — bukan client.
--      * Decrement stok atomik `stock = stock - qty` di database.
--      * Order header + order_items (price_at_purchase = harga REGULER) +
--        penghapusan item cart dalam SATU transaksi implisit.
--
-- CARA EKSEKUSI (manual, sekali jalan):
--   docker exec -i bytecommerce_postgres psql -U dev_user -d bytecommerce_db \
--     < database/migrations/2026-08-05-orders-cart-checkout.sql
-- =============================================================================
BEGIN;

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

COMMIT;
