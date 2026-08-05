'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ordersApi } from '@/lib/api';
import PhantomSkeleton from '@/components/PhantomSkeleton';
import InvoiceCard from '@/components/InvoiceCard';

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

  if (loading) {
    return (
      <section className="page-lg">
        <div className="container">
          <PhantomSkeleton loading animation="shimmer" reveal={0.3} loading-label="Memuat pesanan">
            <div className="card" style={{ maxWidth: 560, margin: '0 auto', padding: '2rem' }}>
              {/* ---- Header: id/status ---- */}
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
        </div>
      </section>
    );
  }

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

  return (
    <section className="page-lg">
      <div className="container">
        <InvoiceCard order={order} />
      </div>
    </section>
  );
}
