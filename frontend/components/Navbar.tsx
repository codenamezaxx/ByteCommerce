'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback } from 'react';
import { cartApi } from '@/lib/api';

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Read from localStorage on mount (only runs on client)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') setTheme('dark');
    } catch { /* SSR guard */ }
  }, []);

  // Keep <html> attribute + localStorage in sync with state.
  // Side effects live outside the setState updater (which must stay pure).
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
  const [cartCount, setCartCount] = useState(0);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    (async () => {
      try {
        const res: any = await cartApi.get();
        const items = res?.data?.items || res?.data || [];
        setCartCount(Array.isArray(items) ? items.length : 0);
      } catch { /* ignore */ }
    })();
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
            </ul>
          )}

          <div className="navbar-auth">
            {!isAdmin && (
              <Link href="/cart" className="btn btn-ghost" style={{position:'relative'}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
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
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            {loading ? null : user ? (
              <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
                {user.role === 'admin' && (
                  <Link href="/admin" className="btn btn-ghost btn-sm">Admin</Link>
                )}
                <span style={{fontSize:'0.85rem', color:'var(--muted)'}}>{user.name}</span>
                <button onClick={logout} className="btn btn-ghost btn-sm">Keluar</button>
              </div>
            ) : (
              <>
                <Link href="/auth/login" className="btn btn-ghost">Masuk</Link>
                <Link href="/auth/signup" className="btn btn-primary">Daftar</Link>
              </>
            )}

            <button className="navbar-hamburger" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileOpen ? (
                  <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                ) : (
                  <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
                )}
              </svg>
            </button>
          </div>
        </div>

        <div className={`navbar-mobile ${mobileOpen ? 'open' : ''}`}>
          <Link href="/" onClick={() => setMobileOpen(false)}>Beranda</Link>
          <Link href="/?flash_sale=1" onClick={() => setMobileOpen(false)}>Flash Sale</Link>
          <Link href="/cart" onClick={() => setMobileOpen(false)}>Keranjang</Link>
          {!user && <Link href="/auth/login" onClick={() => setMobileOpen(false)}>Masuk</Link>}
          {!user && <Link href="/auth/signup" onClick={() => setMobileOpen(false)}>Daftar</Link>}
          {user && <Link href="/orders" onClick={() => setMobileOpen(false)}>Pesanan Saya</Link>}
          {user?.role === 'admin' && <Link href="/admin" onClick={() => setMobileOpen(false)}>Admin</Link>}
          {/* Mobile theme toggle */}
          <button
            onClick={() => { toggleTheme(); }}
            style={{
              background:'none', border:'none', borderBottom:'1px solid var(--border)',
              textAlign:'left', padding:'0.65rem 0', fontSize:'0.95rem', fontWeight:500,
              color:'var(--fg)', width:'100%', cursor:'pointer',
              display:'flex', alignItems:'center', gap:'0.5rem',
            }}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            {theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          </button>
          {user && <button onClick={() => { logout(); setMobileOpen(false); }} style={{background:'none',border:'none',textAlign:'left',padding:'0.65rem 0',fontSize:'0.95rem',fontWeight:500,color:'var(--fg)',width:'100%',cursor:'pointer',borderBottom:'1px solid var(--border)'}}>Keluar</button>}
        </div>
      </nav>
    </>
  );
}
