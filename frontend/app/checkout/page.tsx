'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cartApi, flashsaleApi, ordersApi, profileApi } from '@/lib/api';
import { formatRupiah } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import PhantomSkeleton from '@/components/PhantomSkeleton';
import InvoiceCard from '@/components/InvoiceCard';
import { Check, CircleX } from 'lucide-react';

interface CartItem {
  id: number;
  product_id: number;
  product_name?: string;
  name?: string;
  price: number;
  flash_sale_price?: number | null;
  is_flash_sale?: boolean;
  quantity: number;
}

const PAYMENT_METHODS = [
  { value: 'BANK_TRANSFER', label: 'Transfer Bank', desc: 'BCA, Mandiri, BRI' },
  { value: 'COD', label: 'COD', desc: 'Bayar di tempat' },
  { value: 'QRIS', label: 'QRIS', desc: 'Scan QR' },
];

function discountPercent(original: number, discounted: number): number {
  if (!original || original <= 0 || !discounted || discounted >= original) return 0;
  return Math.round((1 - discounted / original) * 100);
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);
  const [successOrder, setSuccessOrder] = useState<any>(null);
  const [successLoading, setSuccessLoading] = useState(false);

  /* ---- Shipping form ---- */
  const [shipping, setShipping] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    note: '',
  });
  const [shippingErrors, setShippingErrors] = useState<Record<string, string>>({});

  /* ---- Payment ---- */
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');

  /* ---- Fetch order after checkout success ---- */
  useEffect(() => {
    if (!success?.orderId) return;
    setSuccessLoading(true);
    ordersApi
      .get(success.orderId)
      .then((res: any) => {
        setSuccessOrder(res?.data || res);
      })
      .catch(() => {
        setSuccessOrder(null);
      })
      .finally(() => setSuccessLoading(false));
  }, [success?.orderId]);

  /* ---- Auth guard ---- */
  useEffect(() => {
    if (!user && !authLoading) {
      router.push('/auth/login?returnUrl=/checkout');
    }
  }, [user, authLoading, router]);

  /* ---- Pre-fill shipping from user profile ---- */
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res: any = await profileApi.get();
        const p = res?.data;
        if (!p) return;
        // Hanya isi field yang masih kosong, jangan timpa input user.
        setShipping(prev => ({
          name: prev.name || user?.name || '',
          phone: prev.phone || p.phone || '',
          address: prev.address || p.address || '',
          city: prev.city || p.city || '',
          province: prev.province || p.province || '',
          postalCode: prev.postalCode || p.postal_code || '',
          note: prev.note,
        }));
      } catch { /* ignore — user bisa isi manual */ }
    })();
  }, [user]);

  /* ---- Load cart ---- */
  useEffect(() => {
    (async () => {
      try {
        const res: any = await cartApi.get();
        const data = res?.data;
        setItems(data?.items || data || []);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  /* ---- Totals ---- */
  const flashItems = items.filter(i => i.is_flash_sale);
  const hasFlash = flashItems.length > 0;

  const normalSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const actualSubtotal = items.reduce((sum, item) => sum + (item.flash_sale_price ?? item.price) * item.quantity, 0);
  const flashDiscount = normalSubtotal - actualSubtotal;

  /* ---- Shipping validation ---- */
  const validateShipping = (): boolean => {
    const errs: Record<string, string> = {};
    if (!shipping.name.trim()) errs.name = 'Nama lengkap wajib diisi';
    if (!shipping.phone.trim()) errs.phone = 'Nomor HP wajib diisi';
    if (!shipping.address.trim()) errs.address = 'Alamat lengkap wajib diisi';
    if (!shipping.city.trim()) errs.city = 'Kota/Kabupaten wajib diisi';
    if (!shipping.province.trim()) errs.province = 'Provinsi wajib diisi';
    if (!shipping.postalCode.trim()) errs.postalCode = 'Kode pos wajib diisi';
    setShippingErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ---- Checkout handler ---- */
  const handleCheckout = async () => {
    if (submitting) return;

    /* Validate shipping for ALL checkouts (flash + regular) */
    if (!validateShipping()) {
      setError('Mohon lengkapi data pengiriman.');
      return;
    }

    setSubmitting(true);
    setError('');

    const shippingPayload = {
      name: shipping.name.trim(),
      phone: shipping.phone.trim(),
      address: shipping.address.trim(),
      city: shipping.city.trim(),
      province: shipping.province.trim(),
      postalCode: shipping.postalCode.trim(),
      note: shipping.note.trim() || undefined,
    };

    const normalItems = items.filter(i => !i.is_flash_sale);
    let successOrderId: string | null = null;

    try {
      /* Regular (non-flash) items → real checkout endpoint */
      if (normalItems.length > 0) {
        const res: any = await ordersApi.checkout(
          normalItems.map(i => i.product_id),
          shippingPayload,
          paymentMethod,
        );
        const orderId = res?.data?.orderId || res?.data?.order_id;
        if (orderId) successOrderId = String(orderId);
      }

      /* Flash sale items → per-item checkout (unchanged) */
      if (flashItems.length > 0) {
        let lastOrderId: string | null = null;
        for (const item of flashItems) {
          const res: any = await flashsaleApi.checkout(
            item.product_id,
            item.quantity,
            shippingPayload,
            paymentMethod,
          );
          const orderId = res?.data?.orderId || res?.data?.order_id;
          if (orderId) lastOrderId = String(orderId);
        }
        if (lastOrderId) successOrderId = lastOrderId;
      }

      setSuccess({
        orderId: successOrderId || 'INV/BC/' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '/' + String(Date.now()).slice(-4),
      });
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err: any) {
      if (err?.status === 401) {
        setError('Silakan masuk untuk melanjutkan checkout flash sale');
      } else if (err?.status === 422) {
        const validationErrors = err?.errors;
        if (Array.isArray(validationErrors) && validationErrors.length > 0) {
          setError(validationErrors.join('. '));
        } else {
          setError(err?.message || 'Validasi gagal. Periksa data pengiriman Anda.');
        }
      } else {
        setError(err?.message || 'Checkout gagal. Stok mungkin sudah habis.');
      }
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <>
        <div className="container">
          <div className="breadcrumb">
            <span className="ph-skeleton-block" style={{ display: 'inline-block', height: '0.85rem', width: '14rem' }} />
          </div>
        </div>
        <section className="page">
          <div className="container">
            <div className="section-header" style={{ marginBottom: '2rem' }}>
              <h2>Checkout</h2>
            </div>
            <div className="checkout-layout">
              <div>
                {/* ---- Data Pengiriman ---- */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <p className="eyebrow">Data Pengiriman</p>
                  <h3 style={{ marginBottom: '1.25rem' }}>Pengiriman</h3>
                  <PhantomSkeleton loading animation="shimmer" reveal={0.3} loading-label="Memuat checkout">
                    <div>
                      <div className="form-group">
                        <div className="ph-skeleton-block" style={{ height: '0.8rem', width: '30%', marginBottom: '0.5rem' }} />
                        <div className="ph-skeleton-block" style={{ height: '2.5rem', width: '100%' }} />
                      </div>
                      <div className="form-group">
                        <div className="ph-skeleton-block" style={{ height: '0.8rem', width: '20%', marginBottom: '0.5rem' }} />
                        <div className="ph-skeleton-block" style={{ height: '2.5rem', width: '100%' }} />
                      </div>
                      <div className="form-group">
                        <div className="ph-skeleton-block" style={{ height: '0.8rem', width: '35%', marginBottom: '0.5rem' }} />
                        <div className="ph-skeleton-block" style={{ height: '5rem', width: '100%' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                          <div className="ph-skeleton-block" style={{ height: '0.8rem', width: '70%', marginBottom: '0.5rem' }} />
                          <div className="ph-skeleton-block" style={{ height: '2.5rem', width: '100%' }} />
                        </div>
                        <div className="form-group">
                          <div className="ph-skeleton-block" style={{ height: '0.8rem', width: '60%', marginBottom: '0.5rem' }} />
                          <div className="ph-skeleton-block" style={{ height: '2.5rem', width: '100%' }} />
                        </div>
                      </div>
                      <div className="form-group">
                        <div className="ph-skeleton-block" style={{ height: '0.8rem', width: '25%', marginBottom: '0.5rem' }} />
                        <div className="ph-skeleton-block" style={{ height: '2.5rem', width: '10rem' }} />
                      </div>
                    </div>
                  </PhantomSkeleton>
                </div>

                {/* ---- Metode Pembayaran ---- */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <p className="eyebrow">Pembayaran</p>
                  <h3 style={{ marginBottom: '1rem' }}>Metode Pembayaran</h3>
                  <PhantomSkeleton loading animation="shimmer" reveal={0.3} loading-label="Memuat checkout">
                    <div style={{ display: 'grid', gap: '0.65rem' }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} className="payment-option" style={{ cursor: 'default' }}>
                          <div className="ph-skeleton-block" style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '40%', marginBottom: '0.25rem' }} />
                            <div className="ph-skeleton-block" style={{ height: '0.78rem', width: '60%' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </PhantomSkeleton>
                </div>

                {/* ---- Item Pesanan ---- */}
                <div className="card">
                  <p className="eyebrow">Item Pesanan</p>
                  <PhantomSkeleton loading animation="shimmer" reveal={0.3} stagger={0.03} count={3} count-gap={12} loading-label="Memuat checkout">
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '55%', marginBottom: '0.35rem' }} />
                        <div className="ph-skeleton-block" style={{ height: '0.8rem', width: '30%' }} />
                      </div>
                      <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '5rem', marginLeft: '1rem', flexShrink: 0 }} />
                    </div>
                  </PhantomSkeleton>
                </div>
              </div>

              {/* ---- Sidebar Ringkasan ---- */}
              <div style={{ position: 'sticky', top: '5.5rem' }}>
                <div className="card" style={{ padding: '1.25rem' }}>
                  <p className="eyebrow">Ringkasan Belanja</p>
                  <PhantomSkeleton loading animation="shimmer" reveal={0.3} loading-label="Memuat checkout">
                    <div>
                      <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '100%', marginBottom: '0.65rem' }} />
                      <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '100%', marginBottom: '0.65rem' }} />
                      <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '100%', marginBottom: '0.65rem' }} />
                      <div className="ph-skeleton-block" style={{ height: '1.1rem', width: '100%', marginBottom: '0.75rem' }} />
                      <div className="ph-skeleton-block" style={{ height: '2.6rem', width: '100%' }} />
                    </div>
                  </PhantomSkeleton>
                </div>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }
  if (!user) return null;

  /* ---- Success screen ---- */
  if (success) {
    return (
      <section className="page-lg">
        <div className="container">
          {successLoading ? (
            <PhantomSkeleton loading animation="shimmer" reveal={0.3} loading-label="Memuat pesanan">
              <div className="card" style={{ maxWidth: 560, margin: '0 auto', padding: '2rem' }}>
                {/* ---- Header ---- */}
                <div className="invoice-header" style={{ textAlign: 'center' }}>
                  <div className="ph-skeleton-block" style={{ width: '3rem', height: '3rem', borderRadius: '50%', margin: '0 auto 1rem' }} />
                  <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '40%', margin: '0 auto 0.75rem' }} />
                  <div className="ph-skeleton-block" style={{ height: '1.4rem', width: '55%', margin: '0 auto 0.5rem' }} />
                  <div className="ph-skeleton-block" style={{ height: '0.85rem', width: '35%', margin: '0 auto' }} />
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: '1.5rem' }} />

                {/* ---- Detail rows ---- */}
                <div className="invoice-details">
                  <div className="ph-skeleton-block" style={{ height: '0.7rem', width: '25%', marginBottom: '1rem' }} />
                  <div className="invoice-row">
                    <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '55%' }} />
                    <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '20%' }} />
                  </div>
                  <div className="invoice-row">
                    <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '50%' }} />
                    <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '25%' }} />
                  </div>
                  <div className="invoice-row" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem', marginTop: '0.25rem' }}>
                    <div className="ph-skeleton-block" style={{ height: '1.05rem', width: '40%' }} />
                    <div className="ph-skeleton-block" style={{ height: '1.05rem', width: '30%' }} />
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: '1.5rem' }} />

                {/* ---- Shipping block ---- */}
                <div className="ph-skeleton-block" style={{ height: '0.7rem', width: '30%', marginBottom: '0.75rem' }} />
                <div className="ph-skeleton-block" style={{ height: '4.5rem', width: '100%', marginBottom: '1.5rem' }} />

                {/* ---- Actions ---- */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div className="ph-skeleton-block" style={{ height: '2.5rem', flex: 1 }} />
                  <div className="ph-skeleton-block" style={{ height: '2.5rem', flex: 1 }} />
                </div>
              </div>
            </PhantomSkeleton>
          ) : successOrder ? (
            <InvoiceCard order={successOrder} />
          ) : (
            /* Fallback simple card if fetch fails */
            <div className="card" style={{maxWidth:520, margin:'0 auto', padding:'2rem', textAlign:'center'}}>
              <div style={{marginBottom:'1.5rem'}}>
                <div style={{width:'3.5rem', height:'3.5rem', borderRadius:'50%', background:'var(--success-soft)', display:'inline-flex', alignItems:'center', justifyContent:'center'}}>
                  <Check size={28} stroke="var(--success)" strokeWidth={2.5} />
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
          )}
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
              <CircleX size={20} style={{flexShrink:0}} />
              {error}
            </div>
          )}
          <div className="checkout-layout">
            <div>
              {/* ---- Data Pengiriman ---- */}
              <div className="card" style={{marginBottom:'1.5rem'}}>
                <p className="eyebrow">Data Pengiriman</p>
                <h3 style={{marginBottom:'1.25rem'}}>Pengiriman</h3>

                <div className="form-group">
                  <label className="form-label" htmlFor="checkout-nama">Nama Lengkap <span style={{color:'var(--danger)'}}>*</span></label>
                  <input
                    id="checkout-nama"
                    type="text"
                    className={`form-input ${shippingErrors.name ? 'form-input-error' : ''}`}
                    value={shipping.name}
                    onChange={e => setShipping({...shipping, name: e.target.value})}
                  />
                  {shippingErrors.name && <span className="form-error">{shippingErrors.name}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="checkout-telepon">No. HP <span style={{color:'var(--danger)'}}>*</span></label>
                  <input
                    id="checkout-telepon"
                    type="tel"
                    className={`form-input ${shippingErrors.phone ? 'form-input-error' : ''}`}
                    placeholder="08xxxxxxxxxx"
                    value={shipping.phone}
                    onChange={e => setShipping({...shipping, phone: e.target.value})}
                  />
                  {shippingErrors.phone && <span className="form-error">{shippingErrors.phone}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="checkout-alamat">Alamat Lengkap <span style={{color:'var(--danger)'}}>*</span></label>
                  <textarea
                    id="checkout-alamat"
                    className={`form-input ${shippingErrors.address ? 'form-input-error' : ''}`}
                    rows={3}
                    placeholder="Jalan, nomor, RT/RW"
                    value={shipping.address}
                    onChange={e => setShipping({...shipping, address: e.target.value})}
                  />
                  {shippingErrors.address && <span className="form-error">{shippingErrors.address}</span>}
                </div>

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="checkout-kota">Kota/Kabupaten <span style={{color:'var(--danger)'}}>*</span></label>
                    <input
                      id="checkout-kota"
                      type="text"
                      className={`form-input ${shippingErrors.city ? 'form-input-error' : ''}`}
                      value={shipping.city}
                      onChange={e => setShipping({...shipping, city: e.target.value})}
                    />
                    {shippingErrors.city && <span className="form-error">{shippingErrors.city}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="checkout-provinsi">Provinsi <span style={{color:'var(--danger)'}}>*</span></label>
                    <input
                      id="checkout-provinsi"
                      type="text"
                      className={`form-input ${shippingErrors.province ? 'form-input-error' : ''}`}
                      value={shipping.province}
                      onChange={e => setShipping({...shipping, province: e.target.value})}
                    />
                    {shippingErrors.province && <span className="form-error">{shippingErrors.province}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="checkout-kode-pos">Kode Pos <span style={{color:'var(--danger)'}}>*</span></label>
                  <input
                    id="checkout-kode-pos"
                    type="text"
                    className={`form-input ${shippingErrors.postalCode ? 'form-input-error' : ''}`}
                    style={{maxWidth:200}}
                    value={shipping.postalCode}
                    onChange={e => setShipping({...shipping, postalCode: e.target.value})}
                  />
                  {shippingErrors.postalCode && <span className="form-error">{shippingErrors.postalCode}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="checkout-catatan">Catatan <span className="text-muted" style={{fontWeight:400, fontSize:'0.8rem'}}>(opsional)</span></label>
                  <textarea
                    id="checkout-catatan"
                    className="form-input"
                    rows={2}
                    placeholder="Catatan untuk kurir (opsional)"
                    value={shipping.note}
                    onChange={e => setShipping({...shipping, note: e.target.value})}
                  />
                </div>
              </div>

              {/* ---- Metode Pembayaran ---- */}
              <div className="card" style={{marginBottom:'1.5rem'}}>
                  <p className="eyebrow">Pembayaran</p>
                  <h3 style={{marginBottom:'1rem'}}>Metode Pembayaran</h3>
                  <div style={{display:'grid', gap:'0.65rem'}}>
                    {PAYMENT_METHODS.map(pm => (
                      <label
                        key={pm.value}
                        className={`payment-option ${paymentMethod === pm.value ? 'selected' : ''}`}
                        onClick={() => setPaymentMethod(pm.value)}
                      >
                        <input
                          type="radio"
                          name="payment"
                          value={pm.value}
                          checked={paymentMethod === pm.value}
                          onChange={() => setPaymentMethod(pm.value)}
                          style={{accentColor:'var(--accent)', width:18, height:18}}
                        />
                        <div>
                          <div style={{fontWeight:600, fontSize:'0.9rem'}}>{pm.label}</div>
                          <div className="text-muted" style={{fontSize:'0.78rem'}}>{pm.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

              {/* ---- Item Pesanan ---- */}
              <div className="card">
                <p className="eyebrow">Item Pesanan</p>
                {items.map((item: any, idx: number) => {
                  const isFlash = !!item.is_flash_sale;
                  const flashPrice = item.flash_sale_price;
                  const originalPrice = item.price;
                  const displayPrice = isFlash && flashPrice ? flashPrice : originalPrice;
                  const pctOff = isFlash && flashPrice ? discountPercent(originalPrice, flashPrice) : 0;

                  return (
                    <div key={item.id || idx} style={{display:'flex', justifyContent:'space-between', padding:'0.75rem 0', borderTop: idx > 0 ? '1px solid var(--border)' : undefined}}>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontWeight:600, fontSize:'0.9rem', display:'flex', alignItems:'center', gap:'0.35rem', flexWrap:'wrap'}}>
                          {item.product_name || item.name || `Produk #${item.product_id}`}
                          {isFlash && (
                            <span className="badge badge-danger" style={{fontSize:'0.65rem', padding:'0.08rem 0.35rem'}}>
                              FLASH
                            </span>
                          )}
                          {pctOff > 0 && (
                            <span className="badge badge-danger" style={{fontSize:'0.65rem', padding:'0.08rem 0.35rem'}}>
                              -{pctOff}%
                            </span>
                          )}
                        </div>
                        <div className="text-muted" style={{fontSize:'0.8rem', marginTop:'0.15rem'}}>{item.quantity}x {formatRupiah(displayPrice)}</div>
                      </div>
                      <span className="mono" style={{fontWeight:600, fontSize:'0.9rem', whiteSpace:'nowrap'}}>{formatRupiah(displayPrice * (item.quantity || 1))}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ---- Sidebar Ringkasan ---- */}
            <div style={{position:'sticky', top:'5.5rem'}}>
              <div className="card" style={{padding:'1.25rem'}}>
                <p className="eyebrow">Ringkasan Belanja</p>
                <div style={{display:'flex', justifyContent:'space-between', padding:'0.4rem 0', fontSize:'0.9rem', borderBottom:'1px solid var(--border)'}}>
                  <span className="text-muted">Subtotal</span>
                  <span className="mono" style={{fontWeight:500}}>{formatRupiah(normalSubtotal)}</span>
                </div>
                {flashDiscount > 0 && (
                  <div style={{display:'flex', justifyContent:'space-between', padding:'0.4rem 0', fontSize:'0.9rem', borderBottom:'1px solid var(--border)', color:'var(--success)'}}>
                    <span>Potongan Flash Sale</span>
                    <span className="mono" style={{fontWeight:600}}>&minus;{formatRupiah(flashDiscount)}</span>
                  </div>
                )}
                <div style={{display:'flex', justifyContent:'space-between', padding:'0.4rem 0', fontSize:'0.9rem', borderBottom:'1px solid var(--border)'}}>
                  <span className="text-muted">Ongkos Kirim</span>
                  <span className="mono" style={{fontWeight:500}}>Gratis</span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'0.75rem 0 0.5rem'}}>
                  <span style={{fontWeight:600, fontSize:'0.95rem'}}>Total</span>
                  <span className="mono" style={{fontWeight:700, fontSize:'1.1rem'}}>{formatRupiah(actualSubtotal)}</span>
                </div>
                <button
                  className={`btn ${hasFlash ? 'btn-danger' : 'btn-primary'} btn-block btn-lg ${submitting ? 'loading' : ''}`}
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
