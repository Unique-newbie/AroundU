'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { loadMessages, sendMessage, sendSystemMessage, subscribeToMessages, unsubscribeFromRoom, reportUser } from '@/lib/chat-service';
import { getInitials } from '@/lib/username-generator';
import { supabase, Message } from '@/lib/supabase';
import { Suspense } from 'react';
import { IconChevLeft, IconFlag, IconSend, IconSkip, IconSave, IconCheck, IconEyeOff, IconImage } from '@/lib/icons';

function ChatInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, profile, loading, ensureUser } = useAuth();
  const roomId = params.get('room') || '';
  const groupName = params.get('group') || '';
  const myName = params.get('username') || profile?.username || 'You';

  const [stranger, setStranger] = useState('');
  const [strangerId, setStrangerId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<{ id: string; text: string; from: 'me' | 'them' | 'sys'; ts: Date; media?: string }[]>([]);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState('');
  const [nsfwMe, setNsfwMe] = useState(false);
  const [nsfwThem, setNsfwThem] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inpRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Initialize
  useEffect(() => {
    if (!roomId) { router.push('/'); return; }
    if (loading) return; // Wait for AuthProvider to resolve session

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let lastMsgTime = '';
    let retries = 0;

    const init = async () => {
      // Wait for auth to settle — user might not be available immediately
      let u = user;
      if (!u) {
        u = await ensureUser();
      }
      if (!u) {
        // Retry a few times as auth might still be loading
        if (retries < 5) {
          retries++;
          setTimeout(init, 1000);
          return;
        }
        // Give up — still show the chat with basic info
        console.error('[CHAT] Could not get user after retries');
        setReady(true);
        return;
      }

      // Load existing messages
      try {
        const existing = await loadMessages(roomId);
        const mapped = existing.map(m => ({
          id: m.id,
          text: m.content,
          from: m.msg_type === 'system' ? 'sys' as const : m.sender_id === u!.id ? 'me' as const : 'them' as const,
          ts: new Date(m.created_at),
          media: m.media_url || undefined,
        }));
        setMsgs(mapped);
        setMsgs(mapped);
        if (existing.length > 0) lastMsgTime = existing[existing.length - 1].created_at;
        
        if (existing.some(m => m.msg_type === 'system' && m.content.includes('left the chat'))) {
          setDisconnected(true);
        }

        // Get stranger name and id from participants
        const { data: participants } = await supabase
          .from('chat_participants')
          .select('user_id, username')
          .eq('room_id', roomId)
          .neq('user_id', u!.id)
          .limit(1);

        setStranger(groupName || participants?.[0]?.username || 'Stranger');
        if (participants?.[0]?.user_id) setStrangerId(participants[0].user_id);
      } catch {
        setStranger(groupName || 'Stranger');
        setMsgs([{ id: '0', text: groupName ? `Joined ${groupName}` : 'Connected', from: 'sys', ts: new Date() }]);
      }

      // Subscribe to real-time messages
      subscribeToMessages(roomId, (msg: Message) => {
        if (msg.sender_id === u!.id) return;
        lastMsgTime = msg.created_at;
        if (msg.msg_type === 'system' && msg.content.includes('left the chat')) {
          setDisconnected(true);
        }
        setMsgs(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, {
            id: msg.id,
            text: msg.content,
            from: msg.msg_type === 'system' ? 'sys' : 'them',
            ts: new Date(msg.created_at),
            media: msg.media_url || undefined,
          }];
        });
      });

      // Polling fallback: fetch new messages every 2s in case Realtime fails
      pollTimer = setInterval(async () => {
        try {
          let query = supabase.from('messages').select('*').eq('room_id', roomId).order('created_at', { ascending: true });
          if (lastMsgTime) query = query.gt('created_at', lastMsgTime);
          const { data: newMsgs } = await query;
          if (newMsgs && newMsgs.length > 0) {
            lastMsgTime = newMsgs[newMsgs.length - 1].created_at;
            setMsgs(prev => {
              const ids = new Set(prev.map(m => m.id));
              const fresh = newMsgs.filter((m: any) => !ids.has(m.id) && m.sender_id !== u!.id).map((m: any) => ({
                id: m.id,
                text: m.content,
                from: m.msg_type === 'system' ? 'sys' as const : 'them' as const,
                ts: new Date(m.created_at),
                media: m.media_url || undefined,
              }));
              if (fresh.some((m: any) => m.from === 'sys' && m.text.includes('left the chat'))) {
                setDisconnected(true);
              }
              return fresh.length > 0 ? [...prev, ...fresh] : prev;
            });
          }
        } catch { /* retry */ }
      }, 2000);

      setReady(true);
    };

    init();
    return () => { unsubscribeFromRoom(); if (pollTimer) clearInterval(pollTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, loading]);

  const scroll = useCallback(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), []);
  useEffect(() => { scroll(); }, [msgs, scroll]);

  const send = async () => {
    const t = input.trim();
    if (!t || !user || disconnected) return;

    // Optimistic add
    setMsgs(prev => [...prev, { id: Date.now().toString(), text: t, from: 'me', ts: new Date() }]);
    setInput('');
    inpRef.current?.focus();

    try {
      await sendMessage(roomId, user.id, myName, t);
    } catch (err) { console.error('[CHAT] Send failed:', err); }
  };

  const handleLeave = async () => {
    if (user && !disconnected) {
      await sendSystemMessage(roomId, `${myName} left the chat.`);
    }
    if (user) {
      await fetch('/api/queue', { method: 'POST', body: JSON.stringify({ action: 'leave', userId: user.id }) }).catch(()=>{});
    }
    router.push('/');
  };

  const handleNext = async () => {
    if (user && !disconnected) {
      await sendSystemMessage(roomId, `${myName} left the chat.`);
    }
    if (user) {
      await fetch('/api/queue', { method: 'POST', body: JSON.stringify({ action: 'leave', userId: user.id }) }).catch(()=>{});
    }
    router.push('/'); // Navigate home to easily enter a new queue
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) {
        setMsgs(prev => [...prev, { id: Date.now().toString(), text: '', from: 'me', ts: new Date(), media: data.url }]);
        await sendMessage(roomId, user.id, myName, '', data.url);
      }
    } catch { /* silent */ }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!saved) {
      // Get stranger's user_id from participants
      const { data } = await supabase.from('chat_participants').select('user_id').eq('room_id', roomId).neq('user_id', user.id).limit(1);
      if (data?.[0]) {
        await supabase.from('connections').upsert({
          user_a: user.id, user_b: data[0].user_id,
          last_message: msgs[msgs.length - 1]?.text || '', last_message_at: new Date().toISOString(),
        }, { onConflict: 'user_a,user_b' });
      }
    }
    setSaved(!saved);
  };

  const handleReport = async (reason: string) => {
    if (!user) return;
    const { data } = await supabase.from('chat_participants').select('user_id, username').eq('room_id', roomId).neq('user_id', user.id).limit(1);
    if (data?.[0]) {
      await reportUser(user.id, myName, data[0].user_id, data[0].username, reason, roomId);
    }
    setShowReport(false);
  };

  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!ready || connecting) return <div className="page"><div className="page-center"><p style={{ color: 'var(--text-3)' }}>Connecting...</p></div></div>;

  return (
    <div className="chat-shell">
      <div className="chat-head">
        <button className="btn-icon" onClick={handleLeave}><IconChevLeft size={16} /></button>
        <div 
          className={`avatar avatar-${groupName ? 'green' : 'blue'}`} 
          style={{ width: 34, height: 34, fontSize: 13, cursor: strangerId ? 'pointer' : 'default' }}
          onClick={() => strangerId && router.push(`/profile/${strangerId}`)}
        >
          {getInitials(stranger)}
        </div>
        <div style={{ flex: 1, minWidth: 0, cursor: strangerId ? 'pointer' : 'default' }} onClick={() => strangerId && router.push(`/profile/${strangerId}`)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="truncate" style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 14, textDecoration: strangerId ? 'underline' : 'none', textUnderlineOffset: '2px' }}>{stranger}</span>
            {groupName && <span className="tag tag-green" style={{ fontSize: 10, padding: '1px 6px' }}>Group</span>}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>online</p>
        </div>
        <button className="btn-icon" onClick={() => setShowReport(true)} style={{ color: 'var(--pink)' }}><IconFlag size={16} /></button>
      </div>

      {!groupName && (
        <div className="nsfw-bar">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconEyeOff size={14} />
            NSFW {nsfwMe && nsfwThem ? 'Unlocked' : nsfwMe ? 'Waiting...' : 'Off'}
          </span>
          <button className={`toggle${nsfwMe ? ' on' : ''}`} onClick={() => {
            setNsfwMe(!nsfwMe);
            if (!nsfwMe) setTimeout(() => setNsfwThem(Math.random() > 0.3), 1200);
          }} style={nsfwMe ? { background: 'var(--pink)' } : {}} />
        </div>
      )}

      <div className="chat-body">
        {msgs.map(m => m.from === 'sys' ? (
          <p key={m.id} style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, padding: '6px 0' }}>{m.text}</p>
        ) : (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
            {m.media && <img src={m.media} alt="shared" style={{ maxWidth: '70%', borderRadius: 12, marginBottom: 4, filter: nsfwMe && nsfwThem ? 'none' : 'blur(20px)' }} />}
            {m.text && <div className={`bubble bubble-${m.from === 'me' ? 'me' : 'them'}`}>{m.text}</div>}
            <span className="bubble-time" style={{ paddingInline: 2 }}>{fmt(m.ts)}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {!groupName && (
        <div style={{ display: 'flex', gap: 6, padding: '0 12px 4px', justifyContent: 'center' }}>
          <button className="btn btn-danger btn-sm" onClick={handleLeave}><IconSkip size={14} /> Stop</button>
          <button className="btn btn-outline btn-sm" onClick={handleNext} style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>Next ❯</button>
          <button className={`btn btn-sm ${saved ? 'btn-success' : 'btn-outline'}`} onClick={handleSave}>
            {saved ? <><IconCheck size={14} /> Saved</> : <><IconSave size={14} /> Save</>}
          </button>
        </div>
      )}

      <div className="chat-foot">
        <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={handleImage} disabled={disconnected} />
        <button className="btn-icon" onClick={() => fileRef.current?.click()} disabled={uploading || disconnected} style={uploading || disconnected ? { opacity: 0.5 } : {}}>
          <IconImage size={16} />
        </button>
        <input ref={inpRef} className="input" placeholder={disconnected ? "Stranger left the chat" : "Type a message..."} value={input}
          onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} disabled={disconnected} autoFocus />
        <button className="btn-icon" onClick={send} disabled={disconnected} style={input.trim() && !disconnected ? { background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' } : {}}>
          <IconSend size={16} />
        </button>
      </div>

      {showReport && (
        <div className="overlay" onClick={() => setShowReport(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconFlag size={18} color="var(--pink)" /> Report {stranger}
            </h3>
            {['Harassment', 'Spam', 'Underage', 'Illegal content', 'Non-consensual content', 'Other'].map(r => (
              <button key={r} className="btn btn-outline w-full" style={{ marginBottom: 6, justifyContent: 'flex-start', fontSize: 13 }} onClick={() => handleReport(r)}>
                {r}
              </button>
            ))}
            <button className="btn btn-ghost w-full" style={{ marginTop: 6 }} onClick={() => setShowReport(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '4px 0', fontSize: 10, color: 'var(--text-3)', background: 'var(--bg-0)' }}>
        All messages auto-delete in 24h
      </div>
    </div>
  );
}

export default function ChatPage() {
  return <Suspense fallback={<div className="page"><div className="page-center"><p style={{ color: 'var(--text-3)' }}>Connecting...</p></div></div>}><ChatInner /></Suspense>;
}
