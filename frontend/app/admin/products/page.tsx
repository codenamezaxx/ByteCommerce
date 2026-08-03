'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { productsApi } from '@/lib/api';
import { formatRupiah } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { PageSpinner } from '@/components/Spinner';

export default function AdminProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [form, setForm] = useState({ name: '', price: '', stock: '', description: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) router.push('/');
  }, [user, authLoading, router]);

  const loadProducts = async () => {
    try {
      const res: any = await productsApi.list({ limit: 50 });
      const data = res?.data || res;
      setProducts(data?.products || data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { if (user?.role === 'admin') loadProducts(); }, [user]);

  const openModal = (product?: any) => {
    if (product) {
      setEditingProduct(product);
      setForm({ name: product.name, price: String(product.price), stock: String(product.stock), description: product.description || '' });
    } else {
      setEditingProduct(null);
      setForm({ name: '', price: '', stock: '', description: '' });
    }
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) { setFormError('Nama dan harga wajib diisi'); return; }
    setSaving(true);
    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, price: Number(form.price), stock: Number(form.stock || 0), description: form.description }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d?.message || 'Gagal menyimpan'); }
      setShowModal(false);
      loadProducts();
    } catch (err: any) { setFormError(err?.message || 'Gagal menyimpan'); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus produk ini?')) return;
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE', credentials: 'include' });
      loadProducts();
    } catch { /* ignore */ }
  };

  if (authLoading || loading) return <PageSpinner />;
  if (!user || user.role !== 'admin') return null;

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
            <li><Link href="/admin" className="sidebar-link">Dashboard</Link></li>
            <li><Link href="/admin/products" className={`sidebar-link ${pathname === '/admin/products' ? 'active' : ''}`}>Produk</Link></li>
            <li><Link href="/admin/flashsale" className="sidebar-link">Flash Sale</Link></li>
          </ul>
        </nav>
        <div className="sidebar-divider"></div>
        <div style={{padding:'0 0.75rem'}}><Link href="/" className="btn btn-ghost btn-block" style={{fontSize:'0.85rem'}}>Kembali ke Toko</Link></div>
        <div className="sidebar-footer"></div>
      </aside>

      <main className="admin-main">
        <section className="section-header" style={{marginBottom:'2rem'}}>
          <h1>Manajemen Produk</h1>
          <button className="btn btn-primary" onClick={() => openModal()}>+ Tambah Produk</button>
        </section>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Nama Produk</th><th>Harga</th><th>Stok</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td className="mono">{formatRupiah(p.price)}</td>
                  <td className="mono">{p.stock}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openModal(p)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={() => handleDelete(p.id)}>Hapus</button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan={4} style={{textAlign:'center', padding:'2rem', color:'var(--muted)'}}>Belum ada produk</td></tr>}
            </tbody>
          </table>
        </div>

        {showModal && (
          <div className="modal-overlay open">
            <div className="modal-content">
              <div className="modal-header">
                <h4 style={{margin:0}}>{editingProduct ? 'Edit Produk' : 'Tambah Produk'}</h4>
                <button className="modal-close" onClick={() => setShowModal(false)}>x</button>
              </div>
              {formError && <div className="toast toast-error mb-2">{formError}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Nama Produk</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Harga (Rp)</label>
                  <input className="form-input" type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Stok</label>
                  <input className="form-input" type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Deskripsi</label>
                  <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
                  <button type="submit" className={`btn btn-primary ${saving ? 'loading' : ''}`} disabled={saving}>
                    <span className="spinner"></span>
                    <span className="btn-text">Simpan</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
