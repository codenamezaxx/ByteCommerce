'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { formatNumber, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { PageSpinner } from '@/components/Spinner';

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
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

  if (authLoading || loading) return <PageSpinner />;
  if (!user || user.role !== 'admin') return null;

  const metrics = dashboard?.metrics || dashboard || {};
  const recentOrders = metrics.recentOrders || [];

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
            <li><Link href="/admin" className={`sidebar-link ${pathname === '/admin' ? 'active' : ''}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              Dashboard
            </Link></li>
            <li><Link href="/admin/products" className={`sidebar-link ${pathname === '/admin/products' ? 'active' : ''}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              Produk
            </Link></li>
            <li><Link href="/admin/flashsale" className={`sidebar-link ${pathname === '/admin/flashsale' ? 'active' : ''}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              Flash Sale
            </Link></li>
          </ul>
        </nav>
        <div className="sidebar-divider"></div>
        <div style={{padding:'0 0.75rem'}}>
          <Link href="/" className="btn btn-ghost btn-block" style={{fontSize:'0.85rem'}}>Kembali ke Toko</Link>
        </div>
        <div className="sidebar-footer"></div>
      </aside>

      <main className="admin-main">
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
      </main>
    </div>
  );
}
