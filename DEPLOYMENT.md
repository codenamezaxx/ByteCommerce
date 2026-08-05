# ByteCommerce — Deployment Guide (P10.3)

Panduan deployment production untuk ByteCommerce: backend (Express) + PostgreSQL 16 + Redis 7 + frontend (Next.js).

## Arsitektur Production

```
Browser ──► Vercel (frontend Next.js)
                │
                └── NEXT_PUBLIC_API_URL ──► Render / VPS (backend Express :5000)
                                              ├── PostgreSQL 16 (managed / containerized)
                                              └── Redis 7 (managed / containerized)
```

---

## Opsi A — Render Blueprint (disarankan)

Repositori sudah berisi `render.yaml` blueprint (backend web service + Redis managed + PostgreSQL managed).

1. Push repo ke GitHub.
2. Di dashboard Render: **New > Blueprint**, pilih repo.
3. Render membaca `render.yaml` dan membuat:
   - Web service `bytecommerce-backend` (image Docker multi-stage dari `backend/Dockerfile`)
   - Redis `bytecommerce-redis`
   - PostgreSQL `bytecommerce-db` (schema auto-init lewat `database/init.sql` volume mount di compose, atau restore manual)
4. `JWT_SECRET` digenerate otomatis (field `generateValue`). Bisa diganti di **Environment** tab.
5. **CI/CD**: GitHub Actions sudah dikonfigurasi di `.github/workflows/deploy.yml`. Set secret `RENDER_DEPLOY_HOOK_URL` (Dashboard > Service > Deploy > Deploy Hook) — setiap push ke `main` otomatis trigger deploy.

> Catatan biaya: PostgreSQL & Redis managed Render adalah add-on berbayar (mulai ~$7–15/bln). Untuk start gratis, lihat Opsi B di VPS.

## Opsi B — Self-Managed VPS (Docker Compose)

1. Clone repo di VPS dengan Docker + Compose plugin.
2. `cp .env.production.example .env` lalu isi semua nilai placeholder (`POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET` via `openssl rand -hex 64`).
3. Jalankan:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
4. Verifikasi: `curl http://localhost:5000/health` → `{"status":"ok",...}`.
5. Database & Redis **tidak diekspos ke publik** (hanya internal network `prod_net`).

---

## Domain & SSL

### Backend (Render)
- Subdomain bawaan `*.onrender.com` sudah dapat SSL otomatis (cert Let's Encrypt auto-renew).
- Custom domain: **Settings > Custom Domain**, tambah `api.bytecommerce.com`, lalu buat DNS record di registrar:
  - **CNAME** `api` → `<service-name>.onrender.com`
  - SSL cert diterbitkan otomatis setelah DNS propagasi (biasanya < 1 jam).

### Backend (VPS + Nginx/Caddy)
- Pasang Nginx sebagai reverse proxy ke `127.0.0.1:5000`.
- `certbot --nginx -d api.bytecommerce.com` untuk SSL Let's Encrypt.
- Wajib tutup port `5000` dari firewall; hanya 80/443 terbuka.

### Frontend (Vercel)
1. Import repo di Vercel (framework preset: Next.js, build `next build`).
2. Project Settings > Environment Variables:
   - `NEXT_PUBLIC_API_URL=https://api.bytecommerce.com`
3. Deploy. Vercel memberi domain `*.vercel.app` + SSL otomatis.
4. Custom domain: **Domains** tab, tambah `bytecommerce.com` → ikuti instruksi DNS (A record `76.76.21.21` untuk apex, CNAME `www` → `cname.vercel-dns.com`).

---

## Checklist Go-Live

- [ ] `JWT_SECRET` diganti nilai acak (`openssl rand -hex 64`) — jangan pakai nilai dev
- [ ] Password PostgreSQL & Redis kuat (bukan `dev_password`)
- [ ] `NODE_ENV=production` (sudah default di image & compose prod)
- [ ] Volume `uploads_data` persisted (gambar produk tidak hilang saat redeploy)
- [ ] Secret GitHub `RENDER_DEPLOY_HOOK_URL` terpasang (jika pakai Render)
- [ ] `NEXT_PUBLIC_API_URL` mengarah ke domain API production (bukan localhost)
- [ ] `database/init.sql` & `seeds.sql` sudah dieksekusi di database production
- [ ] Test E2E singkat: register → login → lihat katalog → checkout → flash sale
