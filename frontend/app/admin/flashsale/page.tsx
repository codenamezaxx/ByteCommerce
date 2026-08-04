'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { adminApi, flashsaleApi, productsApi } from '@/lib/api';
import { formatRupiah } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { PageSpinner } from '@/components/Spinner';

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
  const pathname = usePathname();

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
      setFlashProducts([]);
    } catch (err: any) {
      setKillError(err?.message || 'Gagal mengaktifkan kill-switch');
    }
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

  if (authLoading || loading) return <PageSpinner />;
  if (!user || user.role !== 'admin') return null;

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link href="/" className="navbar-brand" style={{display:'flex', alignItems:'center'}}>
            Byte<span style={{color:'var(--accent)'}}>Commerce</span>
            <span className="admin-suffix">Admin</span>
          </Link>
        </div>
        <nav>
          <ul className="sidebar-nav">
            <li><Link href="/admin" className="sidebar-link">Dashboard</Link></li>
            <li><Link href="/admin/products" className="sidebar-link">Produk</Link></li>
            <li><Link href="/admin/flashsale" className={`sidebar-link ${pathname === '/admin/flashsale' ? 'active' : ''}`}>Flash Sale</Link></li>
          </ul>
        </nav>
        <div className="sidebar-divider"></div>
        <div style={{padding:'0 0.75rem'}}>
          <button className="btn btn-danger btn-block" onClick={() => { setKillModalOpen(true); setKillConfirmStep(0); setKillConfirmText(''); setKillError(''); }}>Emergency Stop</button>
        </div>
        <div className="sidebar-footer"></div>
      </aside>

      <main className="admin-main">
        <section className="section-header" style={{marginBottom:'2rem'}}>
          <div>
            <h1 style={{marginBottom:'0.25rem'}}>Flash Sale Control</h1>
            <p className="text-muted">Kelola flash sale, tambah produk, dan cache warming</p>
          </div>
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
            <span className="badge badge-success">Aktif</span>
          </div>
          <p className="text-muted" style={{fontSize:'0.9rem', marginBottom:'0.5rem'}}>
            Auto-warming setiap 5 menit
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
      </main>
    </div>
  );
}
