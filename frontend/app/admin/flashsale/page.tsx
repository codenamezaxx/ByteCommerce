'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { adminApi, flashsaleApi } from '@/lib/api';
import { formatRupiah } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { PageSpinner } from '@/components/Spinner';

export default function AdminFlashSalePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [flashProducts, setFlashProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [warmingUp, setWarmingUp] = useState(false);
  const [killModalOpen, setKillModalOpen] = useState(false);
  const [killConfirmStep, setKillConfirmStep] = useState(0);
  const [killActivated, setKillActivated] = useState(false);
  const [warmingMsg, setWarmingMsg] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) router.push('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await flashsaleApi.active();
        // Backend: { success, message, data: { products: [...] } }
        setFlashProducts(Array.isArray(res?.data) ? res.data : res?.data?.products || []);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

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
      alert(err?.message || 'Gagal mengaktifkan kill-switch');
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
          <button className="btn btn-danger btn-block" onClick={() => { setKillModalOpen(true); setKillConfirmStep(0); }}>Emergency Stop</button>
        </div>
        <div className="sidebar-footer"></div>
      </aside>

      <main className="admin-main">
        <section className="section-header" style={{marginBottom:'2rem'}}>
          <div>
            <h1 style={{marginBottom:'0.25rem'}}>Flash Sale Control</h1>
            <p className="text-muted">Kelola flash sale dan cache warming</p>
          </div>
        </section>

        {/* Flash Sale Monitor */}
        <section className="card" style={{marginBottom:'2rem'}}>
          <p className="eyebrow" style={{color:'var(--danger)'}}>Flash Sale Monitor</p>
          <div className="section-header" style={{marginBottom:'1rem'}}>
            <h2>Flash Sale Aktif</h2>
          </div>
          {flashProducts.length === 0 ? (
            <div className="empty-state" style={{padding:'2rem 1.25rem'}}>
              <h3>Tidak ada flash sale aktif</h3>
              <p>Mulai flash sale baru atau lakukan cache warming.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Produk</th><th>Harga Flash</th><th>Stok</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {flashProducts.map((p: any) => (
                    <tr key={p.id}>
                      <td><strong>{p.name}</strong></td>
                      <td className="mono">{formatRupiah(p.flash_price || p.flash_sale_price || p.price)}</td>
                      <td className="mono">{p.flash_sale_stock ?? p.flash_stock ?? p.stock}</td>
                      <td><span className="badge badge-success">Aktif</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Cache Warming */}
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

        {/* Kill-Switch Modal */}
        {killModalOpen && (
          <div className="modal-overlay open">
            <div className="modal-content">
              <div className="modal-header">
                <h4 style={{margin:0}}>
                  {killConfirmStep === 0 ? 'Konfirmasi Emergency Stop' : 'Konfirmasi Akhir'}
                </h4>
                <button className="modal-close" onClick={() => { setKillModalOpen(false); setKillConfirmStep(0); }}>x</button>
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
                  </>
                ) : (
                  <p style={{fontSize:'0.9rem', lineHeight:1.6}}>
                    Ketik <strong>KILL</strong> untuk mengonfirmasi bahwa kamu ingin menghentikan SEMUA flash sale secara permanen.
                  </p>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => { setKillModalOpen(false); setKillConfirmStep(0); }}>Batal</button>
                {killConfirmStep === 0 ? (
                  <button className="btn btn-danger" onClick={() => setKillConfirmStep(1)}>Lanjutkan</button>
                ) : (
                  <button className="btn btn-danger" onClick={handleKillswitch}>Kill Switch</button>
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
