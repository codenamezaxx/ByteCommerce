'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, flashsaleApi, productsApi } from '@/lib/api';
import { formatRupiah } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import PhantomSkeleton from '@/components/PhantomSkeleton';
import CountdownTimer from '@/components/CountdownTimer';
import { Zap } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function discountPercent(original: number, discounted: number): number {
  if (!original || original <= 0 || !discounted || discounted >= original) return 0;
  return Math.round((1 - discounted / original) * 100);
}

interface AllProduct {
  id: number;
  name: string;
  price: number;
  stock: number;
  category?: string;
  is_flash_sale?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function AdminFlashSalePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  /* ---- data ---- */
  const [flashProducts, setFlashProducts] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<AllProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [warmingUp, setWarmingUp] = useState(false);
  const [warmingMsg, setWarmingMsg] = useState('');

  /* ---- kill-switch modal ---- */
  const [killModalOpen, setKillModalOpen] = useState(false);
  const [killConfirmStep, setKillConfirmStep] = useState(0);
  const [killActivated, setKillActivated] = useState(false);
  const [killConfirmText, setKillConfirmText] = useState('');
  const [killError, setKillError] = useState('');
  const [pageError, setPageError] = useState('');

  /* ---- add form ---- */
  const [formProductId, setFormProductId] = useState<number | ''>('');
  const [formPrice, setFormPrice] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  /* ---- start session (duration) ---- */
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [startLoading, setStartLoading] = useState(false);
  const [startMsg, setStartMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  /* ================================================================
     Auth guard + data loading
     ================================================================ */
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) router.push('/');
  }, [user, authLoading, router]);

  const loadFlashProducts = async () => {
    try {
      const res: any = await flashsaleApi.active();
      setFlashProducts(Array.isArray(res?.data?.products) ? res.data.products : Array.isArray(res?.data) ? res.data : []);
    } catch { /* ignore */ }
  };

  const loadAllProducts = async () => {
    try {
      const res: any = await productsApi.list({ limit: 100 });
      const data = res?.data || res;
      setAllProducts(data?.products || data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    (async () => {
      await Promise.all([loadFlashProducts(), loadAllProducts()]);
      setLoading(false);
    })();
  }, []);

  /* ---- Products available for flash sale (exclude already active) ---- */
  const availableProducts = useMemo(() => {
    const flashIds = new Set(flashProducts.map((p: any) => p.id));
    return allProducts.filter(p => !p.is_flash_sale && !flashIds.has(p.id));
  }, [allProducts, flashProducts]);

  /* ---- Selected product details for live preview ---- */
  const selectedProduct = useMemo(() => {
    if (formProductId === '') return null;
    return allProducts.find(p => p.id === formProductId) || null;
  }, [allProducts, formProductId]);

  /* ---- Live preview ---- */
  const previewFlashPrice = Number(formPrice) || 0;
  const previewOriginalPrice = selectedProduct?.price || 0;
  const previewPctOff = previewOriginalPrice > 0 && previewFlashPrice > 0 && previewFlashPrice < previewOriginalPrice
    ? discountPercent(previewOriginalPrice, previewFlashPrice)
    : 0;
  const previewInvalid = previewFlashPrice > 0 && previewOriginalPrice > 0 && previewFlashPrice >= previewOriginalPrice;

  /* ---- Session window (min start & min end across active items) ---- */
  const sessionInfo = useMemo(() => {
    if (flashProducts.length === 0) return null;
    const toDate = (v: any) => { const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
    const starts = flashProducts.map((p: any) => toDate(p.flash_sale_start)).filter((d: Date | null): d is Date => d !== null);
    const ends = flashProducts.map((p: any) => toDate(p.flash_sale_end)).filter((d: Date | null): d is Date => d !== null);
    if (starts.length === 0 && ends.length === 0) return null;
    return {
      startTime: starts.length > 0 ? new Date(Math.min(...starts.map(d => d.getTime()))) : null,
      endTime: ends.length > 0 ? new Date(Math.min(...ends.map(d => d.getTime()))) : null,
    };
  }, [flashProducts]);

  /* ================================================================
     Handlers
     ================================================================ */
  const handleWarmup = async () => {
    setWarmingUp(true);
    setWarmingMsg('');
    try {
      const res: any = await adminApi.flashsaleWarmup();
      setWarmingMsg(res?.message || res?.data?.message || 'Cache warming berhasil');
    } catch (err: any) {
      setWarmingMsg(err?.message || 'Gagal melakukan cache warming');
    }
    setWarmingUp(false);
  };

  const handleKillswitch = async () => {
    try {
      await adminApi.flashsaleKillswitch();
      setKillActivated(true);
      setKillModalOpen(false);
      setKillConfirmStep(0);
      // DB sudah final (semua item dikeluarkan) — muat ulang agar tabel monitor
      // kosong dan semua produk kembali tersedia untuk ditambahkan.
      await Promise.all([loadFlashProducts(), loadAllProducts()]);
    } catch (err: any) {
      setKillError(err?.message || 'Gagal mengaktifkan kill-switch');
    }
  };

  const handleStartFlashSale = async () => {
    setStartLoading(true);
    setStartMsg(null);
    try {
      await adminApi.flashsaleStart(Number(durationMinutes));
      setStartMsg({ type: 'success', text: 'Flash sale dimulai! Durasi & countdown aktif di beranda.' });
      await loadFlashProducts();
    } catch (err: any) {
      setStartMsg({ type: 'error', text: err?.message || 'Gagal memulai flash sale.' });
    }
    setStartLoading(false);
  };

  const handleAddFlashSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (formProductId === '' || !previewFlashPrice || !formStock) {
      setFormError('Semua field wajib diisi.');
      return;
    }
    if (previewInvalid) {
      setFormError('Harga flash harus di bawah harga asli.');
      return;
    }
    if (Number(formStock) < 0) {
      setFormError('Stok flash sale tidak boleh negatif.');
      return;
    }

    setFormSubmitting(true);
    try {
      await flashsaleApi.setItem(Number(formProductId), previewFlashPrice, Number(formStock));
      setFormSuccess('Produk berhasil ditambahkan ke flash sale!');
      setFormProductId('');
      setFormPrice('');
      setFormStock('');
      await Promise.all([loadFlashProducts(), loadAllProducts()]);
    } catch (err: any) {
      setFormError(err?.message || 'Gagal menambahkan produk ke flash sale.');
    }
    setFormSubmitting(false);
  };

  const handleRemoveFlashSale = async (productId: number, productName: string) => {
    if (!window.confirm(`Hapus "${productName}" dari flash sale?`)) return;
    setPageError('');
    try {
      await flashsaleApi.removeItem(productId);
      await Promise.all([loadFlashProducts(), loadAllProducts()]);
    } catch (err: any) {
      setPageError(err?.message || 'Gagal menghapus produk dari flash sale.');
    }
  };

  if (authLoading || loading) {
    return (
      <PhantomSkeleton loading animation="shimmer" reveal={0.3} stagger={0.03} loading-label="Memuat flashsale">
        <div aria-hidden="true">
          <section className="section-header" style={{ marginBottom: '2rem' }}>
            <div>
              <div className="ph-skeleton-block" style={{ height: '1.75rem', width: '16rem', marginBottom: '0.5rem' }} />
              <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '20rem' }} />
            </div>
            <div className="ph-skeleton-block" style={{ height: '2.4rem', width: '11rem', borderRadius: 'var(--radius-md)' }} />
          </section>

          {/* Sesi: Atur Durasi & Mulai */}
          <section className="card" style={{ marginBottom: '2rem' }}>
            <div className="section-header" style={{ marginBottom: '1rem', alignItems: 'flex-start' }}>
              <div>
                <div className="ph-skeleton-block" style={{ height: '0.8rem', width: '8rem', marginBottom: '0.5rem' }} />
                <div className="ph-skeleton-block" style={{ height: '1.3rem', width: '13rem', marginBottom: '0.5rem' }} />
                <div className="ph-skeleton-block" style={{ height: '0.85rem', width: '22rem' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <div>
                <div className="ph-skeleton-block" style={{ height: '0.8rem', width: '7rem', marginBottom: '0.4rem' }} />
                <div className="ph-skeleton-block" style={{ height: '2.4rem', width: '140px', borderRadius: 'var(--radius-sm)' }} />
              </div>
              <div className="ph-skeleton-block" style={{ height: '2.4rem', width: '10rem', borderRadius: 'var(--radius-md)' }} />
            </div>
          </section>

          {/* Form: Tambah Produk Flash Sale */}
          <section className="card" style={{ marginBottom: '2rem' }}>
            <div className="ph-skeleton-block" style={{ height: '0.8rem', width: '9rem', marginBottom: '0.5rem' }} />
            <div className="ph-skeleton-block" style={{ height: '1.3rem', width: '16rem', marginBottom: '1rem' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              {[0, 1, 2].map(i => (
                <div key={i}>
                  <div className="ph-skeleton-block" style={{ height: '0.8rem', width: '6rem', marginBottom: '0.4rem' }} />
                  <div className="ph-skeleton-block" style={{ height: '2.4rem', width: '100%', borderRadius: 'var(--radius-sm)' }} />
                </div>
              ))}
            </div>
            <div className="ph-skeleton-block" style={{ height: '2.4rem', width: '12rem', borderRadius: 'var(--radius-md)' }} />
          </section>

          {/* Flash Sale Monitor Table */}
          <section className="card" style={{ marginBottom: '2rem' }}>
            <div className="ph-skeleton-block" style={{ height: '0.8rem', width: '8rem', marginBottom: '0.75rem' }} />
            <div className="ph-skeleton-block" style={{ height: '1.3rem', width: '11rem', marginBottom: '1rem' }} />
            <div className="table-wrap">
              <table style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '26%' }}><div className="ph-skeleton-block" style={{ height: '0.8rem', width: '60%' }} /></th>
                    <th style={{ width: '12%' }}><div className="ph-skeleton-block" style={{ height: '0.8rem', width: '60%' }} /></th>
                    <th style={{ width: '13%' }}><div className="ph-skeleton-block" style={{ height: '0.8rem', width: '60%' }} /></th>
                    <th style={{ width: '13%' }}><div className="ph-skeleton-block" style={{ height: '0.8rem', width: '60%' }} /></th>
                    <th style={{ width: '8%' }}><div className="ph-skeleton-block" style={{ height: '0.8rem', width: '60%' }} /></th>
                    <th style={{ width: '8%' }}><div className="ph-skeleton-block" style={{ height: '0.8rem', width: '60%' }} /></th>
                    <th style={{ width: '8%' }}><div className="ph-skeleton-block" style={{ height: '0.8rem', width: '60%' }} /></th>
                    <th><div className="ph-skeleton-block" style={{ height: '0.8rem', width: '50%' }} /></th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2].map(i => (
                    <tr key={i}>
                      <td><div className="ph-skeleton-block" style={{ height: '0.95rem', width: '75%' }} /></td>
                      <td><div className="ph-skeleton-block" style={{ height: '0.85rem', width: '65%' }} /></td>
                      <td><div className="ph-skeleton-block" style={{ height: '0.95rem', width: '60%' }} /></td>
                      <td><div className="ph-skeleton-block" style={{ height: '0.95rem', width: '60%' }} /></td>
                      <td><div className="ph-skeleton-block" style={{ height: '0.85rem', width: '50%' }} /></td>
                      <td><div className="ph-skeleton-block" style={{ height: '0.95rem', width: '40%' }} /></td>
                      <td><div className="ph-skeleton-block" style={{ height: '0.85rem', width: '55%' }} /></td>
                      <td><div className="ph-skeleton-block" style={{ height: '0.95rem', width: '70%' }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Cache Warming */}
          <section className="card">
            <div className="section-header" style={{ marginBottom: '0.75rem' }}>
              <div className="ph-skeleton-block" style={{ height: '1.2rem', width: '12rem' }} />
              <div className="ph-skeleton-block" style={{ height: '1.2rem', width: '5.5rem', borderRadius: '999px' }} />
            </div>
            <div className="ph-skeleton-block" style={{ height: '0.85rem', width: '80%', marginBottom: '1rem' }} />
            <div className="ph-skeleton-block" style={{ height: '2.4rem', width: '11rem', borderRadius: 'var(--radius-md)' }} />
          </section>
        </div>
      </PhantomSkeleton>
    );
  }
  if (!user || user.role !== 'admin') return null;

  return (
    <>
      <section className="section-header" style={{marginBottom:'2rem'}}>
        <div>
          <h1 style={{marginBottom:'0.25rem'}}>Flash Sale Control</h1>
          <p className="text-muted">Kelola flash sale, tambah produk, dan cache warming</p>
        </div>
        <button
          className="btn btn-danger"
          onClick={() => { setKillModalOpen(true); setKillConfirmStep(0); setKillConfirmText(''); setKillError(''); }}
        >
          <Zap size={16} />
          Emergency Stop
        </button>
      </section>

      {/* ============================================================
          SESI: ATUR DURASI & MULAI FLASH SALE
          ============================================================ */}
      <section className="card" style={{ marginBottom: '2rem' }}>
        <div className="section-header" style={{ marginBottom: '1rem', alignItems: 'flex-start' }}>
          <div>
            <p className="eyebrow" style={{ color: 'var(--accent)' }}>Sesi Flash Sale</p>
            <h3 style={{ marginBottom: '0.25rem' }}>Atur Durasi & Mulai</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>
              Setelah dimulai, countdown durasi otomatis tampil di banner beranda.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div>
            <label className="form-label">Durasi (menit)</label>
            <input
              type="number"
              className="form-input"
              min={1}
              max={1440}
              step={1}
              value={durationMinutes}
              onChange={e => setDurationMinutes(Number(e.target.value))}
              style={{ width: '140px' }}
            />
          </div>
          <button
            type="button"
            className={`btn btn-primary ${startLoading ? 'loading' : ''}`}
            onClick={handleStartFlashSale}
            disabled={startLoading || flashProducts.length === 0}
          >
            <span className="spinner"></span>
            <span className="btn-text">Mulai Sekarang</span>
          </button>
          {flashProducts.length === 0 && (
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              Tambahkan minimal 1 produk terlebih dahulu.
            </p>
          )}
        </div>

        {sessionInfo && (() => {
          const now = Date.now();
          const start = sessionInfo.startTime;
          const end = sessionInfo.endTime;
          const upcoming = start !== null && start.getTime() > now;
          const active = !upcoming && end !== null && end.getTime() > now;
          return (
            <div style={{
              padding: '1rem', borderRadius: 'var(--radius-md)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              marginBottom: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                {upcoming ? (
                  <>
                    <span className="badge badge-warning">Menunggu Mulai</span>
                    <div style={{ textAlign: 'center' }}>
                      <span className="countdown-label">Mulai dalam:</span>
                      <CountdownTimer targetDate={start!} showLabels size="sm" />
                    </div>
                  </>
                ) : active ? (
                  <>
                    <span className="badge badge-success">Berjalan</span>
                    <div style={{ textAlign: 'center' }}>
                      <span className="countdown-label">Berakhir dalam:</span>
                      <CountdownTimer targetDate={end!} showLabels size="sm" />
                    </div>
                  </>
                ) : (
                  <span className="badge badge-danger">Berakhir</span>
                )}
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.7 }}>
                  <p>Mulai: {start ? start.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</p>
                  <p>Berakhir: {end ? end.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {startMsg && (
          <div className={`toast ${startMsg.type === 'success' ? 'toast-success' : 'toast-error'}`} style={{ marginBottom: '0.75rem' }}>
            {startMsg.text}
          </div>
        )}
      </section>

      {/* ============================================================
          FORM: Tambah Produk Flash Sale
          ============================================================ */}
      <section className="card" style={{marginBottom:'2rem'}}>
        <p className="eyebrow" style={{color:'var(--accent)'}}>Tambah Flash Sale</p>
        <h3 style={{marginBottom:'1rem'}}>Tambah Produk Flash Sale</h3>

        {availableProducts.length === 0 ? (
          <div className="empty-state" style={{padding:'1.5rem 1rem'}}>
            <p className="text-muted">Semua produk sudah menjadi flash sale.</p>
          </div>
        ) : (
          <form onSubmit={handleAddFlashSale}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'1rem', marginBottom:'1rem'}}>
              {/* Select product */}
              <div>
                <label className="form-label">
                  Produk
                </label>
                <select
                  className="form-input"
                  value={formProductId}
                  onChange={e => setFormProductId(e.target.value ? Number(e.target.value) : '')}
                  style={{width:'100%', cursor:'pointer'}}
                >
                  <option value="">-- Pilih Produk --</option>
                  {availableProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatRupiah(p.price)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Flash price */}
              <div>
                <label className="form-label">
                  Harga Flash Sale
                </label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  step={1}
                  placeholder="mis. 899000"
                  value={formPrice}
                  onChange={e => setFormPrice(e.target.value)}
                  style={{width:'100%'}}
                />
              </div>

              {/* Flash stock */}
              <div>
                <label className="form-label">
                  Stok Flash Sale
                </label>
                <input
                  type="number"
                  className="form-input"
                  min={0}
                  step={1}
                  placeholder="mis. 50"
                  value={formStock}
                  onChange={e => setFormStock(e.target.value)}
                  style={{width:'100%'}}
                />
              </div>
            </div>

            {/* Live preview */}
            {selectedProduct && (
              <div style={{
                padding: '1rem', borderRadius: 'var(--radius-md)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                marginBottom: '1rem',
              }}>
                <p style={{fontSize:'0.78rem', fontWeight:600, color:'var(--muted)', marginBottom:'0.5rem', textTransform:'uppercase', letterSpacing:'0.04em'}}>
                  Preview
                </p>
                <div style={{display:'flex', alignItems:'baseline', gap:'0.75rem', flexWrap:'wrap'}}>
                  {previewFlashPrice > 0 && (
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: 'var(--danger)',
                    }}>
                      {formatRupiah(previewFlashPrice)}
                    </span>
                  )}
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1rem',
                    color: 'var(--muted)',
                    textDecoration: 'line-through',
                  }}>
                    {formatRupiah(previewOriginalPrice)}
                  </span>
                  {previewPctOff > 0 && (
                    <span className="badge badge-danger" style={{fontSize:'0.8rem', padding:'0.2rem 0.6rem'}}>
                      -{previewPctOff}%
                    </span>
                  )}
                </div>
                {previewInvalid && (
                  <p style={{color:'var(--danger)', fontSize:'0.85rem', marginTop:'0.5rem', fontWeight:600}}>
                    Harga flash harus di bawah harga asli.
                  </p>
                )}
              </div>
            )}

            {/* Errors / success */}
            {formError && <div className="toast toast-error" style={{marginBottom:'0.75rem'}}>{formError}</div>}
            {formSuccess && <div className="toast toast-success" style={{marginBottom:'0.75rem'}}>{formSuccess}</div>}

            <button
              type="submit"
              className={`btn btn-primary ${formSubmitting ? 'loading' : ''}`}
              disabled={formSubmitting || previewInvalid || !formProductId || !formPrice || !formStock}
            >
              <span className="spinner"></span>
              <span className="btn-text">Tambah ke Flash Sale</span>
            </button>
          </form>
        )}
      </section>

      {/* ============================================================
          Flash Sale Monitor Table
          ============================================================ */}
      <section className="card" style={{marginBottom:'2rem'}}>
        <p className="eyebrow" style={{color:'var(--danger)'}}>Flash Sale Monitor</p>
        <div className="section-header" style={{marginBottom:'1rem'}}>
          <h2>Flash Sale Aktif</h2>
        </div>
        {pageError && <div className="toast toast-error" style={{marginBottom:'0.75rem'}}>{pageError}</div>}
        {flashProducts.length === 0 ? (
          <div className="empty-state" style={{padding:'2rem 1.25rem'}}>
            <h3>Tidak ada flash sale aktif</h3>
            <p>Tambahkan produk menggunakan form di atas atau lakukan cache warming.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Kategori</th>
                  <th>Harga Asli</th>
                  <th>Harga Flash</th>
                  <th>Diskon</th>
                  <th>Stok Flash</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {flashProducts.map((p: any) => {
                  const originalPrice = p.price;
                  const flashPrice = p.flash_sale_price || p.flash_price || p.price;
                  const flashStock = p.flash_sale_stock ?? p.flash_stock ?? p.stock;
                  const pctOff = discountPercent(originalPrice, flashPrice);
                  return (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td style={{textTransform:'capitalize'}}>{p.category || '-'}</td>
                      <td className="mono">{formatRupiah(originalPrice)}</td>
                      <td className="mono" style={{color:'var(--danger)'}}>{formatRupiah(flashPrice)}</td>
                      <td>
                        {pctOff > 0 ? (
                          <span className="badge badge-danger" style={{fontSize:'0.72rem'}}>
                            -{pctOff}%
                          </span>
                        ) : '-'}
                      </td>
                      <td className="mono">
                        {flashStock <= 0
                          ? <span style={{color:'var(--danger)', fontWeight:600}}>Habis</span>
                          : flashStock}
                      </td>
                      <td><span className="badge badge-success">Aktif</span></td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRemoveFlashSale(p.id, p.name)}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ============================================================
          Cache Warming
          ============================================================ */}
      <section className="card" style={{marginBottom:'2rem'}}>
        <div className="section-header" style={{marginBottom:'0.75rem'}}>
          <h3>Cache Warming Engine</h3>
          <span className="badge badge-success">On Demand</span>
        </div>
        <p className="text-muted" style={{fontSize:'0.9rem', marginBottom:'0.5rem'}}>
          Kuota Redis di-warmup otomatis saat flash sale dimulai. Tombol ini untuk menyinkronkan ulang secara manual.
        </p>
        {warmingMsg && <div className="toast toast-success mb-2">{warmingMsg}</div>}
        <button
          className={`btn btn-outline ${warmingUp ? 'loading' : ''}`}
          onClick={handleWarmup}
          disabled={warmingUp}
        >
          <span className="spinner"></span>
          <span className="btn-text">Warm Cache Sekarang</span>
        </button>
      </section>

      {/* ============================================================
          Kill-Switch Modal
          ============================================================ */}
      {killModalOpen && (
        <div className="modal-overlay open">
          <div className="modal-content">
            <div className="modal-header">
              <h4 style={{margin:0}}>
                {killConfirmStep === 0 ? 'Konfirmasi Emergency Stop' : 'Konfirmasi Akhir'}
              </h4>
              <button className="modal-close" onClick={() => { setKillModalOpen(false); setKillConfirmStep(0); setKillConfirmText(''); setKillError(''); }}>x</button>
            </div>
            <div className="modal-body">
              {killConfirmStep === 0 ? (
                <>
                  <p style={{fontSize:'0.9rem', lineHeight:1.6, marginBottom:'1rem'}}>
                    Yakin ingin menghentikan semua Flash Sale? Tindakan ini akan membatalkan semua sesi flash sale yang sedang berlangsung.
                  </p>
                  <span className="badge badge-warning" style={{fontSize:'0.8rem', padding:'0.35rem 0.75rem'}}>
                    Tindakan ini tidak dapat dibatalkan
                  </span>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ketik KILL untuk lanjut"
                    value={killConfirmText}
                    onChange={e => setKillConfirmText(e.target.value)}
                    style={{marginTop:'1rem', width:'100%'}}
                    autoFocus
                  />
                </>
              ) : (
                <p style={{fontSize:'0.9rem', lineHeight:1.6}}>
                  Ketik <strong>KILL</strong> untuk mengonfirmasi bahwa kamu ingin menghentikan SEMUA flash sale secara permanen.
                </p>
              )}
              {killError && (
                <p className="toast toast-error" style={{marginBottom:'0.75rem', marginTop:'1rem'}}>{killError}</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setKillModalOpen(false); setKillConfirmStep(0); setKillConfirmText(''); setKillError(''); }}>Batal</button>
              {killConfirmStep === 0 ? (
                <button className="btn btn-danger" onClick={() => setKillConfirmStep(1)}>Lanjutkan</button>
              ) : (
                <button className="btn btn-danger" disabled={killConfirmText !== 'KILL'} onClick={handleKillswitch}>Kill Switch</button>
              )}
            </div>
          </div>
        </div>
      )}

      {killActivated && (
        <section className="card" style={{borderColor:'var(--danger)', borderWidth:'2px', marginTop:'2rem'}}>
          <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem'}}>
            <span className="badge badge-danger" style={{fontSize:'0.85rem', padding:'0.4rem 0.85rem'}}>
              KILL-SWITCH ACTIVATED
            </span>
          </div>
          <p style={{fontSize:'0.9rem'}}>
            Semua sesi flash sale telah dihentikan.
          </p>
        </section>
      )}
    </>
  );
}
