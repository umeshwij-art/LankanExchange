import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { toast } from 'sonner';

interface AuthState {
  user: User | null;
  loading: boolean;
  /** True once /api/account has confirmed the trading account exists */
  accountReady: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

async function ensureAccount(user: User) {
  const token = await user.getIdToken();
  const res = await fetch('/api/account', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not set up your account');
  return (await res.json()) as { created: boolean };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountReady, setAccountReady] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(auth, async u => {
        setUser(u);
        setLoading(false);
        setAccountReady(false);
        if (!u) return;
        try {
          const { created } = await ensureAccount(u);
          setAccountReady(true);
          if (created) toast.success('Welcome! LKR 100,000 of practice money is in your account.');
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Could not set up your account');
        }
      }),
    [],
  );

  const value: AuthState = {
    user,
    loading,
    accountReady,
    login: async () => {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') toast.error('Sign-in failed');
      }
    },
    logout: () => signOut(auth),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
