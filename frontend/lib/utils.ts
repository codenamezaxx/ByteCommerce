// Utility helpers for ByteCommerce frontend

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }) + ' WIB';
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n);
}

export function getStatusBadge(status: string): string {
  switch (status?.toUpperCase()) {
    case 'PAID':
    case 'SUCCESS':
      return 'badge-success';
    case 'FAILED':
    case 'OUT_OF_STOCK':
    case 'CANCELLED':
      return 'badge-danger';
    case 'PENDING':
    case 'PROCESSING':
      return 'badge-warning';
    default:
      return 'badge-neutral';
  }
}

export function getStatusLabel(status: string): string {
  switch (status?.toUpperCase()) {
    case 'PAID':
    case 'SUCCESS':
      return 'Lunas';
    case 'FAILED':
      return 'Gagal';
    case 'OUT_OF_STOCK':
      return 'Stok Habis';
    case 'CANCELLED':
      return 'Dibatalkan';
    case 'PENDING':
      return 'Menunggu';
    case 'PROCESSING':
      return 'Diproses';
    default:
      return status || '-';
  }
}

export function calcTimeLeft(targetDate: Date) {
  const diff = targetDate.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    total: diff,
  };
}

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatInvoiceId(order: { id?: string | number; created_at?: string; createdAt?: string }): string {
  const id = order.id ?? 0;
  const padded = String(id).padStart(4, '0');
  const dateStr = order.created_at || order.createdAt;
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `INV/BC/${yyyy}${mm}${dd}/${padded}`;
    }
  }
  return `INV/BC/${padded}`;
}
