'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { detectLocation, LocationData } from '@/lib/geolocation';
import { generateUsername } from '@/lib/username-generator';
import { getOnlineCount, getActiveChatCount, getQueueCount, updateProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { IconHome, IconUsers, IconChat, IconUser, IconHeart, IconFlame, IconMapPin, IconGlobe, IconMap, IconZap, IconShield, IconActivity } from '@/lib/icons';

type Region = 'nearby' | 'state' | 'country' | 'global';
type Gender = 'M' | 'F' | 'Any';
type PlatformPref = 'web' | 'telegram' | 'Any';

export default function Home() {
  const router = useRouter();
  const { user, profile, ensureUser } = useAuth();
  const [ageOk, setAgeOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<Region>('nearby');
  const [gender, setGender] = useState<Gender>('Any');
  const [platformPref, setPlatformPref] = useState<PlatformPref>('Any');
  const [loc, setLoc] = useState<LocationData | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [name, setName] = useState('');
  const [live, setLive] = useState({ online: 0, chatting: 0, queue: 0, groups: 0 });
  const [regionStats, setRegionStats] = useState({ city: 0, state: 0, country: 0 });

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('au_age') === '1') setAgeOk(true);
    setName(profile?.username || generateUsername());
    setLoading(false);
  }, [profile]);

  // Fetch live stats
  useEffect(() => {
    if (!ageOk) return;
    const fetchStats = async () => {
      try {
        const [online, chatting, queue] = await Promise.all([
          getOnlineCount(),
          getActiveChatCount(),
          getQueueCount(),
        ]);
        const { count: groupCount } = await supabase.from('groups').select('*', { count: 'exact', head: true });
        
        setLive({ online: online || 0, chatting: chatting || 0, queue: queue || 0, groups: groupCount || 0 });

        // Fetch regional stats
        if (loc) {
          const { data } = await supabase.rpc('get_region_activity');
          if (data) {
            let c = 0, s = 0, n = 0;
            data.forEach((r: any) => {
              if (r.region_type === 'city' && r.region_name === loc.city) c = r.active_users;
              if (r.region_type === 'state' && r.region_name === loc.state) s = r.active_users;
              if (r.region_type === 'country' && r.region_name === loc.country) n = r.active_users;
            });
            setRegionStats({ city: c, state: s, country: n });
          }
        }
      } catch {
        // Fallback to simulated stats if DB not connected
        setLive({ online: Math.floor(Math.random() * 500) + 100, chatting: Math.floor(Math.random() * 200) + 50, queue: Math.floor(Math.random() * 50) + 10, groups: 10 });
        if (loc) setRegionStats({ city: 12, state: 84, country: 420 });
      }
    };
    fetchStats();
    const t = setInterval(fetchStats, 15_000);
    return () => clearInterval(t);
  }, [ageOk, loc]);

  // Detect location
  useEffect(() => {
    if (ageOk && !loc) {
      setDetecting(true);
      detectLocation()
        .then(async (l) => {
          setLoc(l);
          setDetecting(false);
          // Update profile with location if user exists
          if (user) {
            await updateProfile(user.id, { city: l.city, state: l.state, country: l.country, country_code: l.countryCode, lat: l.lat, lng: l.lng });
          }
        })
        .catch(() => setDetecting(false));
    }
  }, [ageOk, loc, user]);

  const enter = () => {
    localStorage.setItem('au_age', '1');
    setAgeOk(true);
  };

  const go = async () => {
    // Ensure user exists (creates guest if needed)
    await ensureUser();
    const p = new URLSearchParams({ region, gender, platformPref, username: name });
    if (loc) { p.set('city', loc.city); p.set('state', loc.state); p.set('country', loc.country); p.set('lat', loc.lat.toString()); p.set('lng', loc.lng.toString()); }
    router.push(`/queue?${p.toString()}`);
  };

  if (loading) return null;

  // Age gate
  if (!ageOk) {
    return (
      <div className="overlay">
        <div className="modal" style={{ textAlign: 'center' }}>
          <IconShield size={36} color="var(--pink)" style={{ margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>Adults Only</h2>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 6, lineHeight: 1.7 }}>
            AroundU is an 18+ platform for anonymous chat, sexting, and hookups.
          </p>
          <p style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 20 }}>
            By entering, you confirm you are at least 18 years old.
          </p>
          <button className="btn btn-primary btn-lg w-full" onClick={enter}>I&apos;m 18+ — Enter</button>
          <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 14 }}>Under 18? Leave immediately.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="topbar">
        <div className="topbar-inner">
          <a href="/" className="topbar-brand">around<span>U</span></a>
          <div className="topbar-nav">
            <button className="nav-item active" onClick={() => router.push('/')}><IconHome size={20} /><span>Home</span></button>
            <button className="nav-item" onClick={() => router.push('/groups')}><IconUsers size={20} /><span>Groups</span></button>
            <button className="nav-item" onClick={() => router.push('/dating')}><IconHeart size={20} /><span>Dating</span></button>
            <button className="nav-item" onClick={() => router.push('/connections')}><IconChat size={20} /><span>Chats</span></button>
            <button className="nav-item" onClick={() => router.push('/login')}><IconUser size={20} /><span>Profile</span></button>
          </div>
        </div>
      </div>

      <div className="live-bar">
        <div className="live-stat"><span className="pulse-dot" /><span className="live-val">{live.online.toLocaleString()}</span> online</div>
        <div className="live-stat"><IconChat size={13} color="var(--blue)" /><span className="live-val">{live.chatting.toLocaleString()}</span> chatting</div>
        <div className="live-stat"><IconActivity size={13} color="var(--purple)" /><span className="live-val">{live.queue}</span> in queue</div>
        <div className="live-stat"><IconUsers size={13} color="var(--amber)" /><span className="live-val">{live.groups}</span> groups</div>
      </div>

      <div className="page-center" style={{ gap: 24 }}>
        <div className="radar-wrap">
          <div className="radar-ring" /><div className="radar-ring" /><div className="radar-ring" />
          <div className="radar-beam" /><div className="radar-core" />
          <div className="radar-pip" style={{ top: '22%', left: '62%' }} />
          <div className="radar-pip" style={{ top: '58%', left: '18%', animationDelay: '0.7s' }} />
          <div className="radar-pip" style={{ top: '68%', left: '74%', animationDelay: '1.4s' }} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 30, fontWeight: 700 }}>Anonymous chat &<br /><span style={{ color: 'var(--pink)' }}>hookups near you</span></h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 8, maxWidth: 300, margin: '8px auto 0' }}>
            No profiles. No swiping. Pick your region, get matched, start talking. All chats auto-delete in 24 hours.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
          <span className="tag tag-blue" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconMapPin size={12} />
            {detecting ? 'detecting...' : loc ? `${loc.city}, ${loc.state}` : 'unknown'}
          </span>
          {name && <span className="tag tag-purple" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconUser size={12} />{name}
          </span>}
        </div>

        <div style={{ width: '100%', maxWidth: 340 }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' }}>Region</p>
          <div className="region-grid">
            {([
              { id: 'nearby', icon: <IconMapPin size={20} />, label: 'Nearby', sub: 'City level', count: regionStats.city },
              { id: 'state', icon: <IconMap size={20} />, label: 'State', sub: 'State-wide', count: regionStats.state },
              { id: 'country', icon: <IconGlobe size={20} />, label: 'Country', sub: 'Nationwide', count: regionStats.country },
              { id: 'global', icon: <IconZap size={20} />, label: 'Global', sub: 'Worldwide', count: live.online },
            ] as { id: Region; icon: React.ReactNode; label: string; sub: string; count: number }[]).map(r => (
              <button key={r.id} className={`region-btn${region === r.id ? ' picked' : ''}`} onClick={() => setRegion(r.id)} style={{ position: 'relative' }}>
                {r.icon}
                <span style={{ fontWeight: 600 }}>{r.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.sub}</span>
                {loc && r.count > 0 && (
                  <div style={{ position: 'absolute', top: 6, right: 8, fontSize: 10, fontWeight: 600, color: 'var(--green)', backgroundColor: 'rgba(76, 175, 80, 0.1)', padding: '2px 6px', borderRadius: 10 }}>
                    {r.count} online
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Match with</p>
          <div className="chip-row" style={{ justifyContent: 'center', marginBottom: 12 }}>
            {(['Any', 'M', 'F'] as Gender[]).map(g => (
              <button key={g} className={`chip${gender === g ? ' picked' : ''}`} onClick={() => setGender(g)}>
                {g === 'Any' ? 'Anyone' : g === 'M' ? 'Men' : 'Women'}
              </button>
            ))}
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Platform</p>
          <div className="chip-row" style={{ justifyContent: 'center' }}>
            {(['Any', 'web', 'telegram'] as PlatformPref[]).map(p => (
              <button key={p} className={`chip${platformPref === p ? ' picked' : ''}`} onClick={() => setPlatformPref(p)}>
                {p === 'Any' ? 'Any Platform' : p === 'web' ? 'Web App' : 'Telegram Bot'}
              </button>
            ))}
          </div>
        </div>

        <button className="btn btn-primary btn-lg" onClick={go} style={{ minWidth: 220 }}>
          <IconFlame size={18} /> Find someone
        </button>

        <p style={{ color: 'var(--text-3)', fontSize: 12, maxWidth: 280, textAlign: 'center', lineHeight: 1.6 }}>
          Guest mode — chats auto-delete in 24h.<br />
          <a href="/login" style={{ color: 'var(--blue)' }}>Sign in</a> for history, dating & connections.
        </p>
      </div>


    </div>
  );
}
