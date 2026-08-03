'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ordersApi } from '@/lib/api';
import { formatRupiah, formatDateTime, getStatusBadge, getStatusLabel } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { PageSpinner } from '@/components/Spinner';

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

  if (authLoading || loading) return <PageSpinner />;
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
