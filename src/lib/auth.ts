import { supabase, Profile } from './supabase';
import { generateUsername } from './username-generator';
import type { User, Session } from '@supabase/supabase-js';

// ---- Auth State ----
export type AuthState = {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
};

// ---- Sign in as anonymous guest ----
export async function signInAsGuest(username?: string): Promise<{ user: User | null; error: string | null }> {
  const name = username || generateUsername();

  // Try anonymous sign-in first
  const { data, error } = await supabase.auth.signInAnonymously({
    options: { data: { username: name, is_guest: 'true' } },
  });

  if (!error && data.user) {
    await supabase.from('profiles').update({ username: name, is_guest: true }).eq('id', data.user.id);
    return { user: data.user, error: null };
  }

  // Fallback: create guest via server API (admin) and sign in with credentials
  console.log('[AUTH] Anonymous sign-in failed, using server fallback:', error?.message);
  try {
    const res = await fetch('/api/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name }),
    });
    if (!res.ok) {
      const err = await res.json();
      return { user: null, error: err.error || 'Guest creation failed' };
    }
    const { email, password } = await res.json();

    // Sign in with the created credentials
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email, password,
    });
    if (signInErr) return { user: null, error: signInErr.message };
    return { user: signInData.user, error: null };
  } catch (e: any) {
    return { user: null, error: e.message };
  }
}

// ---- Sign Up (Email & Password) ----
export async function signUpWithEmail(
  email: string,
  password: string,
  username: string
): Promise<{ user: User | null; error: string | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, is_guest: 'false' },
    },
  });
  if (error) return { user: null, error: error.message };

  if (data.user) {
    await supabase.from('profiles').update({ username, is_guest: false }).eq('id', data.user.id);
  }
  return { user: data.user, error: null };
}

// ---- Sign In (Email & Password) ----
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { user: null, error: error.message };
  return { user: data.user, error: null };
}

// ---- Password Reset ----
export async function resetPassword(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login?reset=true`,
  });
  return { error: error?.message || null };
}

// ---- Sign out ----
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ---- Get current session ----
export async function getSession(): Promise<{ user: User | null; session: Session | null }> {
  const { data } = await supabase.auth.getSession();
  return { user: data.session?.user || null, session: data.session };
}

// ---- Get profile for user ----
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data as Profile | null;
}

// ---- Update profile ----
export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'username' | 'gender' | 'city' | 'state' | 'country' | 'country_code' | 'lat' | 'lng' | 'nsfw_enabled'>>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  return { error: error?.message || null };
}

// ---- Heartbeat: mark user online ----
export async function heartbeat(userId: string): Promise<void> {
  await supabase.from('profiles').update({ is_online: true, last_seen: new Date().toISOString() }).eq('id', userId);
}

// ---- Get online count ----
export async function getOnlineCount(): Promise<number> {
  const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_online', true);
  return count || 0;
}

// ---- Get active chat count ----
export async function getActiveChatCount(): Promise<number> {
  const { count } = await supabase
    .from('chat_rooms')
    .select('*', { count: 'exact', head: true })
    .eq('type', '1v1')
    .gt('expires_at', new Date().toISOString());
  return count || 0;
}

// ---- Get queue count ----
export async function getQueueCount(): Promise<number> {
  const { count } = await supabase.from('match_queue').select('*', { count: 'exact', head: true }).eq('status', 'waiting');
  return count || 0;
}
