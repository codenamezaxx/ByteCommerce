'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback, useRef } from 'react';
import { cartApi } from '@/lib/api';
import { CATEGORIES } from '@/lib/categories';
import { Sun, Moon, User, ChevronDown, ShoppingCart, LogOut, Menu, X } from 'lucide-react';

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') setTheme('dark');
    } catch { /* SSR guard */ }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  return { theme, toggleTheme };
}

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const { theme, toggleTheme } = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [produkDropdownOpen, setProdukDropdownOpen] = useState(false);
  const [mobileSubmenuOpen, setMobileSubmenuOpen] = useState(false);
  const produkDropdownRef = useRef<HTMLLIElement>(null);
  const produkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const produkHoverRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const res: any = await cartApi.get();
        const items = res?.data?.items || res?.data || [];
        setCartCount(Array.isArray(items) ? items.length : 0);
      } catch { /* ignore */ }
    })();
  }, []);

  // Close mobile menu + dropdown on route change
  useEffect(() => {
    setMobileOpen(false);
    setDropdownOpen(false);
    setProdukDropdownOpen(false);
    setMobileSubmenuOpen(false);
  }, [pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  // Close produk dropdown on outside click
  useEffect(() => {
    if (!produkDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (produkDropdownRef.current && !produkDropdownRef.current.contains(e.target as Node)) {
        setProdukDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [produkDropdownOpen]);

  // Cleanup produk dropdown timeout on unmount
  useEffect(() => {
    return () => {
      if (produkTimeoutRef.current) clearTimeout(produkTimeoutRef.current);
    };
  }, []);

  // Listen for cart updates via custom event
  useEffect(() => {
    const handler = async () => {
      try {
        const res: any = await cartApi.get();
        const items = res?.data?.items || res?.data || [];
        setCartCount(Array.isArray(items) ? items.length : 0);
      } catch { /* ignore */ }
    };
    window.addEventListener('cart-updated', handler);
    return () => window.removeEventListener('cart-updated', handler);
  }, []);

  const isAdmin = pathname.startsWith('/admin');

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link href="/" className="navbar-brand" aria-label="ByteCommerce">
            <svg viewBox="0 0 560 84" role="img" aria-label="ByteCommerce" xmlns="http://www.w3.org/2000/svg">
              <rect x="24" y="14" width="96" height="18" rx="9" style={{fill:'var(--fg)'}}/>
              <rect x="28" y="28" width="88" height="52" rx="11" style={{fill:'var(--accent)'}}/>
              <rect x="52" y="44" width="40" height="8" rx="4" style={{fill:'var(--on-accent)'}}/>
              <rect x="52" y="62" width="26" height="8" rx="4" style={{fill:'var(--on-accent)'}}/>
              <text x="150" y="70" fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" fontSize="52" fontWeight="700" letterSpacing="-1" textLength="330" lengthAdjust="spacingAndGlyphs">
                <tspan style={{fill:'var(--fg)'}}>Byte</tspan><tspan style={{fill:'var(--accent)'}}>Commerce</tspan>
              </text>
            </svg>
          </Link>

          {!isAdmin && (
            <ul className="navbar-links">
              <li><Link href="/" style={{color: pathname === '/' ? 'var(--fg)' : undefined}}>Beranda</Link></li>
              <li><Link href="/?flash_sale=1">Flash Sale</Link></li>
              <li
                className={`navbar-dropdown${produkDropdownOpen ? ' open' : ''}`}
                ref={produkDropdownRef}
                onMouseEnter={() => {
                  produkHoverRef.current = true;
                  if (produkTimeoutRef.current) clearTimeout(produkTimeoutRef.current);
                  setProdukDropdownOpen(true);
                }}
                onMouseLeave={() => {
                  produkHoverRef.current = false;
                  produkTimeoutRef.current = setTimeout(() => setProdukDropdownOpen(false), 150);
                }}
              >
                <button
                  className="navbar-dropdown-trigger"
                  onClick={() => {
                    if (!produkHoverRef.current) setProdukDropdownOpen(prev => !prev);
                  }}
                  aria-expanded={produkDropdownOpen}
                  aria-haspopup="true"
                >
                  Produk <ChevronDown size={12} strokeWidth={2.5} />
                </button>
                {produkDropdownOpen && (
                  <div className="navbar-dropdown-menu">
                    <button
                      className="navbar-dropdown-item"
                      onClick={() => {
                        setProdukDropdownOpen(false);
                        router.push('/?scroll=rekomendasi');
                      }}
                    >
                      Produk Rekomendasi
                    </button>
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.label}
                        className="navbar-dropdown-item"
                        onClick={() => {
                          setProdukDropdownOpen(false);
                          router.push(`/?category=${encodeURIComponent(cat.label)}&scroll=rekomendasi`);
                        }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            </ul>
          )}

          <div className="navbar-auth">
            {!isAdmin && (
              <Link href="/cart" className="btn btn-ghost" style={{position:'relative'}}>
                <ShoppingCart size={20} />
                {cartCount > 0 && (
                  <span style={{
                    position:'absolute', top:-4, right:-4,
                    background:'var(--danger)', color:'var(--on-danger)',
                    fontSize:'0.65rem', fontWeight:700, borderRadius:'50%',
                    width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>
            )}

            {/* Theme toggle */}
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
              title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
            >
              <span key={theme} className="theme-toggle-icon">
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </span>
            </button>

            {loading ? null : user ? (
              <div className="navbar-user-area">
                {user.role === 'admin' && (
                  <Link href="/admin" className=" btn btn-primary btn-sm dashboard-desktop-only">Dashboard</Link>
                )}
                <div className="user-dropdown" ref={dropdownRef}>
                  <button
                    className="user-dropdown-btn btn-ghost"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    aria-label="Menu pengguna"
                    aria-expanded={dropdownOpen}
                  >
                    <User size={20} />
                  </button>
                  {dropdownOpen && (
                    <div className="user-dropdown-menu">
                      <div className="user-dropdown-info">
                        <div className="user-dropdown-name">{user.name}</div>
                        <div className="user-dropdown-email">{user.email}</div>
                      </div>
                      <div className="user-dropdown-divider" />
                      <Link href="/profile" className="user-dropdown-item" onClick={() => setDropdownOpen(false)}>
                        <User size={16} />
                        Profil Saya
                      </Link>
                      <button
                        className="user-dropdown-logout"
                        onClick={() => { logout(); setDropdownOpen(false); }}
                      >
                        <LogOut size={16} />
                        Keluar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <Link href="/auth/login" className="btn btn-ghost">Masuk</Link>
                <Link href="/auth/signup" className="btn btn-primary">Daftar</Link>
              </>
            )}

            <button className="navbar-hamburger" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
              <span key={String(mobileOpen)} className="navbar-hamburger-icon">
                {mobileOpen ? <X size={24} /> : <Menu size={24} />}
              </span>
            </button>
          </div>
        </div>

        <div className={`navbar-mobile ${mobileOpen ? 'open' : ''}`}>
          <div className="navbar-mobile-inner">
          <Link href="/" onClick={() => setMobileOpen(false)}>Beranda</Link>
          <Link href="/?flash_sale=1" onClick={() => setMobileOpen(false)}>Flash Sale</Link>
          <div className="navbar-mobile-accordion">
            <button
              className="navbar-mobile-accordion-trigger"
              onClick={() => setMobileSubmenuOpen(prev => !prev)}
              aria-expanded={mobileSubmenuOpen}
            >
              Produk
              <span className={`navbar-mobile-accordion-chevron${mobileSubmenuOpen ? ' open' : ''}`}>
                <ChevronDown size={12} strokeWidth={2.5} />
              </span>
            </button>
            {mobileSubmenuOpen && (
              <div className="navbar-mobile-accordion-content">
                <button
                  className="navbar-mobile-submenu-item"
                  onClick={() => {
                    setMobileOpen(false);
                    router.push('/?scroll=rekomendasi');
                  }}
                >
                  Produk Rekomendasi
                </button>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.label}
                    className="navbar-mobile-submenu-item"
                    onClick={() => {
                      setMobileOpen(false);
                      router.push(`/?category=${encodeURIComponent(cat.label)}&scroll=rekomendasi`);
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Link href="/cart" onClick={() => setMobileOpen(false)}>Keranjang</Link>
          {!user && <Link href="/auth/login" onClick={() => setMobileOpen(false)}>Masuk</Link>}
          {!user && <Link href="/auth/signup" onClick={() => setMobileOpen(false)}>Daftar</Link>}
          {user && <Link href="/orders" onClick={() => setMobileOpen(false)}>Pesanan Saya</Link>}
          {user?.role === 'admin' && <Link href="/admin" onClick={() => setMobileOpen(false)}>Dashboard</Link>}
          {/* Mobile theme toggle */}
          <button
            onClick={() => { toggleTheme(); }}
            className="navbar-mobile-btn"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            {theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          </button>
          </div>
        </div>
      </nav>
    </>
  );
}
