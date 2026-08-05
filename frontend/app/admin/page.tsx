'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { formatNumber, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import PhantomSkeleton from '@/components/PhantomSkeleton';

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    (async () => {
      if (!user || user.role !== 'admin') return;
      try {
        const res: any = await adminApi.dashboard();
        setDashboard(res?.data || res);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [user]);

  if (authLoading || loading) {
    return (
      <PhantomSkeleton loading animation="shimmer" reveal={0.3} stagger={0.03} loading-label="Memuat dashboard">
        <div aria-hidden="true">
          <section className="section-header" style={{ marginBottom: '2rem' }}>
            <div>
              <div className="ph-skeleton-block" style={{ height: '1.75rem', width: '16rem', marginBottom: '0.5rem' }} />
              <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '12rem' }} />
            </div>
          </section>

          <section className="stat-grid">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="stat-card">
                <div className="ph-skeleton-block" style={{ height: '1.75rem', width: '40%', marginBottom: '0.5rem' }} />
                <div className="ph-skeleton-block" style={{ height: '0.8rem', width: '60%' }} />
              </div>
            ))}
          </section>

          <section className="card" style={{ marginBottom: '2rem' }}>
            <div className="ph-skeleton-block" style={{ height: '1.25rem', width: '11rem', marginBottom: '1rem' }} />
            <div className="table-wrap">
              <table style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '35%' }}><div className="ph-skeleton-block" style={{ height: '0.8rem', width: '60%' }} /></th>
                    <th style={{ width: '30%' }}><div className="ph-skeleton-block" style={{ height: '0.8rem', width: '60%' }} /></th>
                    <th><div className="ph-skeleton-block" style={{ height: '0.8rem', width: '50%' }} /></th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2].map(i => (
                    <tr key={i}>
                      <td><div className="ph-skeleton-block" style={{ height: '0.9rem', width: '70%' }} /></td>
                      <td><div className="ph-skeleton-block" style={{ height: '0.9rem', width: '45%' }} /></td>
                      <td><div className="ph-skeleton-block" style={{ height: '0.9rem', width: '55%' }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="ph-skeleton-block" style={{ height: '1.25rem', width: '8rem', marginBottom: '1rem' }} />
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div className="ph-skeleton-block" style={{ height: '2.4rem', width: '12rem', borderRadius: 'var(--radius-md)' }} />
              <div className="ph-skeleton-block" style={{ height: '2.4rem', width: '10rem', borderRadius: 'var(--radius-md)' }} />
            </div>
          </section>
        </div>
      </PhantomSkeleton>
    );
  }
  if (!user || user.role !== 'admin') return null;

  const metrics = dashboard?.metrics || dashboard || {};
  const recentOrders = metrics.recentOrders || [];

  return (
    <>
      <section className="section-header" style={{marginBottom:'2rem'}}>
        <div>
          <h1 style={{marginBottom:'0.25rem'}}>Dashboard Admin</h1>
          <p className="text-muted">Selamat datang, {user.name}</p>
        </div>
      </section>

      <section className="stat-grid">
        <div className="stat-card">
          <div className="stat-value mono">{formatNumber(metrics.totalUsers || 0)}</div>
          <div className="stat-label">Total Pengguna</div>
        </div>
        <div className="stat-card">
          <div className="stat-value mono">{formatNumber(metrics.totalProducts || 0)}</div>
          <div className="stat-label">Total Produk</div>
        </div>
        <div className="stat-card">
          <div className="stat-value mono">{formatNumber(metrics.ordersToday || 0)}</div>
          <div className="stat-label">Pesanan Hari Ini</div>
        </div>
        <div className="stat-card">
          <div className="stat-value mono">{formatNumber(metrics.flashSaleActiveCount || 0)}</div>
          <div className="stat-label">Flash Sale Aktif</div>
        </div>
      </section>

      {recentOrders.length > 0 && (
        <section className="card" style={{marginBottom:'2rem'}}>
          <h2 style={{marginBottom:'1rem'}}>Pesanan Terbaru</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Status</th>
                  <th>Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order: any) => (
                  <tr key={order.id}>
                    <td><span className="mono">{order.order_id || order.id}</span></td>
                    <td><span className={`badge ${order.status === 'PAID' ? 'badge-success' : order.status === 'FAILED' ? 'badge-danger' : 'badge-warning'}`}>{order.status}</span></td>
                    <td style={{fontSize:'0.85rem'}}>{formatDateTime(order.created_at || order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card">
        <h2 style={{marginBottom:'1rem'}}>Aksi Cepat</h2>
        <div style={{display:'flex', gap:'0.75rem', flexWrap:'wrap'}}>
          <Link href="/admin/products" className="btn btn-outline">Manajemen Produk</Link>
          <Link href="/admin/flashsale" className="btn btn-outline">Flash Sale Control</Link>
        </div>
      </section>
    </>
  );
}
