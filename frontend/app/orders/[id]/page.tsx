'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ordersApi } from '@/lib/api';
import { formatRupiah, formatDateTime, getStatusBadge, getStatusLabel } from '@/lib/utils';
import { PageSpinner } from '@/components/Spinner';

export default function OrderDetailPage() {
  const params = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!params.id) return;
      try {
        const res: any = await ordersApi.get(params.id as string);
        setOrder(res?.data || res);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) return <PageSpinner />;

  if (!order) {
    return (
      <div className="page">
        <div className="container">
          <div className="empty-state">
            <h3>Pesanan tidak ditemukan</h3>
            <Link href="/orders" className="btn btn-primary">Kembali ke Pesanan</Link>
          </div>
        </div>
      </div>
    );
  }

  const items = order.items || order.order_items || [];
  const total = order.total || order.total_amount || 0;

  return (
    <section className="page-lg">
      <div className="container">
        <div className="invoice-card" style={{maxWidth:560, textAlign:'left'}}>
          <div className="invoice-header" style={{textAlign:'center'}}>
            <div className={`invoice-icon ${order.status === 'PAID' || order.status === 'SUCCESS' ? 'success' : ''}`}>
              {order.status === 'PAID' || order.status === 'SUCCESS' ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : order.status === 'PENDING' ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              )}
            </div>
            <div style={{marginBottom:'1rem'}}>
              <span className={`badge ${getStatusBadge(order.status)}`}>{getStatusLabel(order.status)}</span>
            </div>
            <h2>Pesanan {getStatusLabel(order.status)}</h2>
            <p className="invoice-id mono" style={{marginTop:'0.5rem'}}>{order.order_id || order.id}</p>
            <p className="text-muted" style={{fontSize:'0.85rem', marginTop:'0.25rem'}}>{formatDateTime(order.created_at || order.createdAt)}</p>
          </div>

          <hr style={{border:'none', borderTop:'1px solid var(--border)', marginBottom:'1.5rem'}} />

          <div className="invoice-details">
            <p className="eyebrow">Detail Pesanan</p>
            {items.map((item: any, idx: number) => (
              <div key={idx} className="invoice-row">
                <span>{item.product_name || item.name || `Produk #${item.product_id}`} - {item.quantity}x {formatRupiah(item.price || 0)}</span>
                <span className="mono">{formatRupiah((item.price || 0) * (item.quantity || 1))}</span>
              </div>
            ))}
            <div className="invoice-row invoice-total" style={{borderTop:'2px solid var(--fg)', paddingTop:'0.85rem', marginTop:'0.25rem'}}>
              <span>Total Pembayaran</span>
              <span className="mono">{formatRupiah(total)}</span>
            </div>
          </div>

          <div style={{display:'flex', gap:'0.75rem', marginTop:'1rem'}}>
            <Link href="/orders" className="btn btn-outline" style={{flex:1}}>Kembali ke Pesanan</Link>
            <Link href="/" className="btn btn-primary" style={{flex:1}}>Kembali Belanja</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
