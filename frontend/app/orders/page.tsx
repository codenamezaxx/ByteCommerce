'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ordersApi } from '@/lib/api';
import { formatRupiah, formatDateTime, getStatusBadge, getStatusLabel } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import PhantomSkeleton from '@/components/PhantomSkeleton';

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!user && !authLoading) {
      router.push('/auth/login?returnUrl=/orders');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const res: any = await ordersApi.list({ page, limit: 10 });
        const data = res?.data || res;
        setOrders(data?.orders || data || []);
        setTotalPages(data?.totalPages || 1);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [user, page]);

  if (authLoading || loading) {
    return (
      <section className="page">
        <div className="container">
          <div className="section-header">
            <h2>Pesanan Saya</h2>
          </div>

          <PhantomSkeleton loading animation="shimmer" reveal={0.3} stagger={0.03} count={3} count-gap={16} loading-label="Memuat pesanan">
            <div className="card" style={{ maxWidth: 560, margin: '0 auto', padding: '1.5rem' }}>
              {/* ---- Header: id/status ---- */}
              <div className="invoice-header" style={{ textAlign: 'center' }}>
                <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '45%', margin: '0 auto 0.5rem' }} />
                <div className="ph-skeleton-block" style={{ height: '0.85rem', width: '30%', margin: '0 auto' }} />
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1.25rem 0' }} />

              {/* ---- Product lines ---- */}
              <div className="invoice-row">
                <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '55%' }} />
                <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '20%' }} />
              </div>
              <div className="invoice-row">
                <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '50%' }} />
                <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '25%' }} />
              </div>

              {/* ---- Total footer ---- */}
              <div className="invoice-row invoice-total" style={{ borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.75rem' }}>
                <div className="ph-skeleton-block" style={{ height: '1.05rem', width: '40%' }} />
                <div className="ph-skeleton-block" style={{ height: '1.05rem', width: '30%' }} />
              </div>
            </div>
          </PhantomSkeleton>
        </div>
      </section>
    );
  }
  if (!user) return null;

  return (
    <section className="page">
      <div className="container">
        <div className="section-header">
          <h2>Pesanan Saya</h2>
        </div>

        {orders.length === 0 ? (
          <div className="empty-state">
            <h3>Belum ada pesanan</h3>
            <p>Mulai belanja untuk melihat riwayat pesanan kamu.</p>
            <Link href="/" className="btn btn-primary">Mulai Belanja</Link>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Tanggal</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order: any) => (
                    <tr key={order.id}>
                      <td><span className="mono" style={{fontSize:'0.85rem'}}>{order.order_id || order.id}</span></td>
                      <td style={{fontSize:'0.85rem'}}>{formatDateTime(order.created_at || order.createdAt)}</td>
                      <td><span className="mono">{formatRupiah(order.total || order.total_amount || 0)}</span></td>
                      <td><span className={`badge ${getStatusBadge(order.status)}`}>{getStatusLabel(order.status)}</span></td>
                      <td><Link href={`/orders/${order.id}`} className="btn btn-ghost btn-sm">Detail</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>&lsaquo;</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`pagination-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                ))}
                <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>&rsaquo;</button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
