'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { IconShield, IconFlag, IconBan, IconCheck, IconUsers, IconTrash, IconSearch, IconChevLeft, IconHeart, IconChat, IconUser, IconEye, IconX, IconActivity } from '@/lib/icons';

type Tab = 'dashboard'|'users'|'chats'|'reports'|'groups'|'dating'|'connections'|'media';

const adminFetch = async (action: string, params: any = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/admin', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ action, ...params }),
  });
  return res.json();
};

const Stat = ({ label, val, color }: { label: string; val: number; color: string }) => (
  <div className="card" style={{ padding: 14, textAlign: 'center', minWidth: 80 }}>
    <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: 'Space Grotesk' }}>{val}</div>
    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{label}</div>
  </div>
);

const Badge = ({ text, color }: { text: string; color: string }) => (
  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: `${color}18`, color, fontWeight: 600, border: `1px solid ${color}33` }}>{text}</span>
);

export default function AdminPage() {
  const router = useRouter();
  const { profile, session, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});
  const [users, setUsers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [roomMsgs, setRoomMsgs] = useState<any[]>([]);
  const [viewRoom, setViewRoom] = useState<string|null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [dating, setDating] = useState<any>({ profiles: [], swipes: [], matches: [] });
  const [connections, setConnections] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [tgFiles, setTgFiles] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    try {
      if (t === 'dashboard') { const d = await adminFetch('getStats'); setStats(d); }
      else if (t === 'users') { const d = await adminFetch('getUsers'); setUsers(d.users || []); }
      else if (t === 'chats') { const d = await adminFetch('getRooms'); setRooms(d.rooms || []); }
      else if (t === 'reports') { const d = await adminFetch('getReports'); setReports(d.reports || []); }
      else if (t === 'groups') { const d = await adminFetch('getGroups'); setGroups(d.groups || []); }
      else if (t === 'dating') { const d = await adminFetch('getDating'); setDating(d); }
      else if (t === 'connections') { const d = await adminFetch('getConnections'); setConnections(d.connections || []); }
      else if (t === 'media') {
        const [d1, d2] = await Promise.all([adminFetch('getMedia'), adminFetch('getTelegramFiles')]);
        setMedia(d1.media || []); setTgFiles(d2.files || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (!authLoading && profile?.is_admin) load(tab); }, [authLoading, profile, tab, load]);

  const openRoom = async (roomId: string) => {
    setViewRoom(roomId);
    const d = await adminFetch('getRoomMessages', { roomId });
    setRoomMsgs(d.messages || []);
  };

  if (authLoading) return <div className="page"></div>;
  if (!profile?.is_admin) return (
    <div className="page"><div className="page-center" style={{ gap: 16 }}>
      <IconShield size={40} color="var(--text-3)" />
      <h2 style={{ fontSize: 20, fontWeight: 700 }}>Access Denied</h2>
      <button className="btn btn-ghost" onClick={() => router.push('/')}><IconChevLeft size={14} /> Back</button>
    </div></div>
  );

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <IconActivity size={14} /> },
    { id: 'users', label: 'Users', icon: <IconUsers size={14} /> },
    { id: 'chats', label: 'Chats', icon: <IconChat size={14} /> },
    { id: 'reports', label: 'Reports', icon: <IconFlag size={14} /> },
    { id: 'groups', label: 'Groups', icon: <IconUsers size={14} /> },
    { id: 'dating', label: 'Dating', icon: <IconHeart size={14} /> },
    { id: 'connections', label: 'Connections', icon: <IconUser size={14} /> },
    { id: 'media', label: 'Media', icon: <IconEye size={14} /> },
  ];

  const filteredUsers = users.filter(u => !search || u.username?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page">
      <div className="topbar">
        <div className="topbar-inner" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconShield size={18} color="var(--pink)" />
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 16 }}>Admin Console</span>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => router.push('/')}>Exit</button>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 16, paddingBottom: 40, maxWidth: 900 }}>
        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); setViewRoom(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Space Grotesk', whiteSpace: 'nowrap',
                background: tab === t.id ? 'rgba(255,0,85,0.1)' : 'rgba(255,255,255,0.03)', color: tab === t.id ? 'var(--pink)' : 'var(--text-2)',
                boxShadow: tab === t.id ? 'inset 0 0 0 1px rgba(255,0,85,0.25)' : 'none', transition: 'all 0.2s' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-3)' }}>Loading...</div> : (
          <>
            {/* DASHBOARD */}
            {tab === 'dashboard' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                <Stat label="Users" val={stats.totalUsers} color="var(--blue)" />
                <Stat label="Online" val={stats.onlineUsers} color="var(--green)" />
                <Stat label="Banned" val={stats.bannedUsers} color="var(--pink)" />
                <Stat label="Reports" val={stats.pendingReports} color="var(--amber)" />
                <Stat label="Rooms" val={stats.totalRooms} color="var(--purple)" />
                <Stat label="Messages" val={stats.totalMessages} color="var(--blue)" />
                <Stat label="Dating" val={stats.totalDatingProfiles} color="var(--pink)" />
                <Stat label="Matches" val={stats.totalMatches} color="var(--green)" />
                <Stat label="Connections" val={stats.totalConnections} color="var(--amber)" />
                <Stat label="Groups" val={stats.totalGroups} color="var(--purple)" />
              </div>
            )}

            {/* USERS */}
            {tab === 'users' && (
              <div>
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <IconSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
                  <input className="input" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34 }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>{filteredUsers.length} users</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filteredUsers.map(u => (
                    <div key={u.id} className="card" style={{ padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{u.username}</span>
                            {u.is_online && <Badge text="ONLINE" color="var(--green)" />}
                            {u.is_guest && <Badge text="GUEST" color="var(--amber)" />}
                            {u.is_banned && <Badge text="BANNED" color="var(--pink)" />}
                            {u.is_admin && <Badge text="ADMIN" color="var(--purple)" />}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {u.email && <span>✉ {u.email}</span>}
                            <span>📍 {[u.city, u.state, u.country].filter(Boolean).join(', ') || 'Unknown location'}</span>
                            {u.ip_address && <span>🌐 IP: {u.ip_address}</span>}
                            <span>👤 Gender: {u.gender || '—'} · Joined: {new Date(u.created_at).toLocaleDateString()}</span>
                            {u.last_seen && <span>🕐 Last seen: {new Date(u.last_seen).toLocaleString()}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          {!u.is_banned ? (
                            <button className="btn btn-sm btn-danger" onClick={async () => { await adminFetch('banUser', { userId: u.id }); load('users'); }}><IconBan size={12} /> Ban</button>
                          ) : (
                            <button className="btn btn-sm btn-outline" onClick={async () => { await adminFetch('unbanUser', { userId: u.id }); load('users'); }}><IconCheck size={12} /> Unban</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CHATS */}
            {tab === 'chats' && !viewRoom && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rooms.length === 0 ? <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>No chat rooms</div> :
                  rooms.map(r => (
                    <div key={r.id} className="card" style={{ padding: 12, cursor: 'pointer' }} onClick={() => openRoom(r.id)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <IconChat size={14} color="var(--blue)" />
                            {r.type === 'group' ? 'Group Room' : '1v1 Room'}
                            <Badge text={r.type} color="var(--blue)" />
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                            Participants: {(r.participants || []).map((p: any) => p.username).join(', ') || '—'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
                            Created: {new Date(r.created_at).toLocaleString()} · Expires: {new Date(r.expires_at).toLocaleString()}
                          </div>
                        </div>
                        <IconEye size={16} color="var(--text-3)" />
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* CHAT VIEWER */}
            {tab === 'chats' && viewRoom && (
              <div>
                <button className="btn btn-sm btn-ghost" onClick={() => { setViewRoom(null); setRoomMsgs([]); }} style={{ marginBottom: 12 }}><IconChevLeft size={14} /> Back to rooms</button>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Room: {viewRoom}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>{roomMsgs.length} messages</span>
                  </div>
                  <div style={{ maxHeight: 500, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {roomMsgs.map((m: any) => (
                      <div key={m.id} style={{ padding: '8px 12px', background: m.msg_type === 'system' ? 'var(--bg-3)' : 'var(--bg-2)', borderRadius: 10, fontSize: 13 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, color: m.msg_type === 'system' ? 'var(--amber)' : 'var(--blue)', fontSize: 12 }}>{m.sender_username || 'System'}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{new Date(m.created_at).toLocaleString()}</span>
                        </div>
                        {m.content && <p style={{ color: 'var(--text-1)' }}>{m.content}</p>}
                        {m.media_url && <img src={m.media_url} alt="media" style={{ maxWidth: 200, borderRadius: 8, marginTop: 6 }} />}
                        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>Sender ID: {m.sender_id || '—'}</div>
                      </div>
                    ))}
                    {roomMsgs.length === 0 && <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: 20 }}>No messages in this room</p>}
                  </div>
                </div>
              </div>
            )}

            {/* REPORTS */}
            {tab === 'reports' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {reports.length === 0 ? <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>No reports</div> :
                  reports.map(r => (
                    <div key={r.id} className="card" style={{ padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{r.reported_username}</span>
                        <Badge text={r.status} color={r.status === 'pending' ? 'var(--amber)' : r.status === 'banned' ? 'var(--pink)' : 'var(--green)'} />
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>Reason: {r.reason}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)' }}>By: {r.reporter_username} · {new Date(r.created_at).toLocaleDateString()}</p>
                      {r.room_id && <p style={{ fontSize: 10, color: 'var(--text-3)' }}>Room: {r.room_id}</p>}
                      {r.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          <button className="btn btn-sm btn-danger" onClick={async () => { await adminFetch('handleReport', { reportId: r.id, status: 'banned', userId: r.reported_id }); load('reports'); }}><IconBan size={12} /> Ban</button>
                          <button className="btn btn-sm btn-outline" onClick={async () => { await adminFetch('handleReport', { reportId: r.id, status: 'resolved' }); load('reports'); }}><IconCheck size={12} /> Dismiss</button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {/* GROUPS */}
            {tab === 'groups' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {groups.map(g => (
                  <div key={g.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className={`avatar avatar-${g.color}`} style={{ width: 36, height: 36, fontSize: 13 }}>
                      {g.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {g.name}
                        {g.nsfw && <Badge text="NSFW" color="var(--pink)" />}
                        <Badge text={g.type} color="var(--blue)" />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{g.member_count} members · {g.description?.slice(0, 60)}</div>
                    </div>
                    <button className="btn-icon" onClick={async () => { await adminFetch('deleteGroup', { groupId: g.id }); load('groups'); }} style={{ color: 'var(--pink)' }}><IconTrash size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            {/* DATING */}
            {tab === 'dating' && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Dating Profiles ({dating.profiles.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
                  {dating.profiles.map((p: any) => (
                    <div key={p.id} className="card" style={{ padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{p.display_name}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-2)', marginLeft: 8 }}>Age: {p.age}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {p.verified && <Badge text="VERIFIED" color="var(--green)" />}
                          {p.active ? <Badge text="ACTIVE" color="var(--green)" /> : <Badge text="INACTIVE" color="var(--text-3)" />}
                        </div>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{p.bio || 'No bio'}</p>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
                        User ID: {p.user_id} · City: {p.city || '—'} · Tags: {(p.tags || []).join(', ') || '—'}
                      </div>
                    </div>
                  ))}
                  {dating.profiles.length === 0 && <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No dating profiles</p>}
                </div>

                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Matches ({dating.matches.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
                  {dating.matches.map((m: any) => (
                    <div key={m.id} className="card" style={{ padding: 10, fontSize: 12 }}>
                      <span style={{ color: 'var(--pink)', fontWeight: 600 }}>Match:</span> {m.user_a?.slice(0,8)} ↔ {m.user_b?.slice(0,8)}
                      <span style={{ color: 'var(--text-3)', marginLeft: 8 }}>{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                  {dating.matches.length === 0 && <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No matches yet</p>}
                </div>

                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Recent Swipes ({dating.swipes.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {dating.swipes.slice(0, 50).map((s: any) => (
                    <div key={s.id} className="card" style={{ padding: 8, fontSize: 11, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span>{s.swiper_id?.slice(0,8)}</span>
                      <Badge text={s.action} color={s.action === 'like' ? 'var(--green)' : s.action === 'super' ? 'var(--pink)' : 'var(--text-3)'} />
                      <span>→ {s.swiped_id?.slice(0,8)}</span>
                      <span style={{ color: 'var(--text-3)', marginLeft: 'auto' }}>{new Date(s.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                  {dating.swipes.length === 0 && <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No swipes</p>}
                </div>
              </div>
            )}

            {/* CONNECTIONS */}
            {tab === 'connections' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {connections.length === 0 ? <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: 32 }}>No connections</p> :
                  connections.map((c: any) => (
                    <div key={c.id} className="card" style={{ padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--blue)' }}>{c.username_a}</span>
                        <span style={{ color: 'var(--text-3)' }}>↔</span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--green)' }}>{c.username_b}</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>Last msg: {c.last_message || '—'}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-3)' }}>Saved: {new Date(c.created_at).toLocaleString()} · Last active: {new Date(c.last_message_at).toLocaleString()}</p>
                    </div>
                  ))}
              </div>
            )}

            {/* MEDIA */}
            {tab === 'media' && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>{media.length} media files shared across all chats</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                  {media.map((m: any) => (
                    <div key={m.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      <a href={m.media_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                        <img src={m.media_url} alt="shared media" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
                      </a>
                      <div style={{ padding: '8px 10px' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue)' }}>{m.sender_username || 'Unknown'}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>Room: {m.room_id?.slice(0, 8)}…</div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{new Date(m.created_at).toLocaleString()}</div>
                        {m.content && <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4 }}>{m.content}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {media.length === 0 && <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)' }}>No media shared yet</div>}

                {/* Telegram Bot Files */}
                <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 28, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  📲 Telegram Bot Files <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-3)' }}>({tgFiles.length})</span>
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {tgFiles.map((f: any) => (
                    <div key={f.id} className="card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                        {f.file_type === 'photo' ? '🖼' : f.file_type === 'video' ? '🎬' : f.file_type === 'voice' ? '🎙' : f.file_type === 'sticker' ? '🏷' : f.file_type === 'video_note' ? '⏺' : '📎'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--blue)' }}>{f.username || 'Unknown'}</span>
                          <Badge text={f.file_type} color="var(--purple)" />
                          {f.mime_type && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{f.mime_type}</span>}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                          {f.file_name || 'No filename'} · {f.file_size ? `${(f.file_size / 1024).toFixed(1)} KB` : '—'} · {new Date(f.created_at).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>TG Chat: {f.telegram_chat_id} · User: {f.user_id?.slice(0, 8)}…</div>
                      </div>
                      <button className="btn btn-sm btn-outline" style={{ flexShrink: 0 }} onClick={async () => {
                        const d = await adminFetch('resolveTelegramFile', { fileId: f.file_id });
                        if (d.url) window.open(d.url, '_blank');
                        else alert('File expired or not found on Telegram servers');
                      }}>⬇ Download</button>
                    </div>
                  ))}
                  {tgFiles.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', padding: 16 }}>No Telegram bot files logged yet</p>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
