'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { supabase, Connection } from '@/lib/supabase';
import { getInitials } from '@/lib/username-generator';
import { IconHome, IconUsers, IconChat, IconUser, IconHeart, IconClock, IconTrash } from '@/lib/icons';
import { Search, Loader2 } from 'lucide-react';

export default function ConnectionsPage() {
  const router = useRouter();
  const { user, isSignedIn } = useAuth();
  const [conns, setConns] = useState<(Connection & { other_username: string, avatar_url?: string, room_id?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      try {
        const { data } = await supabase
          .from('connections')
          .select('*')
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
          .order('last_message_at', { ascending: false });

        if (!data || data.length === 0) { setConns([]); setLoading(false); return; }

        // Get usernames and avatars
        const otherIds = data.map(c => c.user_a === user.id ? c.user_b : c.user_a);
        const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', otherIds);
        
        const profileMap: Record<string, {username: string, avatar_url?: string}> = {};
        (profiles || []).forEach(p => { profileMap[p.id] = { username: p.username, avatar_url: p.avatar_url }; });

        setConns(data.map(c => {
          const otherId = c.user_a === user.id ? c.user_b : c.user_a;
          return {
            ...c as Connection,
            other_username: profileMap[otherId]?.username || 'Unknown',
            avatar_url: profileMap[otherId]?.avatar_url,
          };
        }));
      } catch {
        setConns([]);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  // Handle user search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length < 3) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.users || []);
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const removeConn = async (id: string) => {
    await supabase.from('connections').delete().eq('id', id);
    setConns(prev => prev.filter(c => c.id !== id));
  };

  const timeSince = (d: string) => {
    const now = Date.now();
    const then = new Date(d).getTime();
    const mins = Math.floor((now - then) / 60_000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (!isSignedIn) {
    return (
      <div className="page">
        <div className="topbar">
          <div className="topbar-inner">
            <a href="/" className="topbar-brand">around<span>U</span></a>
            <div className="topbar-nav">
              <button className="nav-item" onClick={() => router.push('/')}><IconHome size={20} /><span>Home</span></button>
              <button className="nav-item" onClick={() => router.push('/groups')}><IconUsers size={20} /><span>Groups</span></button>
              <button className="nav-item" onClick={() => router.push('/dating')}><IconHeart size={20} /><span>Dating</span></button>
              <button className="nav-item active"><IconChat size={20} /><span>Chats</span></button>
              <button className="nav-item" onClick={() => router.push('/profile')}><IconUser size={20} /><span>Profile</span></button>
            </div>
          </div>
        </div>
        <div className="page-center" style={{ gap: 16 }}>
          <IconChat size={48} color="var(--text-3)" />
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Your chats</h2>
          <p style={{ color: 'var(--text-2)', fontSize: 13, textAlign: 'center', maxWidth: 260 }}>Sign in to save connections and access chat history.</p>
          <button className="btn btn-primary" onClick={() => router.push('/login')}>Sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ paddingBottom: '80px' }}>
      <div className="topbar">
        <div className="topbar-inner">
          <a href="/" className="topbar-brand">around<span>U</span></a>
          <div className="topbar-nav">
            <button className="nav-item" onClick={() => router.push('/')}><IconHome size={20} /><span>Home</span></button>
            <button className="nav-item" onClick={() => router.push('/groups')}><IconUsers size={20} /><span>Groups</span></button>
            <button className="nav-item" onClick={() => router.push('/dating')}><IconHeart size={20} /><span>Dating</span></button>
            <button className="nav-item active"><IconChat size={20} /><span>Chats</span></button>
            <button className="nav-item" onClick={() => router.push('/profile')}><IconUser size={20} /><span>Profile</span></button>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '20px' }}>
        
        {/* User Search Section */}
        <div className="mb-8">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search users to message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#333] rounded-xl px-4 py-3 pl-10 text-white focus:outline-none focus:border-pink-500 transition-colors"
            />
            <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
            {searching && <Loader2 className="absolute right-3 top-3.5 w-5 h-5 text-pink-500 animate-spin" />}
          </div>

          {searchResults.length > 0 && (
            <div className="mt-2 bg-[#1A1A1A] border border-[#333] rounded-xl overflow-hidden shadow-2xl">
              {searchResults.map(u => (
                <div 
                  key={u.id} 
                  onClick={() => router.push(`/profile/${u.id}`)}
                  className="flex items-center space-x-3 p-3 hover:bg-[#2A2A2A] cursor-pointer transition-colors border-b border-[#333] last:border-0"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 shrink-0">
                    {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">{u.username.charAt(0).toUpperCase()}</div>}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-white">{u.username}</div>
                    {(u.city || u.state) && <div className="text-xs text-gray-500">{u.city}{u.city && u.state ? ', ' : ''}{u.state}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Connections</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconClock size={13} /> Saved strangers and direct messages
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}></div>
        ) : conns.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <IconChat size={32} color="var(--text-3)" />
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 8 }}>No connections yet</p>
            <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 4 }}>Search for a user or save a stranger during chat.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {conns.map(c => (
              <div 
                key={c.id} 
                className="conn-row" 
                onClick={() => {
                  if (c.room_id) router.push(`/chat?roomId=${c.room_id}`);
                }}
                style={{ cursor: c.room_id ? 'pointer' : 'default' }}
              >
                <div className="avatar avatar-blue" style={{ width: 42, height: 42, fontSize: 15, padding: 0, overflow: 'hidden' }}>
                  {c.avatar_url ? (
                     <img src={c.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    getInitials(c.other_username)
                  )}
                </div>
                <div className="conn-info">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="conn-name">{c.other_username}</span>
                    <span className="conn-time">{timeSince(c.last_message_at)}</span>
                  </div>
                  <p className="conn-preview">{c.last_message || (c.room_id ? 'Tap to chat' : 'Stranger chat ended')}</p>
                </div>
                <button className="btn-icon" onClick={(e) => { e.stopPropagation(); removeConn(c.id); }} style={{ color: 'var(--text-3)' }}>
                  <IconTrash size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
