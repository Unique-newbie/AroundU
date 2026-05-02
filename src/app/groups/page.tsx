'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { supabase, Group } from '@/lib/supabase';
import { createRoom, joinRoom, sendSystemMessage } from '@/lib/chat-service';
import { IconHome, IconUsers, IconChat, IconUser, IconHeart, IconSearch, IconStar, IconLock, IconFlame } from '@/lib/icons';

function fmt(n: number) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n.toString(); }

function GroupInitials({ name, color }: { name: string; color: string }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return <div className={`avatar avatar-${color}`}>{initials}</div>;
}

export default function GroupsPage() {
  const router = useRouter();
  const { user, profile, ensureUser } = useAuth();
  const [tab, setTab] = useState<'all' | 'official' | 'private'>('all');
  const [search, setSearch] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.from('groups').select('*').order('member_count', { ascending: false });
        setGroups((data as Group[]) || []);
      } catch {
        // Fallback mock data if DB not connected
        setGroups([
          { id: '1', name: 'Late Night Talks', description: 'For the night owls. Deep convos after midnight.', type: 'official', nsfw: false, color: 'purple', member_count: 2841, online_count: 187, room_id: null, created_at: '' },
          { id: '2', name: 'Meme Exchange', description: 'Share cursed memes. No normie stuff.', type: 'official', nsfw: false, color: 'blue', member_count: 5320, online_count: 412, room_id: null, created_at: '' },
          { id: '3', name: 'Confessions', description: 'Anonymous confessions. No judgement zone.', type: 'official', nsfw: false, color: 'pink', member_count: 3210, online_count: 234, room_id: null, created_at: '' },
          { id: '4', name: 'After Dark', description: '18+ only. NSFW content allowed.', type: 'official', nsfw: true, color: 'pink', member_count: 4100, online_count: 520, room_id: null, created_at: '' },
          { id: '5', name: 'Spicy Chat', description: 'Flirty group chat. Adults only.', type: 'official', nsfw: true, color: 'pink', member_count: 3800, online_count: 410, room_id: null, created_at: '' },
          { id: '6', name: 'Developers Hub', description: 'Talk code, share projects, debug together.', type: 'private', nsfw: false, color: 'green', member_count: 1450, online_count: 98, room_id: null, created_at: '' },
        ] as Group[]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = groups.filter(g => {
    if (tab === 'official' && g.type !== 'official') return false;
    if (tab === 'private' && g.type !== 'private') return false;
    if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const joinGroup = async (g: Group) => {
    const u = user || await ensureUser();
    if (!u) return;
    const username = profile?.username || 'Guest';

    let roomId = g.room_id;
    if (!roomId) {
      // Create a room for this group
      const room = await createRoom('group', 'global', g.id);
      roomId = room.id;
      await supabase.from('groups').update({ room_id: room.id }).eq('id', g.id);
    }
    if (!roomId) return;

    await joinRoom(roomId, u.id, username);
    // Update member count
    await supabase.from('groups').update({ member_count: g.member_count + 1 }).eq('id', g.id);

    router.push(`/chat?room=${roomId}&username=${encodeURIComponent(username)}&group=${encodeURIComponent(g.name)}`);
  };

  return (
    <div className="page">
      <div className="topbar">
        <div className="topbar-inner">
          <a href="/" className="topbar-brand">around<span>U</span></a>
          <div className="topbar-nav">
            <button className="nav-item" onClick={() => router.push('/')}><IconHome size={20} /><span>Home</span></button>
            <button className="nav-item active"><IconUsers size={20} /><span>Groups</span></button>
            <button className="nav-item" onClick={() => router.push('/dating')}><IconHeart size={20} /><span>Dating</span></button>
            <button className="nav-item" onClick={() => router.push('/connections')}><IconChat size={20} /><span>Chats</span></button>
            <button className="nav-item" onClick={() => router.push('/login')}><IconUser size={20} /><span>Profile</span></button>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Groups</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 16 }}>Join a room, chat with everyone. Official groups are moderated.</p>

        <div className="tab-bar" style={{ marginBottom: 12 }}>
          {(['all', 'official', 'private'] as const).map(t => (
            <button key={t} className={`tab-item${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t === 'all' ? 'All' : t === 'official' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}><IconStar size={13} /> Official</span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}><IconLock size={13} /> Private</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', marginBottom: 14 }}>
          <IconSearch size={16} color="var(--text-3)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input className="input" placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(g => (
              <div key={g.id} className="group-card" onClick={() => joinGroup(g)}>
                <GroupInitials name={g.name} color={g.color} />
                <div className="group-meta">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="group-name">{g.name}</span>
                    {g.type === 'official' && <span className="tag tag-blue" style={{ fontSize: 10, padding: '1px 6px' }}>Official</span>}
                    {g.nsfw && <span className="tag tag-pink" style={{ fontSize: 10, padding: '1px 6px', display: 'flex', alignItems: 'center', gap: 2 }}><IconFlame size={10} />NSFW</span>}
                  </div>
                  <p className="group-desc">{g.description}</p>
                  <div className="group-stats">
                    <span className="group-stat"><IconUsers size={11} /> {fmt(g.member_count)}</span>
                    <span className="group-stat"><span className="dot-online" /> {g.online_count} online</span>
                  </div>
                </div>
                <IconChat size={16} color="var(--text-3)" />
              </div>
            ))}
            {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>No groups found</div>}
          </div>
        )}
      </div>


    </div>
  );
}
