'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authApi, ApiError, cartApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Backend me/signup mengembalikan user object langsung di `data`,
// login mengembalikan `data.user` — cover semua bentuk + normalisasi role.
function extractUser(res: any): User | null {
  const raw = res?.data?.user || res?.user || res?.data || null;
  if (!raw) return null;
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    role: String(raw.role || '').toLowerCase(),
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res: any = await authApi.me();
        if (mounted) setUser(extractUser(res));
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res: any = await authApi.login(email, password);
    setUser(extractUser(res));
    // Try to merge guest cart
    try { await cartApi.merge(); } catch { /* ignore merge errors */ }
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res: any = await authApi.signup(name, email, password);
    // After signup, auto-login
    const loginRes: any = await authApi.login(email, password);
    setUser(extractUser(loginRes));
    try { await cartApi.merge(); } catch { /* ignore */ }
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* proceed anyway */ }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
