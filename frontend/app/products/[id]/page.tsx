'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { productsApi, flashsaleApi, cartApi } from '@/lib/api';
import { formatRupiah } from '@/lib/utils';
import CountdownTimer from '@/components/CountdownTimer';
import { PageSpinner } from '@/components/Spinner';

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
        const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const match = items.find((p: any) => String(p.id) === String(params.id));
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

  const isFlash = !!flashData;
  const flashPrice = flashData?.flash_price || flashData?.flash_sale_price || product.flash_sale_price;
  const price = isFlash && flashPrice ? flashPrice : product.price;
  const originalPrice = product.price;
  const flashStock = flashData?.flash_sale_stock ?? flashData?.flash_stock ?? product.stock;
  const maxStock = flashData?.flash_sale_max_stock ?? flashData?.flash_max_stock ?? 50;
  const stockPct = maxStock > 0 ? (flashStock / maxStock * 100) : (product.stock > 0 ? 50 : 0);
  const isOutOfStock = isFlash ? flashStock <= 0 : product.stock <= 0;
  const discountPct = isFlash && flashPrice && originalPrice ? Math.round((1 - flashPrice / originalPrice) * 100) : 0;

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
              <div className="ph-img">Gambar Produk</div>
            </div>

            <div className="product-info">
              {isFlash && <span className="badge badge-danger">FLASH SALE</span>}
              {isOutOfStock && !isFlash && <span className="badge badge-neutral">STOK HABIS</span>}
              <h1>{product.name}</h1>

              {/* Prices */}
              <div className="product-prices">
                <span className="price-current" style={isFlash ? {color:'var(--danger)'} : {color:'var(--fg)'}}>
                  {formatRupiah(price)}
                </span>
                {isFlash && originalPrice && (
                  <>
                    <span className="price-original">{formatRupiah(originalPrice)}</span>
                    {discountPct > 0 && (
                      <span className="badge badge-success" style={{fontSize:'0.7rem', padding:'0.15rem 0.5rem'}}>
                        Hemat {discountPct}%
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Countdown */}
              {isFlash && flashData?.flash_sale_end && (
                <div className="mb-2">
                  <p className="countdown-label">Berakhir dalam:</p>
                  <CountdownTimer targetDate={new Date(flashData.flash_sale_end)} />
                </div>
              )}

              {/* Stock Bar */}
              <div className="mb-2">
                {isFlash ? (
                  <>
                    <div className="stock-bar">
                      <div
                        className={`stock-bar-fill ${stockPct < 30 ? 'danger' : stockPct < 60 ? 'warning' : ''}`}
                        style={{width:`${stockPct}%`}}
                      />
                    </div>
                    <p className="stock-text">
                      {isOutOfStock
                        ? 'Stok habis - produk ini sudah tidak tersedia'
                        : `Sisa ${flashStock} dari ${maxStock}`}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="stock-bar">
                      <div
                        className={`stock-bar-fill ${product.stock < 10 ? 'danger' : product.stock < 30 ? 'warning' : ''}`}
                        style={{width:`${Math.min(product.stock / 50 * 100, 100)}%`}}
                      />
                    </div>
                    <p className="stock-text">
                      {isOutOfStock
                        ? 'Stok habis - produk ini sudah tidak tersedia'
                        : `Stok tersedia: ${product.stock}`}
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
