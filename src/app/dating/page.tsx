'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { supabase, DatingProfile } from '@/lib/supabase';
import { IconHome, IconUsers, IconChat, IconUser, IconHeart, IconHeartFill, IconX, IconStar, IconMapPin, IconChevLeft } from '@/lib/icons';

const COLORS = ['pink', 'blue', 'purple', 'green'];
const TAGS_LIST = ['Night owl', 'Fit', 'Gamer', 'Netflix', 'Traveler', 'Foodie', 'Reader', 'Kinky', 'Sapiosexual', 'Adventurous', '420 friendly', 'Introvert', 'Extrovert', 'Dog lover'];
const GRADIENTS: Record<string, string> = {
  pink: 'linear-gradient(135deg, #e91e63 0%, #f06292 100%)',
  blue: 'linear-gradient(135deg, #2196f3 0%, #64b5f6 100%)',
  purple: 'linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%)',
  green: 'linear-gradient(135deg, #4caf50 0%, #81c784 100%)',
};

type SwipeDir = 'left' | 'right' | 'super';

export default function DatingPage() {
  const router = useRouter();
  const { user, profile, isSignedIn, ensureUser } = useAuth();
  const [cards, setCards] = useState<DatingProfile[]>([]);
  const [idx, setIdx] = useState(0);
  const [anim, setAnim] = useState<SwipeDir | null>(null);
  const [matchPopup, setMatchPopup] = useState<DatingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [setup, setSetup] = useState({ name: '', age: '', bio: '', tags: [] as string[] });

  // Check auth
  useEffect(() => {
    if (!isSignedIn && !showSetup) {
      // Not signed in — show gate
    }
  }, [isSignedIn, showSetup]);

  // Load dating profiles
  useEffect(() => {
    if (!isSignedIn) { setLoading(false); return; }
    const load = async () => {
      try {
        // Check if user has a dating profile
        const { data: myProfile } = await supabase.from('dating_profiles').select('*').eq('user_id', user!.id).single();
        if (!myProfile) { setShowSetup(true); setLoading(false); return; }

        // Load other profiles (exclude self, and already swiped)
        const { data: swiped } = await supabase.from('dating_swipes').select('swiped_id').eq('swiper_id', user!.id);
        const swipedIds = (swiped || []).map(s => s.swiped_id);

        let query = supabase.from('dating_profiles').select('*').neq('user_id', user!.id).eq('active', true);
        if (swipedIds.length > 0) {
          query = query.not('user_id', 'in', `(${swipedIds.join(',')})`);
        }
        const { data: profiles } = await query.limit(20);
        setCards((profiles as DatingProfile[]) || []);
      } catch {
        // Fallback mock profiles
        setCards([
          { id: '1', user_id: 'u1', display_name: 'Alex', age: 24, bio: 'Night owl, music lover. Looking for fun.', tags: ['Night owl', 'Gamer', '420 friendly'], color: 'pink', verified: false, city: 'Delhi', active: true, created_at: '', lat: 0, lng: 0 },
          { id: '2', user_id: 'u2', display_name: 'Jordan', age: 27, bio: 'Fitness + deep conversations = me.', tags: ['Fit', 'Sapiosexual', 'Adventurous'], color: 'blue', verified: true, city: 'Mumbai', active: true, created_at: '', lat: 0, lng: 0 },
          { id: '3', user_id: 'u3', display_name: 'River', age: 22, bio: 'Here for a good time not a long time 🔥', tags: ['Kinky', 'Night owl', 'Extrovert'], color: 'purple', verified: false, city: 'Bangalore', active: true, created_at: '', lat: 0, lng: 0 },
          { id: '4', user_id: 'u4', display_name: 'Sky', age: 26, bio: 'Looking to connect on a deeper level.', tags: ['Traveler', 'Foodie', 'Dog lover'], color: 'green', verified: false, city: 'Pune', active: true, created_at: '', lat: 0, lng: 0 },
        ] as DatingProfile[]);
      }
      setLoading(false);
    };
    load();
  }, [isSignedIn, user, showSetup]);

  const swipe = async (dir: SwipeDir) => {
    if (idx >= cards.length) return;
    const target = cards[idx];
    setAnim(dir);

    // Record swipe
    if (user) {
      const action = dir === 'right' ? 'like' : dir === 'super' ? 'super' : 'pass';
      try {
        await supabase.from('dating_swipes').insert({
          swiper_id: user.id, swiped_id: target.user_id, action,
        });

        // Check for mutual like
        if (action === 'like' || action === 'super') {
          const { data: mutual } = await supabase
            .from('dating_swipes')
            .select('id')
            .eq('swiper_id', target.user_id)
            .eq('swiped_id', user.id)
            .in('action', ['like', 'super']);

          if (mutual && mutual.length > 0) {
            // It's a match! Create a match record and chat room
            await supabase.from('dating_matches').insert({
              user_a: user.id, user_b: target.user_id,
            });
            setMatchPopup(target);
          }
        }
      } catch { /* swipe locally */ }
    }

    setTimeout(() => { setAnim(null); setIdx(i => i + 1); }, 300);
  };

  const handleSetup = async () => {
    if (!setup.name || !setup.age || !user) return;
    try {
      await supabase.from('dating_profiles').insert({
        user_id: user.id,
        display_name: setup.name,
        age: parseInt(setup.age),
        bio: setup.bio,
        tags: setup.tags,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        city: profile?.city || '',
        lat: profile?.lat || 0,
        lng: profile?.lng || 0,
      });
    } catch { /* continue anyway */ }
    setShowSetup(false);
  };

  // Auth gate
  if (!isSignedIn) {
    return (
      <div className="page">
        <div className="topbar">
          <div className="topbar-inner">
            <a href="/" className="topbar-brand">around<span>U</span></a>
            <div className="topbar-nav">
              <button className="nav-item" onClick={() => router.push('/')}><IconHome size={20} /><span>Home</span></button>
              <button className="nav-item" onClick={() => router.push('/groups')}><IconUsers size={20} /><span>Groups</span></button>
              <button className="nav-item active"><IconHeart size={20} /><span>Dating</span></button>
              <button className="nav-item" onClick={() => router.push('/connections')}><IconChat size={20} /><span>Chats</span></button>
              <button className="nav-item" onClick={() => router.push('/login')}><IconUser size={20} /><span>Profile</span></button>
            </div>
          </div>
        </div>
        <div className="page-center" style={{ gap: 16 }}>
          <IconHeart size={48} color="var(--pink)" />
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Dating</h2>
          <p style={{ color: 'var(--text-2)', fontSize: 14, textAlign: 'center', maxWidth: 300 }}>
            Swipe, match, and chat — sign in to access the dating pool.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => router.push('/login')}>Sign in to continue</button>
          <button className="btn btn-ghost" onClick={() => router.push('/')}>Back to home</button>
        </div>
      </div>
    );
  }

  // Profile setup
  if (showSetup) {
    return (
      <div className="page">
        <div className="topbar">
          <div className="topbar-inner" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="btn-icon" onClick={() => router.push('/')}><IconChevLeft size={16} /></button>
            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700 }}>Create Dating Profile</span>
            <div style={{ width: 32 }} />
          </div>
        </div>
        <div className="page-center" style={{ gap: 14, maxWidth: 340, padding: 20 }}>
          <input className="input" placeholder="Display name" value={setup.name} onChange={e => setSetup({ ...setup, name: e.target.value })} />
          <input className="input" placeholder="Age (18+)" type="number" min={18} max={99} value={setup.age} onChange={e => setSetup({ ...setup, age: e.target.value })} />
          <textarea className="input" placeholder="Short bio..." value={setup.bio} onChange={e => setSetup({ ...setup, bio: e.target.value })} rows={3} style={{ resize: 'none' }} />
          <p style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 1, marginTop: 4 }}>Tags (pick up to 5)</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TAGS_LIST.map(t => (
              <button key={t} className={`chip${setup.tags.includes(t) ? ' picked' : ''}`} onClick={() => {
                setSetup(s => ({ ...s, tags: s.tags.includes(t) ? s.tags.filter(x => x !== t) : s.tags.length < 5 ? [...s.tags, t] : s.tags }));
              }}>{t}</button>
            ))}
          </div>
          <button className="btn btn-primary btn-lg w-full" disabled={!setup.name || !setup.age || parseInt(setup.age) < 18} onClick={handleSetup}>
            Start swiping
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="page"></div>;

  const card = cards[idx];

  return (
    <div className="page">
      <div className="topbar">
        <div className="topbar-inner">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <a href="/" className="topbar-brand">around<span>U</span></a>
            <span style={{ fontSize: 13, color: 'var(--text-2)', fontFamily: 'Space Grotesk' }}>{cards.length - idx} left</span>
          </div>
          <div className="topbar-nav">
            <button className="nav-item" onClick={() => router.push('/')}><IconHome size={20} /><span>Home</span></button>
            <button className="nav-item" onClick={() => router.push('/groups')}><IconUsers size={20} /><span>Groups</span></button>
            <button className="nav-item active"><IconHeart size={20} /><span>Dating</span></button>
            <button className="nav-item" onClick={() => router.push('/connections')}><IconChat size={20} /><span>Chats</span></button>
            <button className="nav-item" onClick={() => router.push('/login')}><IconUser size={20} /><span>Profile</span></button>
          </div>
        </div>
      </div>

      <div className="swipe-area">
        {card ? (
          <div className={`swipe-stack${anim === 'left' ? ' swiped-left' : anim === 'right' ? ' swiped-right' : anim === 'super' ? ' swiped-up' : ''}`}>
            <div className="swipe-card" style={{ background: GRADIENTS[card.color] || GRADIENTS.pink }}>
              {card.verified && <div className="tag tag-green" style={{ position: 'absolute', top: 16, right: 16, fontSize: 10, zIndex: 10 }}>Verified</div>}
              
              {/* Premium Card Overlay layout */}
              <div className="swipe-card-overlay">
                <div>
                  <span className="swipe-name">{card.display_name}</span>
                  <span className="swipe-age">{card.age}</span>
                </div>
                {card.city && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontWeight: 500 }}><IconMapPin size={12} /> {card.city}</p>}
                <p className="swipe-bio">{card.bio}</p>
                <div className="swipe-tags">
                  {card.tags.map(t => <span key={t} className="chip" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', borderColor: 'transparent', fontSize: 11, padding: '4px 10px', backdropFilter: 'blur(4px)' }}>{t}</span>)}
                </div>
              </div>

              {anim === 'right' && <div className="swipe-overlay-like" style={{ position: 'absolute', top: 40, right: 40, border: '4px solid #4caf50', color: '#4caf50', fontSize: 32, fontWeight: 800, padding: '8px 16px', borderRadius: 8, transform: 'rotate(15deg)', zIndex: 10 }}>LIKE</div>}
              {anim === 'left' && <div className="swipe-overlay-nope" style={{ position: 'absolute', top: 40, left: 40, border: '4px solid #f44336', color: '#f44336', fontSize: 32, fontWeight: 800, padding: '8px 16px', borderRadius: 8, transform: 'rotate(-15deg)', zIndex: 10 }}>NOPE</div>}
              {anim === 'super' && <div className="swipe-overlay-super" style={{ position: 'absolute', bottom: 120, left: '50%', transform: 'translateX(-50%)', border: '4px solid #2196f3', color: '#2196f3', fontSize: 32, fontWeight: 800, padding: '8px 16px', borderRadius: 8, zIndex: 10 }}>SUPER</div>}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <IconHeart size={48} color="var(--text-3)" />
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 12 }}>No more profiles right now.</p>
            <p style={{ color: 'var(--text-3)', fontSize: 12 }}>Check back later for new people.</p>
          </div>
        )}
      </div>

      {card && (
        <div className="swipe-actions">
          <button className="swipe-btn swipe-btn-nope" onClick={() => swipe('left')}><IconX size={28} /></button>
          <button className="swipe-btn swipe-btn-super" onClick={() => swipe('super')}><IconStar size={24} /></button>
          <button className="swipe-btn swipe-btn-like" onClick={() => swipe('right')}><IconHeartFill size={28} color="#e91e63" /></button>
        </div>
      )}

      {/* Match popup */}
      {matchPopup && (
        <div className="overlay" onClick={() => setMatchPopup(null)}>
          <div className="modal match-modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="match-hearts">
              <IconHeartFill size={40} color="var(--pink)" />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, background: 'linear-gradient(90deg, var(--pink), var(--blue))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>It&apos;s a Match!</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 4 }}>You and <strong>{matchPopup.display_name}</strong> liked each other.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setMatchPopup(null); router.push('/connections'); }}>Message</button>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setMatchPopup(null)}>Keep swiping</button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
