'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, ApiError, clearApiSession } from '@/lib/api';
import type { User } from '@/lib/types';
import type { ApiUser } from '@/lib/adapters';
import { normalizeUser } from '@/lib/adapters';

interface AuthValue {
  user: User;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function userFromResponse(response: ApiUser | { user: ApiUser }): User {
  if ('user' in response) return normalizeUser(response.user);
  return normalizeUser(response);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const goToLogin = useCallback(() => {
    const next = pathname && pathname !== '/dashboard' ? `?next=${encodeURIComponent(pathname)}` : '';
    router.replace(`/login${next}`);
  }, [pathname, router]);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api<ApiUser | { user: ApiUser }>('/auth/me');
      setUser(userFromResponse(response));
      setError(null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { goToLogin(); return; }
      setError(cause instanceof Error ? cause.message : 'Sesi tidak dapat diperiksa.');
    }
  }, [goToLogin]);

  useEffect(() => { void refreshUser(); }, [refreshUser]);
  useEffect(() => {
    window.addEventListener('lawn:unauthorized', goToLogin);
    return () => window.removeEventListener('lawn:unauthorized', goToLogin);
  }, [goToLogin]);

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); }
    finally { clearApiSession(); router.replace('/login'); router.refresh(); }
  }, [router]);

  const value = useMemo(() => user ? { user, refreshUser, logout } : null, [user, refreshUser, logout]);

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper p-6">
        <section className="card max-w-md text-center"><h1 className="text-xl font-semibold">Sesi tidak dapat dimuat</h1><p className="mt-2 text-muted">{error}</p><button className="btn-primary mt-5" onClick={() => void refreshUser()}>Coba lagi</button></section>
      </main>
    );
  }
  if (!value) return <div className="grid min-h-dvh place-items-center bg-paper" role="status"><div className="size-9 animate-spin rounded-full border-4 border-line border-t-moss" /><span className="sr-only">Memuat sesi</span></div>;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  return value;
}
