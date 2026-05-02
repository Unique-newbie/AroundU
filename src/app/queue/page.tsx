'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { enterQueue, findMatch, executeMatch, leaveQueue, subscribeToQueue, QueueEntry } from '@/lib/matching';
import { supabase } from '@/lib/supabase';
import { Suspense } from 'react';
import { IconUser, IconMap, IconGlobe, IconMapPin } from '@/lib/icons';

function QueueInner() {
  const router = useRouter();
  const p = useSearchParams();
  const { user, profile, ensureUser } = useAuth();
  const region = p.get('region') || 'nearby';
  const username = p.get('username') || profile?.username || 'Anonymous';
  const city = p.get('city') || '';
  const state = p.get('state') || '';
  const country = p.get('country') || '';
  const gender = p.get('gender') || 'Any';
  const platformPref = p.get('platformPref') || 'Any';
  const lat = parseFloat(p.get('lat') || '0');
  const lng = parseFloat(p.get('lng') || '0');
  const [sec, setSec] = useState(0);
  const [hint, setHint] = useState('');
  const [status, setStatus] = useState<'joining' | 'searching' | 'matched' | 'error'>('joining');
  const entryRef = useRef<QueueEntry | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchedRef = useRef(false);

  const labels: Record<string, string> = { nearby: city || 'your area', state: state || 'your state', country: country || 'your country', global: 'everywhere' };

  useEffect(() => { const t = setInterval(() => setSec(s => s + 1), 1000); return () => clearInterval(t); }, []);

  // Suggest expanding region
  useEffect(() => {
    if (sec > 10 && region === 'nearby') setHint('state');
    else if (sec > 20 && region === 'state') setHint('country');
    else if (sec > 30) setHint('global');
  }, [sec, region]);

  // Enter queue and start matching
  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const u = user || await ensureUser();
        if (!u || cancelled) return;

        const entry = await enterQueue(
          u.id, username, region, profile?.gender || 'Other', gender,
          { city, state, country, lat, lng },
          'web', platformPref
        );
        entryRef.current = entry;
        setStatus('searching');

        // Subscribe to realtime updates on our queue entry
        const channel = subscribeToQueue(entry.id, (updated) => {
          if (matchedRef.current) return;
          matchedRef.current = true;
          setStatus('matched');
          if (pollRef.current) clearInterval(pollRef.current);
          setTimeout(() => {
            router.push(`/chat?room=${updated.room_id}&username=${encodeURIComponent(username)}`);
          }, 500);
        });

        // Also poll for matches (in case we need to initiate the match)
        pollRef.current = setInterval(async () => {
          if (matchedRef.current || !entryRef.current) return;
          try {
            console.log('[POLL] Looking for match...', entryRef.current.id);
            const match = await findMatch(entryRef.current);
            console.log('[POLL] findMatch result:', match ? `FOUND: ${match.username}` : 'none');
            if (match && !matchedRef.current) {
              matchedRef.current = true;
              console.log('[POLL] Executing match with', match.username);
              const roomId = await executeMatch(entryRef.current, match);
              console.log('[POLL] Room created:', roomId);
              setStatus('matched');
              if (pollRef.current) clearInterval(pollRef.current);
              supabase.removeChannel(channel);
              setTimeout(() => {
                router.push(`/chat?room=${roomId}&username=${encodeURIComponent(username)}`);
              }, 500);
            }
          } catch (err) {
            console.error('[POLL] Error:', err);
            matchedRef.current = false;
          }
        }, 3000);

        return () => {
          supabase.removeChannel(channel);
          if (pollRef.current) clearInterval(pollRef.current);
        };
      } catch {
        if (!cancelled) setStatus('error');
      }
    };
    start();
    return () => { cancelled = true; if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (user && !matchedRef.current) leaveQueue(user.id);
    };
  }, [user]);

  return (
    <div className="page">
      <div className="page-center" style={{ gap: 28 }}>
        <div className="radar-wrap">
          <div className="radar-ring" /><div className="radar-ring" /><div className="radar-ring" />
          <div className="radar-beam" /><div className="radar-core" />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>
            {status === 'matched' ? 'Match found!' : status === 'error' ? 'Connection error' : 'Looking for someone...'}
          </h2>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
            {status === 'matched' ? 'Connecting you now...' : `Searching in `}<strong style={{ color: 'var(--blue)' }}>{labels[region]}</strong>
          </p>
          <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 6, fontFamily: 'Space Grotesk, sans-serif' }}>
            {Math.floor(sec / 60)}:{(sec % 60).toString().padStart(2, '0')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className="tag tag-blue" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IconMapPin size={12} /> {region}</span>
          <span className="tag tag-purple" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IconUser size={12} /> {username}</span>
        </div>

        {hint && hint !== region && status === 'searching' && (
          <div className="card" style={{ padding: 16, textAlign: 'center', maxWidth: 300 }}>
            <p style={{ fontSize: 13, marginBottom: 10, color: 'var(--text-1)' }}>No one nearby yet. Try expanding?</p>
            <button className="btn btn-primary btn-sm" onClick={() => {
              const np = new URLSearchParams(p.toString()); np.set('region', hint);
              router.replace(`/queue?${np.toString()}`);
            }}>
              {hint === 'state' ? <><IconMap size={14} /> State</> : hint === 'country' ? <><IconGlobe size={14} /> Country</> : <><IconGlobe size={14} /> Global</>}
            </button>
          </div>
        )}

        {status === 'error' && (
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button>
        )}

        <button className="btn btn-outline" onClick={async () => { if (user) await leaveQueue(user.id); router.push('/'); }}>Cancel</button>
      </div>
    </div>
  );
}

export default function QueuePage() {
  return <Suspense fallback={<div className="page"><div className="page-center"><p style={{ color: 'var(--text-3)' }}>Loading...</p></div></div>}><QueueInner /></Suspense>;
}
