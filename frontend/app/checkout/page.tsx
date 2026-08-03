'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cartApi, flashsaleApi } from '@/lib/api';
import { formatRupiah } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { PageSpinner } from '@/components/Spinner';

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);
  const [flashProducts, setFlashProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!user && !authLoading) {
      router.push('/auth/login?returnUrl=/checkout');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await cartApi.get();
        const data = res?.data;
        setItems(data?.items || data || []);
      } catch { /* ignore */ }
      try {
        const res: any = await flashsaleApi.active();
        // Backend: { success, message, data: { products: [...] } }
        setFlashProducts(Array.isArray(res?.data) ? res.data : res?.data?.products || []);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res: any = await flashsaleApi.active();
        setFlashProducts(Array.isArray(res?.data) ? res.data : res?.data?.products || []);
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const subtotal = items.reduce((sum: number, item: any) => sum + ((item.flash_sale_price ?? item.price) || 0) * (item.quantity || 1), 0);
  const hasFlash = items.some((item: any) => flashProducts.some((fp: any) => fp.id === item.product_id));

  const handleCheckout = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      if (hasFlash) {
        for (const item of items) {
          if (flashProducts.some((fp: any) => fp.id === item.product_id)) {
            await flashsaleApi.checkout(item.product_id, item.quantity);
          }
        }
      }
      setSuccess({ orderId: 'INV/BC/' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '/' + String(Date.now()).slice(-4) });
    } catch (err: any) {
      if (err?.status === 401) {
        setError('Silakan masuk untuk melanjutkan checkout flash sale');
      } else {
        setError(err?.message || 'Checkout gagal. Stok mungkin sudah habis.');
      }
    }
    setSubmitting(false);
    window.dispatchEvent(new Event('cart-updated'));
  };

  if (loading) return <PageSpinner />;
  if (!user) return null;

  if (success) {
    return (
      <section className="page-lg">
        <div className="container">
          <div className="invoice-card" style={{maxWidth:520, textAlign:'left'}}>
            <div style={{marginBottom:'1.5rem'}}>
              <div style={{width:'3.5rem', height:'3.5rem', borderRadius:'50%', background:'var(--success-soft)', display:'inline-flex', alignItems:'center', justifyContent:'center'}}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
            </div>
            <h2 style={{marginBottom:'0.5rem'}}>Pesanan Berhasil!</h2>
            <p className="text-muted" style={{fontSize:'0.9rem', lineHeight:1.6, marginBottom:'1.25rem'}}>
              Pesanan kamu sedang diproses. Silakan tunggu konfirmasi dari kurir.
            </p>
            <div className="card card-flat" style={{padding:'0.75rem 1rem', marginBottom:'1.5rem', background:'var(--bg)'}}>
              <div className="text-muted" style={{fontSize:'0.8rem', marginBottom:'0.25rem'}}>Order ID</div>
              <span className="mono" style={{fontWeight:600, fontSize:'0.95rem'}}>{success.orderId}</span>
            </div>
            <div style={{display:'flex', gap:'0.75rem'}}>
              <Link href="/orders" className="btn btn-primary" style={{flex:1, justifyContent:'center'}}>Lihat Pesanan</Link>
              <Link href="/" className="btn btn-outline" style={{flex:1, justifyContent:'center'}}>Kembali Belanja</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="container">
        <div className="breadcrumb">
          <Link href="/">Beranda</Link> &nbsp;/&nbsp; <Link href="/cart">Keranjang</Link> &nbsp;/&nbsp; <span>Checkout</span>
        </div>
      </div>
      <section className="page">
        <div className="container">
          <div className="section-header" style={{marginBottom:'2rem'}}>
            <h2>Checkout</h2>
            {hasFlash && <span className="badge badge-warning">Flash Sale</span>}
          </div>
          {error && (
            <div className="toast toast-error mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              {error}
            </div>
          )}
          <div className="checkout-layout">
            <div>
              <div className="card" style={{marginBottom:'1.5rem'}}>
                <p className="eyebrow">Detail Pengiriman</p>
                <h3 style={{marginBottom:'1.25rem'}}>Alamat</h3>
                <div className="form-group">
                  <label className="form-label">Nama Lengkap</label>
                  <input type="text" className="form-input" value={user?.name || ''} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={user?.email || ''} readOnly />
                </div>
                <p className="text-muted" style={{fontSize:'0.85rem'}}>Pengiriman akan dikonfirmasi setelah pembayaran.</p>
              </div>
              <div className="card">
                <p className="eyebrow">Item Pesanan</p>
                {items.map((item: any, idx: number) => (
                  <div key={item.id || idx} style={{display:'flex', justifyContent:'space-between', padding:'0.75rem 0', borderTop: idx > 0 ? '1px solid var(--border)' : undefined}}>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontWeight:600, fontSize:'0.9rem'}}>{item.product_name || item.name || `Produk #${item.product_id}`}</div>
                      <div className="text-muted" style={{fontSize:'0.8rem', marginTop:'0.15rem'}}>{item.quantity}x</div>
                    </div>
                    <span className="mono" style={{fontWeight:600, fontSize:'0.9rem', whiteSpace:'nowrap'}}>{formatRupiah(((item.flash_sale_price ?? item.price) || 0) * (item.quantity || 1))}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{position:'sticky', top:'5.5rem'}}>
              <div className="card" style={{padding:'1.25rem'}}>
                <p className="eyebrow">Ringkasan Belanja</p>
                <div style={{display:'flex', justifyContent:'space-between', padding:'0.4rem 0', fontSize:'0.9rem', borderBottom:'1px solid var(--border)'}}>
                  <span className="text-muted">Subtotal</span>
                  <span className="mono" style={{fontWeight:500}}>{formatRupiah(subtotal)}</span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', padding:'0.4rem 0', fontSize:'0.9rem', borderBottom:'1px solid var(--border)'}}>
                  <span className="text-muted">Ongkos Kirim</span>
                  <span className="mono" style={{fontWeight:500}}>Gratis</span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'0.75rem 0 0.5rem'}}>
                  <span style={{fontWeight:600, fontSize:'0.95rem'}}>Total</span>
                  <span className="mono" style={{fontWeight:700, fontSize:'1.1rem'}}>{formatRupiah(subtotal)}</span>
                </div>
                <button
                  className={`btn btn-primary btn-block btn-lg ${submitting ? 'loading' : ''}`}
                  onClick={handleCheckout}
                  disabled={submitting || items.length === 0}
                  style={{marginTop:'0.75rem'}}
                >
                  <span className="spinner"></span>
                  <span className="btn-text">{hasFlash ? 'Beli Flash Sale' : 'Konfirmasi Pesanan'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
