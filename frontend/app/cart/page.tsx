'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cartApi } from '@/lib/api';
import { formatRupiah } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import ProductImage from '@/components/ProductImage';
import { PageSpinner } from '@/components/Spinner';

interface CartItem {
  id: number;
  product_id: number;
  product_name?: string;
  name?: string;
  price: number;
  flash_sale_price?: number | null;
  is_flash_sale?: boolean;
  image_url?: string | null;
  quantity: number;
}

function discountPercent(original: number, discounted: number): number {
  if (!original || original <= 0 || !discounted || discounted >= original) return 0;
  return Math.round((1 - discounted / original) * 100);
}

export default function CartPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCart = async () => {
    try {
      const res: any = await cartApi.get();
      const data = res?.data;
      setItems(data?.items || data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadCart(); }, []);

  const updateQty = async (id: number, qty: number) => {
    if (qty < 1) return;
    try {
      await cartApi.updateItem(id, qty);
      setItems(prev => prev.map(item => item.id === id ? { ...item, quantity: qty } : item));
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err: any) {
      alert(err?.message || 'Gagal update jumlah');
    }
  };

  const removeItem = async (id: number) => {
    try {
      await cartApi.removeItem(id);
      setItems(prev => prev.filter(item => item.id !== id));
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err: any) {
      alert(err?.message || 'Gagal menghapus item');
    }
  };

  /* ---- Derived totals ---- */
  const normalSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const actualSubtotal = items.reduce((sum, item) => sum + (item.flash_sale_price ?? item.price) * item.quantity, 0);
  const flashDiscount = normalSubtotal - actualSubtotal;
  const hasFlashItems = items.some(item => item.is_flash_sale);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) return <PageSpinner />;

  if (items.length === 0) {
    return (
      <section className="page">
        <div className="container">
          <div className="empty-state">
            <div style={{fontSize:'3rem', marginBottom:'1rem', lineHeight:1}}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
            </div>
            <h3>Keranjang kamu kosong</h3>
            <p>Flash sale sedang berlangsung - lihat produk sebelum kehabisan.</p>
            <Link href="/" className="btn btn-primary">Mulai Belanja</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="container">
        <div className="cart-layout">
          <div className="cart-items-col">
            <div className="cart-header">
              <h2>Keranjang Belanja</h2>
              <span className="text-muted">{itemCount} item</span>
            </div>

            <div className="card" style={{padding:0}}>
              <div style={{padding:'0.25rem 1.25rem'}}>
                {items.map(item => {
                  const isFlash = !!item.is_flash_sale;
                  const flashPrice = item.flash_sale_price;
                  const originalPrice = item.price;
                  const displayPrice = isFlash && flashPrice ? flashPrice : originalPrice;
                  const pctOff = isFlash && flashPrice ? discountPercent(originalPrice, flashPrice) : 0;

                  return (
                    <div key={item.id} className="cart-item">
                      <ProductImage src={item.image_url} alt={item.product_name || item.name || 'Produk'} className="ph-img" lazy />
                      <div className="cart-item-info">
                        <Link href={`/products/${item.product_id}`} style={{textDecoration:'none', color:'inherit'}}>
                          <h4>{item.product_name || item.name || `Produk #${item.product_id}`}</h4>
                        </Link>

                        {isFlash && flashPrice ? (
                          <div style={{display:'flex', alignItems:'center', gap:'0.4rem', flexWrap:'wrap'}}>
                            <span className="cart-item-price" style={{color:'var(--danger)'}}>
                              {formatRupiah(displayPrice)}
                            </span>
                            <span style={{
                              fontFamily:'var(--font-mono)', fontSize:'0.8rem',
                              color:'var(--muted)', textDecoration:'line-through',
                            }}>
                              {formatRupiah(originalPrice)}
                            </span>
                            {pctOff > 0 && (
                              <span className="badge badge-danger" style={{fontSize:'0.68rem', padding:'0.1rem 0.4rem'}}>
                                -{pctOff}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="cart-item-price">{formatRupiah(originalPrice)}</span>
                        )}

                        <div className="cart-item-actions">
                          <div className="qty-control">
                            <button className="qty-btn" onClick={() => updateQty(item.id, item.quantity - 1)} disabled={item.quantity <= 1} aria-label="Kurangi jumlah">&minus;</button>
                            <span className="qty-value">{item.quantity}</span>
                            <button className="qty-btn" onClick={() => updateQty(item.id, item.quantity + 1)} aria-label="Tambah jumlah">+</button>
                          </div>
                          <span className="cart-item-total">{formatRupiah(displayPrice * item.quantity)}</span>
                          <button className="cart-remove" onClick={() => removeItem(item.id)} aria-label="Hapus item">&times;</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <div className="cart-summary">
              <h3 style={{fontSize:'1.05rem'}}>Ringkasan Belanja</h3>
              <div className="summary-row">
                <span>Subtotal</span>
                <span className="mono">{formatRupiah(normalSubtotal)}</span>
              </div>
              {flashDiscount > 0 && (
                <div className="summary-row" style={{color:'var(--success)'}}>
                  <span>Potongan Flash Sale</span>
                  <span className="mono" style={{fontWeight:600}}>&minus;{formatRupiah(flashDiscount)}</span>
                </div>
              )}
              <div className="summary-row" style={{paddingTop:'0.85rem', marginTop:'0.25rem'}}>
                <span className="summary-total">Total</span>
                <span className="summary-total">{formatRupiah(actualSubtotal)}</span>
              </div>
              <div style={{marginTop:'1.25rem'}}>
                {hasFlashItems && !user ? (
                  <div style={{textAlign:'center'}}>
                    <p style={{fontSize:'0.85rem', color:'var(--muted)', marginBottom:'0.75rem', lineHeight:1.5}}>
                      Masuk untuk checkout flash sale
                    </p>
                    <Link href="/auth/login?returnUrl=/checkout" className="btn btn-primary btn-block btn-lg">Masuk</Link>
                  </div>
                ) : hasFlashItems ? (
                  <Link href="/checkout" className="btn btn-danger btn-block btn-lg">Checkout Flash Sale</Link>
                ) : (
                  <Link href="/checkout" className="btn btn-primary btn-block btn-lg">Lanjut ke Checkout</Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
