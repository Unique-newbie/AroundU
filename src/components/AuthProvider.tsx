'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import { getProfile, heartbeat, signInAsGuest, signOut as authSignOut } from '@/lib/auth';
import { generateUsername } from '@/lib/username-generator';
import type { User, Session } from '@supabase/supabase-js';

type AuthCtx = {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  isSignedIn: boolean;
  ensureUser: () => Promise<User | null>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null, profile: null, session: null,
  loading: true, isGuest: true, isSignedIn: false,
  ensureUser: async () => null,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function useAuth() { return useContext(AuthContext); }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    try {
      const p = await getProfile(uid);
      setProfile(p);
    } catch (err) {
      console.error('[AUTH] loadProfile error:', err);
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session) {
          setUser(data.session.user);
          setSession(data.session);
          await loadProfile(data.session.user.id);
        }
      } catch (err) {
        console.error('[AUTH] init error:', err);
      } finally {
        setLoading(false);
      }
    };
    init();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sess) => {
      setSession(sess);
      setUser(sess?.user || null);
      if (sess?.user) {
        await loadProfile(sess.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  // Heartbeat to keep user online
  useEffect(() => {
    if (!user) return;
    heartbeat(user.id);
    const t = setInterval(() => heartbeat(user.id), 60_000); // every 60s
    return () => clearInterval(t);
  }, [user]);

  // Ensure user exists (auto-create guest if needed)
  const ensureUser = useCallback(async (): Promise<User | null> => {
    if (user) return user;
    const name = generateUsername();
    const result = await signInAsGuest(name);
    if (result.user) {
      setUser(result.user);
      await loadProfile(result.user.id);
    }
    return result.user;
  }, [user, loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  const handleSignOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  }, []);

  const isGuest = profile?.is_guest ?? true;
  const isSignedIn = !!user && !isGuest;

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, isGuest, isSignedIn, ensureUser, refreshProfile, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}
