'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { productsApi, flashsaleApi, cartApi } from '@/lib/api';
import { formatRupiah } from '@/lib/utils';
import CountdownTimer from '@/components/CountdownTimer';
import ProductImage from '@/components/ProductImage';
import { PageSpinner } from '@/components/Spinner';

function discountPercent(original: number, discounted: number): number {
  if (!original || original <= 0 || !discounted || discounted >= original) return 0;
  return Math.round((1 - discounted / original) * 100);
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [flashData, setFlashData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      if (!params.id) return;
      try {
        const res: any = await productsApi.get(params.id as string);
        setProduct(res?.data || res);
      } catch { setError('Produk tidak ditemukan'); }
      try {
        const res: any = await flashsaleApi.active();
        const items = res?.data?.products || res?.data || res || [];
        const list = Array.isArray(items) ? items : [];
        const match = list.find((p: any) => String(p.id) === String(params.id));
        if (match) setFlashData(match);
      } catch { /* no flash */ }
      setLoading(false);
    })();
  }, [params.id]);

  const handleAddToCart = async () => {
    if (!product) return;
    setAddingToCart(true);
    try {
      await cartApi.addItem(product.id, 1);
      window.dispatchEvent(new Event('cart-updated'));
      router.push('/cart');
    } catch (err: any) {
      setError(err?.message || 'Gagal menambahkan ke keranjang');
    }
    setAddingToCart(false);
  };

  if (loading) return <PageSpinner />;
  if (!product) {
    return (
      <div className="page">
        <div className="container">
          <div className="empty-state">
            <h3>{error || 'Produk tidak ditemukan'}</h3>
            <Link href="/" className="btn btn-primary">Kembali ke Beranda</Link>
          </div>
        </div>
      </div>
    );
  }

  // Flash data can come from flashData (active sale) or product fields directly
  const isFlash = !!(flashData || (product.is_flash_sale && product.flash_sale_price));
  const flashPrice = flashData?.flash_sale_price || product.flash_sale_price;
  const originalPrice = product.price;
  const displayPrice = isFlash && flashPrice ? flashPrice : originalPrice;
  const discountPct = isFlash && flashPrice ? discountPercent(originalPrice, flashPrice) : 0;

  // Stock: use flash_sale_stock if available, else product.stock
  const flashStock = flashData?.flash_sale_stock ?? product.flash_sale_stock ?? null;
  const regularStock = product.stock;
  const showFlashStock = isFlash && flashStock != null;

  // Flash sale end time
  const flashEnd = flashData?.flash_sale_end || product.flash_sale_end;
  const flashEndDate = flashEnd ? new Date(flashEnd) : null;

  const isOutOfStock = isFlash
    ? (showFlashStock ? flashStock <= 0 : regularStock <= 0)
    : regularStock <= 0;

  // Stock bar percentage
  const stockForBar = showFlashStock ? flashStock : regularStock;
  const maxForBar = showFlashStock
    ? Math.max(flashStock, regularStock || 0)
    : 50;
  const stockPct = maxForBar > 0 ? Math.min((stockForBar / maxForBar) * 100, 100) : 0;

  return (
    <>
      {/* Breadcrumb */}
      <div className="container">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link> &#8250; <Link href="/">Produk</Link> &#8250; <span>{product.name}</span>
        </nav>
      </div>

      {/* Product Detail */}
      <section className="page">
        <div className="container">
          <div className="product-detail">
            <div className="product-gallery">
              <ProductImage src={product.image_url} alt={product.name} />
            </div>

            <div className="product-info">
              {/* Badges row */}
              <div style={{display:'flex', alignItems:'center', gap:'0.4rem', flexWrap:'wrap', marginBottom:'0.75rem'}}>
                {isFlash && <span className="badge badge-danger">FLASH SALE</span>}
                {discountPct > 0 && (
                  <span className="badge badge-danger" style={{fontSize:'0.75rem', padding:'0.15rem 0.55rem'}}>
                    Hemat {discountPct}%
                  </span>
                )}
                {isOutOfStock && !isFlash && <span className="badge badge-neutral">STOK HABIS</span>}
              </div>

              {/* Category */}
              {product.category && (
                <p style={{fontSize:'0.82rem', color:'var(--muted)', marginBottom:'0.5rem', textTransform:'capitalize'}}>
                  {product.category}
                </p>
              )}

              <h1>{product.name}</h1>

              {/* Prices */}
              <div className="product-prices">
                <span className="price-current" style={isFlash ? {color:'var(--danger)'} : {color:'var(--fg)'}}>
                  {formatRupiah(displayPrice)}
                </span>
                {isFlash && originalPrice && (
                  <span className="price-original">{formatRupiah(originalPrice)}</span>
                )}
              </div>

              {/* Countdown */}
              {isFlash && flashEndDate && (
                <div className="mb-2">
                  <p className="countdown-label">Berakhir dalam:</p>
                  <CountdownTimer targetDate={flashEndDate} />
                </div>
              )}

              {/* Stock Bar */}
              <div className="mb-2">
                {isFlash ? (
                  <>
                    {showFlashStock ? (
                      <>
                        <div className="stock-bar">
                          <div
                            className={`stock-bar-fill ${stockPct < 30 ? 'danger' : stockPct < 60 ? 'warning' : ''}`}
                            style={{width:`${stockPct}%`}}
                          />
                        </div>
                        <p className="stock-text">
                          {flashStock <= 0
                            ? 'Stok flash sale habis'
                            : `Sisa ${flashStock} dari ${maxForBar}`}
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="stock-bar">
                          <div
                            className={`stock-bar-fill ${regularStock < 10 ? 'danger' : regularStock < 30 ? 'warning' : ''}`}
                            style={{width:`${Math.min(regularStock / 50 * 100, 100)}%`}}
                          />
                        </div>
                        <p className="stock-text">
                          {regularStock <= 0
                            ? 'Stok habis'
                            : `Stok tersedia: ${regularStock}`}
                        </p>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="stock-bar">
                      <div
                        className={`stock-bar-fill ${regularStock < 10 ? 'danger' : regularStock < 30 ? 'warning' : ''}`}
                        style={{width:`${Math.min(regularStock / 50 * 100, 100)}%`}}
                      />
                    </div>
                    <p className="stock-text">
                      {isOutOfStock
                        ? 'Stok habis - produk ini sudah tidak tersedia'
                        : `Stok tersedia: ${regularStock}`}
                    </p>
                  </>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <p className="product-desc">{product.description}</p>
              )}

              {/* Add to cart / Buy */}
              {isOutOfStock ? (
                <button className="btn btn-primary btn-lg btn-block" disabled style={{background:'var(--disabled-bg)', borderColor:'var(--disabled-bg)', color:'var(--disabled-fg)', pointerEvents:'none', marginBottom:'1.25rem'}}>
                  Stok Habis
                </button>
              ) : isFlash ? (
                <button
                  className={`btn btn-danger btn-lg btn-block ${addingToCart ? 'loading' : ''}`}
                  disabled={addingToCart}
                  onClick={handleAddToCart}
                  style={{marginBottom:'1.25rem'}}
                >
                  <span className="spinner"></span>
                  <span className="btn-text">Beli Flash Sale</span>
                </button>
              ) : (
                <button
                  className={`btn btn-primary btn-lg btn-block ${addingToCart ? 'loading' : ''}`}
                  disabled={addingToCart}
                  onClick={handleAddToCart}
                  style={{marginBottom:'1.25rem'}}
                >
                  <span className="spinner"></span>
                  <span className="btn-text">Tambah ke Keranjang</span>
                </button>
              )}

              {error && (
                <div className="toast toast-error mb-2">{error}</div>
              )}

              <p className="stock-text" style={{fontSize:'0.85rem', color:'var(--muted)'}}>
                Pengiriman: Estimasi 2-3 hari &#8226; Garansi: 1 Tahun
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
