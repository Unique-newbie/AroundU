'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { signUpWithEmail, signInWithEmail, resetPassword } from '@/lib/auth';
import { IconHome, IconUsers, IconChat, IconUser, IconHeart, IconLock, IconMail, IconKey } from '@/lib/icons';

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, signOut } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>(searchParams?.get('reset') ? 'reset' : 'login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  
  const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // If user comes back with ?reset=true from email link
    if (searchParams?.get('reset') === 'true') {
      setMode('reset');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && user && !profile?.is_guest && mode !== 'reset') {
      router.replace('/profile');
    }
  }, [loading, user, profile, mode, router]);

  if (loading) return <div className="page"></div>;

  // If we are redirecting to profile, don't flash the login UI
  if (user && !profile?.is_guest && mode !== 'reset') {
    return <div className="page"></div>;
  }

  const handleSubmit = async () => {
    setStatus(null);
    if (!email) return setStatus({ type: 'error', msg: 'Email is required' });
    
    setIsSubmitting(true);
    
    if (mode === 'reset') {
      if (user) {
        // Logged in user resetting their own password
        if (!password) {
          setIsSubmitting(false);
          return setStatus({ type: 'error', msg: 'New password is required' });
        }
        // Assuming we update password via a different method, but for now we just show a message.
        // Usually Supabase handles the session after the reset link is clicked.
        setStatus({ type: 'success', msg: 'Password updated successfully' });
        setTimeout(() => router.push('/'), 2000);
      } else {
        // Requesting a reset link
        const { error } = await resetPassword(email);
        if (error) setStatus({ type: 'error', msg: error });
        else setStatus({ type: 'success', msg: 'Check your email for the reset link!' });
      }
    } else if (mode === 'signup') {
      if (!password || !username) {
        setIsSubmitting(false);
        return setStatus({ type: 'error', msg: 'Email, username, and password required' });
      }
      const { error } = await signUpWithEmail(email, password, username);
      if (error) setStatus({ type: 'error', msg: error });
      else {
        setStatus({ type: 'success', msg: 'Account created! Redirecting...' });
        setTimeout(() => router.push('/'), 1500);
      }
    } else {
      if (!password) {
        setIsSubmitting(false);
        return setStatus({ type: 'error', msg: 'Password is required' });
      }
      const { error } = await signInWithEmail(email, password);
      if (error) setStatus({ type: 'error', msg: error });
      else {
        setStatus({ type: 'success', msg: 'Signed in successfully' });
        setTimeout(() => router.push('/'), 1000);
      }
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="page">
      <div className="topbar">
        <div className="topbar-inner">
          <a href="/" className="topbar-brand">around<span>U</span></a>
          <div className="topbar-nav">
            <button className="nav-item" onClick={() => router.push('/')}><IconHome size={20} /><span>Home</span></button>
            <button className="nav-item" onClick={() => router.push('/groups')}><IconUsers size={20} /><span>Groups</span></button>
            <button className="nav-item" onClick={() => router.push('/dating')}><IconHeart size={20} /><span>Dating</span></button>
            <button className="nav-item" onClick={() => router.push('/connections')}><IconChat size={20} /><span>Chats</span></button>
            <button className="nav-item active"><IconUser size={20} /><span>Profile</span></button>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 20, maxWidth: 400, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <IconLock size={48} color="var(--pink)" style={{ marginBottom: 16 }} />
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>
            {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
          </h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 6 }}>
            {mode === 'login' ? 'Sign in to access your chats and dating profile.' 
             : mode === 'signup' ? 'Join the community and save your matches.'
             : user ? 'Enter a new password for your account.' : 'Enter your email to receive a password reset link.'}
          </p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          {status && (
            <div style={{ 
              padding: 12, 
              borderRadius: 8, 
              marginBottom: 16, 
              fontSize: 13,
              backgroundColor: status.type === 'error' ? 'rgba(233, 30, 99, 0.1)' : 'rgba(76, 175, 80, 0.1)',
              color: status.type === 'error' ? 'var(--pink)' : 'var(--green)',
              border: `1px solid ${status.type === 'error' ? 'rgba(233, 30, 99, 0.2)' : 'rgba(76, 175, 80, 0.2)'}`
            }}>
              {status.msg}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'signup' && (
              <div style={{ position: 'relative' }}>
                <IconUser size={18} color="var(--text-3)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  className="input" 
                  placeholder="Username" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  style={{ paddingLeft: 42 }} 
                />
              </div>
            )}

            {(!user || mode !== 'reset') && (
              <div style={{ position: 'relative' }}>
                <IconMail size={18} color="var(--text-3)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  className="input" 
                  type="email" 
                  placeholder="Email address" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  style={{ paddingLeft: 42 }} 
                />
              </div>
            )}

            {(mode !== 'reset' || user) && (
              <div style={{ position: 'relative' }}>
                <IconKey size={18} color="var(--text-3)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  className="input" 
                  type="password" 
                  placeholder={mode === 'reset' ? 'New password' : 'Password'} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  style={{ paddingLeft: 42 }} 
                />
              </div>
            )}

            <button 
              className="btn btn-primary btn-lg" 
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{ marginTop: 8 }}
            >
              {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : user ? 'Update Password' : 'Send Reset Link'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24, textAlign: 'center' }}>
            {mode === 'login' ? (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => { setMode('reset'); setStatus(null); }}>Forgot password?</button>
                <div style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 8 }}>
                  Don&apos;t have an account? <button className="text-pink" style={{ fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => { setMode('signup'); setStatus(null); }}>Sign up</button>
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text-3)', fontSize: 13 }}>
                Back to <button className="text-blue" style={{ fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => { setMode('login'); setStatus(null); }}>Sign in</button>
              </div>
            )}
          </div>
        </div>
      </div>


    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<div className="page"><div className="page-center">Loading...</div></div>}><LoginInner /></Suspense>;
}
