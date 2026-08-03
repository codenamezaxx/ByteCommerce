'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { productsApi, flashsaleApi } from '@/lib/api';
import { formatRupiah } from '@/lib/utils';
import CountdownTimer from '@/components/CountdownTimer';
import { PageSpinner } from '@/components/Spinner';

interface Product {
  id: number;
  name: string;
  price: number;
  flash_price?: number;
  stock: number;
  flash_sale?: boolean;
  flash_sale_price?: number;
  flash_sale_stock?: number;
  flash_sale_start?: string;
  flash_sale_end?: string;
  description?: string;
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [flashProducts, setFlashProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [flashSaleEnd, setFlashSaleEnd] = useState<Date | null>(null);

  // Load flash sale products
  useEffect(() => {
    (async () => {
      try {
        const res: any = await flashsaleApi.active();
        const items = res?.data || res || [];
        if (Array.isArray(items) && items.length > 0) {
          setFlashProducts(items);
          // Find the earliest end time
          const ends = items.map((p: any) => new Date(p.flash_sale_end || p.end_time || p.end_at)).filter((d: Date) => !isNaN(d.getTime()));
          if (ends.length > 0) {
            const earliest = new Date(Math.min(...ends.map(d => d.getTime())));
            setFlashSaleEnd(earliest);
          }
        }
      } catch { /* no flash sale active */ }
    })();
  }, []);

  // Load regular products
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await productsApi.list({ page, limit: 8, search: search || undefined });
      const data = res?.data || res;
      setProducts(data?.products || data || []);
      setTotalPages(data?.totalPages || 1);
    } catch { /* ignore */ }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadProducts();
  };

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow" style={{color:'#94A3B8', marginBottom:'0.75rem'}}>
            FLASH SALE
            {flashSaleEnd ? '' : ' - SEGERA HADIR'}
          </p>
          <h1>Flash Sale ByteCommerce</h1>
          <p>Produk diskon terbatas. Stok setiap item terbatas.</p>
          {flashSaleEnd && (
            <>
              <CountdownTimer targetDate={flashSaleEnd} showLabels size="lg" />
              <div style={{height:'1.5rem'}} />
            </>
          )}
          <a href="#produk" className="btn btn-primary btn-lg">Lihat Produk</a>
        </div>
      </section>

      {/* Flash Sale Products */}
      {flashProducts.length > 0 && (
        <section className="page" id="produk" style={{paddingTop:0}}>
          <div className="container">
            <div className="section-header">
              <h2>Produk Flash Sale</h2>
            </div>
            <div className="product-grid">
              {flashProducts.map((p: any) => {
                const flashPrice = p.flash_price || p.flash_sale_price || p.price;
                const originalPrice = p.price || p.original_price;
                const flashStock = p.flash_sale_stock ?? p.flash_stock ?? p.stock;
                const maxStock = p.flash_sale_max_stock ?? p.flash_max_stock ?? 50;
                const stockPct = maxStock > 0 ? (flashStock / maxStock * 100) : 0;
                return (
                  <Link key={p.id} href={`/products/${p.id}`} className="product-card">
                    <div className="ph-img">Gambar Produk</div>
                    <div className="product-card-body">
                      <span className="badge badge-danger" style={{marginBottom:'0.5rem'}}>FLASH SALE</span>
                      <h3>{p.name}</h3>
                      <div className="product-meta">
                        <div>
                          <span className="product-price mono" style={{color:'var(--danger)'}}>{formatRupiah(flashPrice)}</span>
                          {originalPrice && <span className="price-original">{formatRupiah(originalPrice)}</span>}
                        </div>
                      </div>
                      {flashStock !== undefined && maxStock > 0 && (
                        <>
                          <div className="stock-bar" style={{marginTop:'0.75rem'}}>
                            <div
                              className={`stock-bar-fill ${stockPct < 30 ? 'danger' : stockPct < 60 ? 'warning' : ''}`}
                              style={{width:`${stockPct}%`}}
                            />
                          </div>
                          <p className="stock-text">Sisa {flashStock} dari {maxStock}</p>
                        </>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Regular Products */}
      <section className="page" style={{paddingTop: flashProducts.length > 0 ? 0 : undefined}} id={flashProducts.length > 0 ? undefined : 'produk'}>
        <div className="container">
          <p className="eyebrow">PRODUK PILIHAN</p>
          <h2 style={{marginBottom:'1.5rem'}}>Rekomendasi Untukmu</h2>

          {/* Search & Filter */}
          <form className="filter-bar" onSubmit={handleSearch}>
            <input
              type="text"
              className="form-input"
              placeholder="Cari produk..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Cari produk"
            />
            <button type="submit" className="btn btn-outline">Cari</button>
          </form>

          {loading ? (
            <PageSpinner />
          ) : products.length === 0 ? (
            <div className="empty-state">
              <h3>Produk tidak ditemukan</h3>
              <p>Coba kata kunci pencarian lain.</p>
            </div>
          ) : (
            <>
              <div className="product-grid">
                {products.map(p => {
                  const price = p.flash_sale && p.flash_sale_price ? p.flash_sale_price : p.price;
                  return (
                    <Link key={p.id} href={`/products/${p.id}`} className="product-card">
                      <div className="ph-img">Gambar Produk</div>
                      <div className="product-card-body">
                        {p.flash_sale && <span className="badge badge-danger" style={{marginBottom:'0.5rem'}}>FLASH SALE</span>}
                        <h3>{p.name}</h3>
                        <div className="product-meta">
                          <span className="product-price mono">{formatRupiah(price)}</span>
                          {p.flash_sale && p.flash_sale_price && p.price && (
                            <span className="price-original">{formatRupiah(p.price)}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    &lsaquo;
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} className={`pagination-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>
                      {p}
                    </button>
                  ))}
                  <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    &rsaquo;
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
