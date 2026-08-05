'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import PhantomSkeleton from '@/components/PhantomSkeleton';
import { LayoutDashboard, Package, Zap, LogOut, Menu, Store } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (authLoading) {
    return (
      <PhantomSkeleton loading animation="shimmer" reveal={0.3} stagger={0.03} loading-label="Memeriksa sesi">
        <div className="admin-layout" aria-hidden="true">
          {/* Sidebar */}
          <aside className="admin-sidebar">
            <div className="sidebar-brand">
              <div className="navbar-brand" style={{ display: 'flex', alignItems: 'center' }}>
                <div className="ph-skeleton-block" style={{ height: '1.25rem', width: '10rem' }} />
              </div>
            </div>

            <nav>
              <ul className="sidebar-nav">
                {[0, 1, 2].map(i => (
                  <li key={i}>
                    <div className="sidebar-link" style={{ cursor: 'default' }}>
                      <div className="ph-skeleton-block" style={{ height: '1.1rem', width: '100%' }} />
                    </div>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="sidebar-divider" />

            <div className="sidebar-footer">
              <div className="sidebar-footer-user ml-5">
                <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '70%', marginBottom: '0.4rem' }} />
                <div className="ph-skeleton-block" style={{ height: '0.75rem', width: '90%' }} />
              </div>
              <div className="ph-skeleton-block" style={{ height: '2.2rem', width: '100%', borderRadius: 'var(--radius-sm)' }} />
            </div>
          </aside>

          {/* Content area */}
          <div className="admin-content">
            <div className="admin-topbar">
              <div className="ph-skeleton-block" style={{ width: '2.25rem', height: '2.25rem', borderRadius: 'var(--radius-sm)' }} />
              <div className="ph-skeleton-block" style={{ height: '1.1rem', width: '8rem' }} />
            </div>

            <main className="admin-main">
              <section className="section-header" style={{ marginBottom: '2rem' }}>
                <div>
                  <div className="ph-skeleton-block" style={{ height: '1.75rem', width: '16rem', marginBottom: '0.5rem' }} />
                  <div className="ph-skeleton-block" style={{ height: '0.9rem', width: '12rem' }} />
                </div>
              </section>

              <section className="stat-grid">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="stat-card">
                    <div className="ph-skeleton-block" style={{ height: '1.6rem', width: '40%', marginBottom: '0.5rem' }} />
                    <div className="ph-skeleton-block" style={{ height: '0.8rem', width: '60%' }} />
                  </div>
                ))}
              </section>

              <section className="card" style={{ marginBottom: '2rem' }}>
                <div className="ph-skeleton-block" style={{ height: '1.2rem', width: '11rem', marginBottom: '1rem' }} />
                <div className="table-wrap">
                  <table style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '35%' }}><div className="ph-skeleton-block" style={{ height: '0.8rem', width: '60%' }} /></th>
                        <th style={{ width: '25%' }}><div className="ph-skeleton-block" style={{ height: '0.8rem', width: '60%' }} /></th>
                        <th><div className="ph-skeleton-block" style={{ height: '0.8rem', width: '50%' }} /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 1, 2, 3].map(i => (
                        <tr key={i}>
                          <td><div className="ph-skeleton-block" style={{ height: '0.9rem', width: '70%' }} /></td>
                          <td><div className="ph-skeleton-block" style={{ height: '0.9rem', width: '50%' }} /></td>
                          <td><div className="ph-skeleton-block" style={{ height: '0.9rem', width: '55%' }} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </main>
          </div>
        </div>
      </PhantomSkeleton>
    );
  }
  if (!user || user.role !== 'admin') return null;

  return (
    <div className="admin-layout">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Link href="/" className="navbar-brand" style={{ display: 'flex', alignItems: 'center' }}>
            Byte<span style={{ color: 'var(--accent)' }}>Commerce</span>
            <span className="admin-suffix">Admin</span>
          </Link>
        </div>

        <nav>
          <ul className="sidebar-nav">
            <li>
              <Link href="/admin" className={`sidebar-link ${pathname === '/admin' ? 'active' : ''}`}>
                <LayoutDashboard size={18} />
                Dashboard
              </Link>
            </li>
            <li>
              <Link href="/admin/products" className={`sidebar-link ${pathname === '/admin/products' ? 'active' : ''}`}>
                <Package size={18} />
                Produk
              </Link>
            </li>
            <li>
              <Link href="/admin/flashsale" className={`sidebar-link ${pathname === '/admin/flashsale' ? 'active' : ''}`}>
                <Zap size={18} />
                Flash Sale
              </Link>
            </li>
          </ul>
        </nav>

        <div className="sidebar-divider" />

        <div className="sidebar-footer">
          <div className="sidebar-footer-user ml-5">
            <div className="sidebar-footer-name">{user.name}</div>
            <div className="sidebar-footer-email">{user.email}</div>
          </div>
          <div>
            <Link href="/" className="btn btn-ghost btn-block" style={{ fontSize: '0.85rem', justifyContent: 'flex-start' }}>
              <Store size={16} />
              Kembali ke Toko
            </Link>
          </div>
          <button
            onClick={logout}
            className="btn btn-ghost"
            style={{ fontSize: '0.85rem', color: 'var(--danger)', width: '100%', justifyContent: 'flex-start' }}
          >
            <LogOut size={16} />
            Keluar
          </button>
        </div>
      </aside>

      {/* Content area */}
      <div className="admin-content">
        {/* Mobile top bar */}
        <div className="admin-topbar">
          <button
            className="admin-hamburger"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <Menu size={22} />
          </button>
          <Link href="/" className="navbar-brand" style={{ fontSize: '1rem' }}>
            Byte<span style={{ color: 'var(--accent)' }}>Commerce</span>
            <span className="admin-suffix">Admin</span>
          </Link>
        </div>

        <main className="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
}
