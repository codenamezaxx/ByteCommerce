'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { productsApi, flashsaleApi } from '@/lib/api';
import { CATEGORIES } from '@/lib/categories';
import { formatRupiah } from '@/lib/utils';
import CountdownTimer from '@/components/CountdownTimer';
import ProductImage from '@/components/ProductImage';
import PhantomSkeleton from '@/components/PhantomSkeleton';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Product {
  id: number;
  name: string;
  price: number;
  flash_price?: number;
  stock: number;
  category?: string;
  image_url?: string | null;
  flash_sale?: boolean;
  is_flash_sale?: boolean;
  flash_sale_price?: number | null;
  flash_sale_stock?: number | null;
  flash_sale_start?: string | null;
  flash_sale_end?: string | null;
  description?: string;
}

/* ------------------------------------------------------------------ */
/*  Helper: discount badge                                             */
/* ------------------------------------------------------------------ */
function discountPercent(original: number, discounted: number): number {
  if (!original || original <= 0 || !discounted || discounted >= original) return 0;
  return Math.round((1 - discounted / original) * 100);
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
// useSearchParams() requires a Suspense boundary for static prerender.
export default function HomePage() {
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

/* SSR-safe skeleton grid — phantom-ui cannot render pre-hydration, so the
   Suspense fallback uses static placeholder blocks instead of a spinner. */
function ProductGridSkeleton() {
  return (
    <section className="page" id="rekomendasi">
      <div className="container">
        <p className="eyebrow">PRODUK PILIHAN</p>
        <h2 style={{ marginBottom: '1.5rem' }}>Rekomendasi Untukmu</h2>
        <div className="product-grid" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="product-card" style={{ cursor: 'default' }}>
              <div className="ph-img" />
              <div className="product-card-body">
                <div className="ph-skeleton-block" style={{ height: '1rem', width: '85%', marginBottom: '0.5rem' }} />
                <div className="ph-skeleton-block" style={{ height: '0.8rem', width: '55%', marginBottom: '0.75rem' }} />
                <div className="ph-skeleton-block" style={{ height: '1.1rem', width: '40%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HomeContent() {
  /* ---- flash sale ---- */
  const [flashProducts, setFlashProducts] = useState<Product[]>([]);
  const [flashSaleStart, setFlashSaleStart] = useState<Date | null>(null);
  const [flashSaleEnd, setFlashSaleEnd] = useState<Date | null>(null);

  /* ---- category counts ---- */
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  /* ---- regular products (infinite scroll) ---- */
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const paramsProcessedRef = useRef(false);

  /* ================================================================
     1. Flash sale + category counts (run once)
     ================================================================ */
  // Muat (ulang) sesi flash sale. Dipanggil saat mount DAN ketika countdown
  // berakhir: sesi yang selesai → API mengembalikan kosong → produk flash
  // sale dihapus dari beranda dan badge kembali "SEGERA HADIR".
  const loadFlashSale = useCallback(async () => {
    try {
      const res: any = await flashsaleApi.active();
      const items = res?.data?.products || res?.data || res || [];
      if (Array.isArray(items) && items.length > 0) {
        setFlashProducts(items);
        const starts = items
          .map((p: any) => new Date(p.flash_sale_start))
          .filter((d: Date) => !isNaN(d.getTime()));
        const ends = items
          .map((p: any) => new Date(p.flash_sale_end || p.end_time || p.end_at))
          .filter((d: Date) => !isNaN(d.getTime()));
        setFlashSaleStart(starts.length > 0 ? new Date(Math.min(...starts.map(d => d.getTime()))) : null);
        setFlashSaleEnd(ends.length > 0 ? new Date(Math.min(...ends.map(d => d.getTime()))) : null);
      } else {
        setFlashProducts([]);
        setFlashSaleStart(null);
        setFlashSaleEnd(null);
      }
    } catch {
      setFlashProducts([]);
      setFlashSaleStart(null);
      setFlashSaleEnd(null);
    }
  }, []);

  useEffect(() => {
    loadFlashSale();

    // Fetch all products once to compute category counts
    (async () => {
      try {
        const res: any = await productsApi.list({ limit: 100 });
        const data = res?.data || res;
        const allProducts: Product[] = data?.products || data || [];
        const counts: Record<string, number> = {};
        for (const p of allProducts) {
          const cat = p.category || 'Lainnya';
          counts[cat] = (counts[cat] || 0) + 1;
        }
        setCategoryCounts(counts);
      } catch { /* ignore */ }
    })();
  }, []);

  /* ================================================================
     2. Regular products – fetch helper (supports category filter)
     ================================================================ */
  const fetchProducts = useCallback(async (targetPage: number, query: string, category: string | null, append: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = {
        page: targetPage,
        limit: 8,
        search: query || undefined,
        category: category || undefined,
      };
      const res: any = await productsApi.list(params);
      const data = res?.data || res;
      const list: Product[] = data?.products || data || [];
      const apiPages: number = data?.totalPages ?? 1;

      if (append) {
        setProducts(prev => [...prev, ...list]);
      } else {
        setProducts(list);
      }
      setHasMore(targetPage < apiPages);
    } catch { /* ignore */ }
    setLoading(false);
    loadingRef.current = false;
  }, []);

  /* Initial load + page change */
  useEffect(() => {
    fetchProducts(page, search, activeCategory, page > 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, activeCategory]);

  /* ================================================================
     3. Infinite scroll – IntersectionObserver
     ================================================================ */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          setPage(prev => prev + 1);
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, products.length]);

  /* ================================================================
     3b. Navigation params handler (from navbar cross-page navigation)
     ================================================================ */
  useEffect(() => {
    const flashSale = searchParams.get('flash_sale');
    const category = searchParams.get('category');
    const scroll = searchParams.get('scroll');

    const hasParams = !!(flashSale || category || scroll);
    if (!hasParams) {
      paramsProcessedRef.current = false;
      return;
    }
    if (paramsProcessedRef.current) return;
    paramsProcessedRef.current = true;

    /* -- Flash Sale scroll -- */
    if (flashSale === '1') {
      setTimeout(() => {
        const el = document.getElementById('produk') || document.getElementById('rekomendasi');
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
      router.replace('/', { scroll: false });
      return;
    }

    /* -- Category / Produk Rekomendasi -- */
    if (scroll === 'rekomendasi') {
      const targetCategory = category || null;

      if (targetCategory !== activeCategory) {
        setActiveCategory(targetCategory);
        setSearch('');
        setPage(1);
        setProducts([]);
        setHasMore(true);
        loadingRef.current = false;
      } else if (page !== 1) {
        setPage(1);
        setProducts([]);
        setHasMore(true);
        loadingRef.current = false;
      }

      setTimeout(() => {
        document.getElementById('rekomendasi')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);

      router.replace('/', { scroll: false });
    }
  }, [searchParams, router, activeCategory, page]);

  /* ================================================================
     4. Search handler
     ================================================================ */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setProducts([]);
    setHasMore(true);
    loadingRef.current = false;
    fetchProducts(1, search, activeCategory, false);
  };

  /* ================================================================
     5. Category filter handler
     ================================================================ */
  const handleCategoryClick = (catLabel: string) => {
    // Toggle: if already active, deactivate
    const newCat = activeCategory === catLabel ? null : catLabel;
    setActiveCategory(newCat);
    setSearch('');
    setPage(1);
    setProducts([]);
    setHasMore(true);
    loadingRef.current = false;
    fetchProducts(1, '', newCat, false);
    // Scroll to products
    setTimeout(() => {
      document.getElementById('rekomendasi')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const clearCategory = () => {
    setActiveCategory(null);
    setPage(1);
    setProducts([]);
    setHasMore(true);
    loadingRef.current = false;
    fetchProducts(1, search, null, false);
  };

  const scrollToProducts = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.getElementById('produk') || document.getElementById('rekomendasi');
    target?.scrollIntoView({ behavior: 'smooth' });
  };

  /* ================================================================
     JSX
     ================================================================ */
  return (
    <>
      {/* ============================================================
          HERO with background image + dark-mode-aware overlay
          ============================================================ */}
      <section className="hero">
        <div className="hero-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1600&q=80"
            alt=""
            className="hero-bg-img"
            loading="eager"
          />
          <div className="hero-bg-overlay" />
        </div>

        <div className="hero-content">
          <p className="eyebrow" style={{ color: '#94A3B8', marginBottom: '0.75rem' }}>
            FLASH SALE
            {!flashSaleEnd || (flashSaleStart && flashSaleStart.getTime() > Date.now()) ? ' - SEGERA HADIR' : ''}
          </p>
          <h1>Flash Sale ByteCommerce</h1>
          <p>Produk diskon terbatas. Stok setiap item terbatas.</p>
          {flashSaleStart && flashSaleStart.getTime() > Date.now() ? (
            <>
              <CountdownTimer
                targetDate={flashSaleStart}
                showLabels
                size="lg"
                onEnd={() => { setFlashSaleStart(null); loadFlashSale(); }}
              />
              <div style={{ height: '1.5rem' }} />
            </>
          ) : flashSaleEnd ? (
            <>
              <CountdownTimer
                targetDate={flashSaleEnd}
                showLabels
                size="lg"
                onEnd={() => { setFlashSaleEnd(null); loadFlashSale(); }}
              />
              <div style={{ height: '1.5rem' }} />
            </>
          ) : null}
          <a href="#rekomendasi" className="btn btn-primary btn-lg" onClick={scrollToProducts}>
            Lihat Produk
          </a>
        </div>
      </section>

      {/* ============================================================
          KATEGORI
          ============================================================ */}
      <section className="page">
        <div className="container">
          <p className="eyebrow">KATEGORI</p>
          <h2>Jelajahi Kategori</h2>

          <div className="category-grid">
            {CATEGORIES.map(cat => {
              const count = categoryCounts[cat.label] || 0;
              const isActive = activeCategory === cat.label;
              return (
                <a
                  key={cat.label}
                  href="#rekomendasi"
                  className={`card category-card${isActive ? ' category-card-active' : ''}`}
                  onClick={(e) => { e.preventDefault(); handleCategoryClick(cat.label); }}
                >
                  <div className="category-card-icon">{cat.icon}</div>
                  <h4>{cat.label}</h4>
                  <p className="text-muted category-card-count">
                    {count > 0 ? `${count} produk` : 'Semua'}
                  </p>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================
          PRODUK FLASH SALE
          ============================================================ */}
      {flashProducts.length > 0 && (
        <section className="page" id="produk" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-header">
              <h2>Produk Flash Sale</h2>
            </div>
            <div className="product-grid">
              {flashProducts.map((p: any) => {
                const flashPrice = p.flash_sale_price || p.flash_price || p.price;
                const originalPrice = p.price;
                const flashStock = p.flash_sale_stock ?? p.flash_stock ?? p.stock;
                const maxStock = p.flash_sale_stock != null
                  ? Math.max(p.flash_sale_stock, p.stock || 0)
                  : (p.flash_sale_max_stock ?? p.flash_max_stock ?? 50);
                const stockPct = maxStock > 0 ? (flashStock / maxStock * 100) : 0;
                const pctOff = discountPercent(originalPrice, flashPrice);
                return (
                  <Link key={p.id} href={`/products/${p.id}`} className="product-card">
                    <ProductImage src={p.image_url} alt={p.name} lazy />
                    <div className="product-card-body">
                      <div style={{display:'flex', alignItems:'center', gap:'0.35rem', marginBottom:'0.5rem', flexWrap:'wrap'}}>
                        <span className="badge badge-danger">FLASH SALE</span>
                        {pctOff > 0 && (
                          <span className="badge badge-danger" style={{fontSize:'0.7rem', padding:'0.12rem 0.45rem'}}>
                            -{pctOff}%
                          </span>
                        )}
                      </div>
                      <h3>{p.name}</h3>
                      {p.category && (
                        <span className="text-muted" style={{fontSize:'0.78rem', display:'block', marginBottom:'0.35rem'}}>
                          {p.category}
                        </span>
                      )}
                      <div className="product-meta">
                        <div>
                          <span className="product-price mono" style={{ color: 'var(--danger)' }}>
                            {formatRupiah(flashPrice)}
                          </span>
                          {originalPrice && (
                            <span className="price-original">{formatRupiah(originalPrice)}</span>
                          )}
                        </div>
                      </div>
                      {flashStock != null && maxStock > 0 && (
                        <>
                          <div className="stock-bar" style={{ marginTop: '0.75rem' }}>
                            <div
                              className={`stock-bar-fill ${stockPct < 30 ? 'danger' : stockPct < 60 ? 'warning' : ''}`}
                              style={{ width: `${stockPct}%` }}
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

      {/* ============================================================
          PRODUK REKOMENDASI – infinite scroll + category filter
          ============================================================ */}
      <section
        className="page"
        style={{ paddingTop: flashProducts.length > 0 ? 0 : undefined }}
        id="rekomendasi"
      >
        <div className="container">
          <p className="eyebrow">PRODUK PILIHAN</p>
          <h2 style={{ marginBottom: '1.5rem' }}>Rekomendasi Untukmu</h2>

          {/* Search + active category chip */}
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
            {activeCategory && (
              <span className="category-chip" style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.4rem 0.75rem', borderRadius: '999px',
                background: 'var(--accent-soft)', color: 'var(--accent)',
                fontSize: '0.82rem', fontWeight: 600,
              }}>
                {activeCategory}
                <button
                  type="button"
                  onClick={clearCategory}
                  style={{
                    background: 'none', border: 'none', color: 'var(--accent)',
                    cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 0,
                  }}
                  aria-label={`Hapus filter ${activeCategory}`}
                >
                  &times;
                </button>
              </span>
            )}
          </form>

          {/* Initial loading skeleton — phantom-ui measures the template
              structure below to align shimmer blocks with real card layout */}
          {loading && products.length === 0 ? (
            <PhantomSkeleton loading animation="shimmer" reveal={0.3} stagger={0.03} loading-label="Memuat produk">
              <div className="product-grid" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="product-card" style={{ cursor: 'default' }}>
                    <div className="ph-img" />
                    <div className="product-card-body">
                      <div className="ph-skeleton-block" style={{ height: '1rem', width: '85%', marginBottom: '0.5rem' }} />
                      <div className="ph-skeleton-block" style={{ height: '0.8rem', width: '55%', marginBottom: '0.75rem' }} />
                      <div className="ph-skeleton-block" style={{ height: '1.1rem', width: '40%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </PhantomSkeleton>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <h3>Produk tidak ditemukan</h3>
              <p>Coba kata kunci pencarian lain atau ubah filter kategori.</p>
            </div>
          ) : (
            <>
              <div className="product-grid">
                {products.map(p => {
                  const isFlash = p.is_flash_sale || p.flash_sale;
                  const flashPrice = p.flash_sale_price;
                  const originalPrice = p.price;
                  const displayPrice = isFlash && flashPrice ? flashPrice : originalPrice;
                  const pctOff = isFlash && flashPrice ? discountPercent(originalPrice, flashPrice) : 0;
                  return (
                    <Link key={p.id} href={`/products/${p.id}`} className="product-card">
                      <ProductImage src={p.image_url} alt={p.name} lazy />
                      <div className="product-card-body">
                        {isFlash && (
                          <div style={{display:'flex', alignItems:'center', gap:'0.35rem', marginBottom:'0.5rem', flexWrap:'wrap'}}>
                            <span className="badge badge-danger">FLASH SALE</span>
                            {pctOff > 0 && (
                              <span className="badge badge-danger" style={{fontSize:'0.7rem', padding:'0.12rem 0.45rem'}}>
                                -{pctOff}%
                              </span>
                            )}
                          </div>
                        )}
                        <h3>{p.name}</h3>
                        {p.category && (
                          <span className="text-muted" style={{fontSize:'0.78rem', display:'block', marginBottom:'0.35rem'}}>
                            {p.category}
                          </span>
                        )}
                        <div className="product-meta">
                          <span className="product-price mono" style={isFlash && flashPrice ? {color:'var(--danger)'} : {}}>
                            {formatRupiah(displayPrice)}
                          </span>
                          {isFlash && flashPrice && originalPrice && (
                            <span className="price-original">{formatRupiah(originalPrice)}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Sentinel for infinite scroll */}
              <div ref={sentinelRef} style={{ height: 1 }} />

              {/* Loading more indicator */}
              {loading && products.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                  <div className="spinner" />
                </div>
              )}

              {/* End of list */}
              {!hasMore && products.length > 0 && (
                <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '1.5rem 0 0' }}>
                  Semua produk sudah ditampilkan.
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
