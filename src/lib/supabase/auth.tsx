/**
 * auth.tsx — auth state + the sign-in/out actions, wired to the storage façade.
 *
 * On sign-in we point `kv` at the user's Supabase store (after a one-time
 * local→cloud migration); on sign-out we revert to on-device storage. When
 * Supabase isn't configured the whole thing is inert and the app runs locally.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { resetActiveStore, setActiveStore } from '../kv';
import { supabase } from './client';
import { isSupabaseConfigured } from './config';
import { createSupabaseStore, migrateLocalToCloud } from './supabase-kv';

interface AuthContextValue {
  /** True until the initial session check resolves. */
  loading: boolean;
  session: Session | null;
  /** Whether cloud accounts are switched on at all. */
  enabled: boolean;
  /** Send a magic link to the given email. */
  signIn: (email: string) => Promise<{ error: string | null }>;
  /** Redirect to Google OAuth (web). Resolves only on immediate failure. */
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);

  const applySession = useCallback(async (next: Session | null) => {
    setSession(next);
    if (next && supabase) {
      const cloud = createSupabaseStore(supabase, next.user.id);
      setActiveStore(cloud);
      try {
        await migrateLocalToCloud(cloud);
      } catch {
        // Migration is best-effort; never block sign-in on it.
      }
    } else {
      resetActiveStore();
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      await applySession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      applySession(next ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(async (email: string) => {
    if (!supabase) return { error: 'Cloud accounts are not configured.' };
    const emailRedirectTo =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : undefined;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo },
    });
    return { error: error?.message ?? null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return { error: 'Cloud accounts are not configured.' };
    // Same implicit flow as magic links: Google redirects back to the app URL
    // with the session in the hash, which detectSessionInUrl picks up.
    const redirectTo =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    await applySession(null);
  }, [applySession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      enabled: isSupabaseConfigured,
      signIn,
      signInWithGoogle,
      signOut,
    }),
    [loading, session, signIn, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
