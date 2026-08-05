'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatRupiah, formatDateTime, formatInvoiceId, getStatusBadge, getStatusLabel } from '@/lib/utils';
import { Check, Clock, CreditCard, Copy } from 'lucide-react';

interface OrderItem {
  product_id?: number;
  product_name?: string;
  name?: string;
  quantity: number;
  price_at_purchase?: number;
  price?: number;
  subtotal?: number;
}

interface Order {
  id?: string | number;
  total_amount?: number;
  total?: number;
  status?: string;
  created_at?: string;
  createdAt?: string;
  shipping_name?: string;
  shipping_phone?: string;
  shipping_address?: string;
  shipping_city?: string;
  shipping_province?: string;
  shipping_postal_code?: string;
  shipping_note?: string;
  payment_method?: string;
  items?: OrderItem[];
  order_items?: OrderItem[];
}

const BANK_ACCOUNTS = [
  {
    bank: 'Bank BCA',
    account: '1234567890',
    name: 'a.n. PT ByteCommerce',
    color: 'var(--accent)',
    bg: 'var(--accent-soft)',
  },
  {
    bank: 'Bank Mandiri',
    account: '0987654321',
    name: 'a.n. PT ByteCommerce',
    color: 'var(--warning)',
    bg: 'var(--warning-soft)',
  },
];

export default function InvoiceCard({ order }: { order: Order }) {
  const [copied, setCopied] = useState(false);

  const status = (order.status || '').toUpperCase();
  const isPaid = status === 'PAID' || status === 'SUCCESS';
  const isPending = status === 'PENDING';

  const items = order.items || order.order_items || [];
  const total = order.total_amount || order.total || 0;

  const subtotal = items.reduce(
    (sum, item) => sum + (item.subtotal ?? (item.price_at_purchase ?? item.price ?? 0) * (item.quantity || 1)),
    0,
  );

  const invoiceId = formatInvoiceId(order);
  const dateStr = order.created_at || order.createdAt || '';

  const handleCopy = async () => {
    try {
      const text = BANK_ACCOUNTS.map((b) => `${b.bank}: ${b.account}`).join('\n');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  return (
    <div
      className="card"
      style={{
        maxWidth: 560,
        margin: '0 auto',
        border: `1px solid ${isPaid ? 'var(--success)' : 'var(--warning)'}`,
        padding: '2rem',
      }}
    >
      {/* ---- Header ---- */}
      <div className="invoice-header" style={{ textAlign: 'center' }}>
        {isPaid ? (
          <div className="invoice-icon success">
            <Check size={24} strokeWidth={2.5} />
          </div>
        ) : (
          <div className="invoice-icon" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
            <Clock size={24} strokeWidth={2.5} />
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <span className={`badge ${getStatusBadge(order.status || '')}`}>
            {isPending ? 'MENUNGGU PEMBAYARAN' : getStatusLabel(order.status || '')}
          </span>
        </div>

        <h2>{isPaid ? 'Pesanan Berhasil!' : 'Pesanan Dibuat'}</h2>

        <p className="invoice-id mono" style={{ marginTop: '0.5rem' }}>
          {invoiceId}
        </p>
        {dateStr && (
          <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
            {formatDateTime(dateStr)}
          </p>
        )}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: '1.5rem' }} />

      {/* ---- Detail Pesanan ---- */}
      <div className="invoice-details">
        <p className="eyebrow">Detail Pesanan</p>

        {items.map((item: OrderItem, idx: number) => {
          const unitPrice = item.price_at_purchase ?? item.price ?? 0;
          return (
            <div key={idx} className="invoice-row">
              <span>
                {item.product_name || item.name || `Produk #${item.product_id}`} &minus; {item.quantity}&times; {formatRupiah(unitPrice)}
              </span>
              <span className="mono">{formatRupiah(unitPrice * (item.quantity || 1))}</span>
            </div>
          );
        })}

        <div
          className="invoice-row"
          style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}
        >
          <span>Subtotal</span>
          <span className="mono">{formatRupiah(subtotal)}</span>
        </div>

        <div className="invoice-row">
          <span className="text-muted">Ongkos Kirim</span>
          <span className="mono text-muted">Gratis</span>
        </div>

        <div
          className="invoice-row invoice-total"
          style={{ borderTop: '2px solid var(--fg)', paddingTop: '0.85rem', marginTop: '0.25rem' }}
        >
          <span>Total Pembayaran</span>
          <span className="mono">{formatRupiah(total)}</span>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: '1.5rem' }} />

      {/* ---- Informasi Pengiriman ---- */}
      <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
        <p className="eyebrow">Informasi Pengiriman</p>
        <div
          style={{
            background: 'var(--bg)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem 1.25rem',
            marginTop: '0.5rem',
          }}
        >
          {order.shipping_name && (
            <p style={{ fontWeight: 600, marginBottom: '0.35rem' }}>{order.shipping_name}</p>
          )}
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.5, marginBottom: '0.25rem' }}>
            {[order.shipping_address, order.shipping_city, order.shipping_province, order.shipping_postal_code]
              .filter(Boolean)
              .join(', ')}
          </p>
          {order.shipping_phone && (
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
              No. Telp: <span className="mono">{order.shipping_phone}</span>
            </p>
          )}
        </div>
      </div>

      {/* ---- Instruksi Pembayaran (PENDING only) ---- */}
      {isPending && (
        <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
          <p className="eyebrow">Instruksi Pembayaran</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)', margin: '0.5rem 0 1rem', lineHeight: 1.5 }}>
            Silakan lakukan pembayaran sebesar{' '}
            <strong style={{ color: 'var(--fg)' }}>{formatRupiah(total)}</strong> ke rekening berikut:
          </p>

          {order.payment_method === 'BANK_TRANSFER' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {BANK_ACCOUNTS.map((bank) => (
                <div
                  key={bank.bank}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: 'var(--bg)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div
                    style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: 'var(--radius-sm)',
                      background: bank.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CreditCard
                      size={18}
                      stroke={bank.color}
                      strokeWidth={2}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{bank.bank}</p>
                    <p className="mono" style={{ fontSize: '0.9rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
                      {bank.account}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{bank.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {order.payment_method === 'COD' && (
            <p style={{ fontSize: '0.9rem', color: 'var(--fg)' }}>Bayar di tempat saat pesanan tiba.</p>
          )}

          {order.payment_method === 'QRIS' && (
            <p style={{ fontSize: '0.9rem', color: 'var(--fg)' }}>Lakukan pembayaran QRIS saat pesanan dikonfirmasi.</p>
          )}

          {order.payment_method === 'BANK_TRANSFER' && (
            <button className="btn btn-outline btn-block" onClick={handleCopy} style={{ marginTop: '1rem' }}>
              <Copy
                size={16}
                style={{ flexShrink: 0 }}
              />
              {copied ? 'Tersalin!' : 'Salin Nomor Rekening'}
            </button>
          )}

          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '1rem', textAlign: 'center' }}>
            Pembayaran akan diverifikasi otomatis dalam waktu 1&times;24 jam.
          </p>
        </div>
      )}

      {/* ---- Tombol Aksi ---- */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        {isPaid ? (
          <Link href="/orders" className="btn btn-primary" style={{ flex: 1 }}>
            Lacak Pesanan
          </Link>
        ) : (
          <Link href="/orders" className="btn btn-outline" style={{ flex: 1 }}>
            Lihat Pesanan
          </Link>
        )}
        <Link href="/" className="btn btn-outline" style={{ flex: 1 }}>
          Kembali Belanja
        </Link>
      </div>
    </div>
  );
}
