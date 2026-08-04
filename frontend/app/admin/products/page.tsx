'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { productsApi, adminApi } from '@/lib/api';
import { formatRupiah } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import ProductImage from '@/components/ProductImage';
import { PageSpinner } from '@/components/Spinner';

const SUGGESTED_CATEGORIES = ['Elektronik', 'Aksesoris', 'Fashion', 'Kesehatan'];
const ACCEPTED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export default function AdminProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [form, setForm] = useState({ name: '', price: '', stock: '', description: '', category: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  /* ---- Image state ---- */
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  /* Collect existing categories for datalist */
  const existingCategories = Array.from(new Set(
    products.map(p => p.category).filter(Boolean)
  ));

  /* ---- Cleanup object URL on unmount / modal close ---- */
  useEffect(() => {
    return () => { if (imagePreview) URL.revokeObjectURL(imagePreview); };
  }, [imagePreview]);

  const openModal = (product?: any) => {
    // Cleanup previous preview
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);

    if (product) {
      setEditingProduct(product);
      setForm({
        name: product.name,
        price: String(product.price),
        stock: String(product.stock),
        description: product.description || '',
        category: product.category || '',
      });
    } else {
      setEditingProduct(null);
      setForm({ name: '', price: '', stock: '', description: '', category: '' });
    }
    setFormError('');
    setShowModal(true);
  };

  const closeModal = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(false);
    setShowModal(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!ACCEPTED_MIMES.includes(file.type)) {
      setFormError('Format gambar harus JPG, PNG, atau WebP.');
      return;
    }
    // Validate size
    if (file.size > MAX_SIZE) {
      setFormError('Ukuran gambar maksimal 5MB.');
      return;
    }

    setFormError('');
    setImageFile(file);
    setRemoveImage(false);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) { setFormError('Nama dan harga wajib diisi'); return; }
    setSaving(true);
    setFormError('');
    try {
      const isEdit = !!editingProduct;
      const url = isEdit ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';
      const body: Record<string, any> = {
        name: form.name,
        price: Number(form.price),
        stock: Number(form.stock || 0),
        description: form.description,
      };
      if (form.category.trim()) {
        body.category = form.category.trim();
      }
      const res = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d?.message || 'Gagal menyimpan'); }
      const savedData = await res.json();
      const productId = savedData?.data?.id || editingProduct?.id;

      // Handle image operations
      if (productId) {
        if (removeImage && editingProduct?.image_url) {
          try { await adminApi.deleteImage(productId); } catch { /* best effort */ }
        } else if (imageFile) {
          try { await adminApi.uploadImage(productId, imageFile); } catch (imgErr: any) {
            setFormError(imgErr?.message || 'Produk tersimpan tapi gagal upload gambar.');
            setSaving(false);
            loadProducts();
            return;
          }
        }
      }

      closeModal();
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
              <tr><th>Gambar</th><th>Nama Produk</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{width:48, height:48, borderRadius:'var(--radius-sm)', overflow:'hidden', background:'var(--ph-bg)'}}>
                      <ProductImage src={p.image_url} alt={p.name} lazy />
                    </div>
                  </td>
                  <td><strong>{p.name}</strong></td>
                  <td>
                    {p.category ? (
                      <span className="badge badge-neutral">{p.category}</span>
                    ) : (
                      <span className="text-muted" style={{fontSize:'0.82rem'}}>-</span>
                    )}
                  </td>
                  <td className="mono">{formatRupiah(p.price)}</td>
                  <td className="mono">{p.stock}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openModal(p)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{color:'var(--danger)'}} onClick={() => handleDelete(p.id)}>Hapus</button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan={6} style={{textAlign:'center', padding:'2rem', color:'var(--muted)'}}>Belum ada produk</td></tr>}
            </tbody>
          </table>
        </div>

        {showModal && (
          <div className="modal-overlay open">
            <div className="modal-content" style={{maxWidth:560}}>
              <div className="modal-header">
                <h4 style={{margin:0}}>{editingProduct ? 'Edit Produk' : 'Tambah Produk'}</h4>
                <button className="modal-close" onClick={closeModal}>x</button>
              </div>
              {formError && <div className="toast toast-error mb-2">{formError}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Nama Produk</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Kategori</label>
                  <input
                    className="form-input"
                    value={form.category}
                    onChange={e => setForm({...form, category: e.target.value})}
                    list="category-list"
                    placeholder="Pilih atau ketik kategori"
                  />
                  <datalist id="category-list">
                    {SUGGESTED_CATEGORIES.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                    {existingCategories
                      .filter(cat => !SUGGESTED_CATEGORIES.includes(cat))
                      .map(cat => (
                        <option key={cat} value={cat} />
                      ))}
                  </datalist>
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

                {/* ---- Image Upload ---- */}
                <div className="form-group">
                  <label className="form-label">Gambar Produk</label>

                  {/* Current image (edit mode) */}
                  {editingProduct?.image_url && !removeImage && !imagePreview && (
                    <div style={{marginBottom:'0.75rem'}}>
                      <div style={{width:120, height:120, borderRadius:'var(--radius-sm)', overflow:'hidden', background:'var(--ph-bg)', border:'1px solid var(--border)'}}>
                        <ProductImage src={editingProduct.image_url} alt={editingProduct.name} />
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" style={{color:'var(--danger)', marginTop:'0.35rem'}} onClick={handleRemoveImage}>
                        Hapus Gambar
                      </button>
                    </div>
                  )}

                  {/* New image preview */}
                  {imagePreview && (
                    <div style={{marginBottom:'0.75rem'}}>
                      <div style={{width:120, height:120, borderRadius:'var(--radius-sm)', overflow:'hidden', background:'var(--ph-bg)', border:'1px solid var(--border)'}}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imagePreview} alt="Preview" style={{width:'100%', height:'100%', objectFit:'cover', display:'block'}} />
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" style={{color:'var(--danger)', marginTop:'0.35rem'}} onClick={handleRemoveImage}>
                        Batal
                      </button>
                    </div>
                  )}

                  {/* Removed state */}
                  {removeImage && editingProduct?.image_url && !imagePreview && (
                    <p style={{fontSize:'0.85rem', color:'var(--danger)', marginBottom:'0.5rem'}}>
                      Gambar akan dihapus saat disimpan.
                    </p>
                  )}

                  {/* File input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileSelect}
                    style={{fontSize:'0.85rem'}}
                  />
                  <p className="text-muted" style={{fontSize:'0.78rem', marginTop:'0.25rem'}}>
                    Format: JPG, PNG, WebP. Maksimal 5MB.
                  </p>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={closeModal}>Batal</button>
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
