-- =============================================================================
-- ByteCommerce - Migration: 2026-08-04-product-images
-- PostgreSQL 16 | Tanggal: 2026-08-04
--
-- Isi migrasi:
--   1. Kolom baru `image_url TEXT` pada tabel products — menyimpan KEY file
--      gambar (nama file unik di uploads/products), bukan URL absolut. Path
--      publik dihasilkan oleh storage.service.getPublicPath().
--
-- CARA EKSEKUSI (manual, sekali jalan):
--   docker exec -i bytecommerce_postgres psql -U dev_user -d bytecommerce_db \
--     < database/migrations/2026-08-04-product-images.sql
-- =============================================================================
BEGIN;

ALTER TABLE products ADD COLUMN image_url TEXT;

COMMIT;
