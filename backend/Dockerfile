# =============================================================
# ByteCommerce Backend — Production Image (P10.1, multi-stage)
#
# Stage 1 (builder)  : install dependensi dari lockfile
# Stage 2 (runtime)  : image ramping, hanya artifact produksi,
#                      berjalan sebagai user non-root.
# =============================================================

# ---------- Stage 1: Builder ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install semua dependensi dari package-lock.json (reproducible build),
# lalu buang devDependencies (jest, nodemon, supertest) dari node_modules.
COPY package*.json ./
RUN npm ci && npm prune --omit=dev

# ---------- Stage 2: Production Runtime ----------
FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

# Jalankan sebagai user non-root (best practice keamanan container)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Salin hanya artifact produksi dari builder (devDeps tidak ikut)
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --chown=appuser:appgroup . .

# Direktori upload gambar produk harus writable oleh appuser
# (compose memount named volume uploads_data di path ini)
RUN mkdir -p /app/uploads && chown appuser:appgroup /app/uploads

USER appuser

EXPOSE 5000

CMD ["node", "server.js"]
