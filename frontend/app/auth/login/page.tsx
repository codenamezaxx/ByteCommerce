'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Suspense } from 'react';
import { CircleX } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/';
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Email dan password wajib diisi');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      router.push(returnUrl);
    } catch (err: any) {
      setError(err?.message || 'Login gagal. Silakan coba lagi.');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="toast toast-error mb-2">
          <CircleX size={18} style={{flexShrink:0}} />
          {error}
        </div>
      )}
      <div className="form-group">
        <label className="form-label" htmlFor="login-email">Email</label>
        <input className="form-input" type="email" id="login-email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div className="form-group">
        <div className="flex items-center justify-between mb-1">
          <label className="form-label" htmlFor="login-password" style={{marginBottom:0}}>Kata Sandi</label>
        </div>
        <input className="form-input" type="password" id="login-password" placeholder="Min. 8 karakter" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <button type="submit" className={`btn btn-primary btn-block btn-lg ${loading ? 'loading' : ''}`} disabled={loading} style={{marginTop:'0.5rem'}}>
        <span className="spinner"></span>
        <span className="btn-text">Masuk</span>
      </button>
    </form>
  );
}

function SignupForm() {
  const router = useRouter();
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !password) {
      setError('Semua field wajib diisi');
      return;
    }
    if (password.length < 8) {
      setError('Password minimal 8 karakter');
      return;
    }
    if (password !== confirmPassword) {
      setError('Password tidak cocok');
      return;
    }
    setLoading(true);
    try {
      await signup(name, email, password);
      router.push('/');
    } catch (err: any) {
      setError(err?.message || 'Daftar gagal. Silakan coba lagi.');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="toast toast-error mb-2">
          <CircleX size={18} style={{flexShrink:0}} />
          {error}
        </div>
      )}
      <div className="form-group">
        <label className="form-label" htmlFor="reg-name">Nama Lengkap</label>
        <input className="form-input" type="text" id="reg-name" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="reg-email">Email</label>
        <input className="form-input" type="email" id="reg-email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="reg-password">Password</label>
        <input className="form-input" type="password" id="reg-password" placeholder="Min. 8 karakter" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="reg-confirm">Konfirmasi Password</label>
        <input className="form-input" type="password" id="reg-confirm" placeholder="Ulangi kata sandi" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
      </div>
      <button type="submit" className={`btn btn-primary btn-block btn-lg ${loading ? 'loading' : ''}`} disabled={loading} style={{marginTop:'0.5rem'}}>
        <span className="spinner"></span>
        <span className="btn-text">Daftar</span>
      </button>
    </form>
  );
}

function AuthPageInner() {
  const [tab, setTab] = useState<'login' | 'register'>('login');

  return (
    <section style={{display:'flex', alignItems:'center', justifyContent:'center', minHeight:'calc(100vh - 60px - 80px)', padding:'3rem 1.25rem'}}>
      <div style={{width:'100%', maxWidth:'420px'}}>
        <div className="text-center mb-3">
          <h1 style={{marginBottom:'0.35rem'}}>Selamat Datang</h1>
          <p className="text-muted" style={{fontSize:'0.95rem'}}>Masuk atau daftar untuk mulai berbelanja</p>
        </div>

        <div className="card" style={{padding:'1.5rem'}}>
          <div className="auth-tabs">
            <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')} type="button">Masuk</button>
            <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')} type="button">Daftar</button>
          </div>

          {tab === 'login' ? <LoginForm /> : <SignupForm />}
        </div>

        <p className="text-center mt-3" style={{fontSize:'0.9rem', color:'var(--muted)'}}>
          {tab === 'login' ? (
            <>Belum punya akun? <button onClick={() => setTab('register')} style={{fontWeight:600, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontSize:'0.9rem'}}>Daftar</button></>
          ) : (
            <>Sudah punya akun? <button onClick={() => setTab('login')} style={{fontWeight:600, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontSize:'0.9rem'}}>Masuk</button></>
          )}
        </p>
      </div>
    </section>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div style={{display:'flex',justifyContent:'center',alignItems:'center',padding:'4rem 0'}}><div className="spinner-lg" /></div>}>
      <AuthPageInner />
    </Suspense>
  );
}
