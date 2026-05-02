'use client';
import { useRouter } from 'next/navigation';
import { IconShield, IconClock, IconFlame, IconGlobe, IconHeart, IconEyeOff, IconZap, IconChevLeft, IconMapPin, IconLock, IconUsers, IconTrash } from '@/lib/icons';

const features = [
  { icon: <IconFlame size={22} color="var(--pink)" />, title: 'Instant matching', desc: 'One tap. No sign-up needed. Get matched with a stranger in seconds.' },
  { icon: <IconMapPin size={22} color="var(--blue)" />, title: 'Region filtering', desc: 'Chat with people nearby, statewide, nationwide, or worldwide.' },
  { icon: <IconShield size={22} color="var(--green)" />, title: 'Anonymous & safe', desc: 'No real names, no photos required. Report & block tools built-in.' },
  { icon: <IconClock size={22} color="var(--amber)" />, title: '24h auto-delete', desc: 'All messages and shared media are permanently deleted every 24 hours.' },
  { icon: <IconHeart size={22} color="var(--pink)" />, title: 'Dating pool', desc: 'Swipe, match, and message — for users who sign in.' },
  { icon: <IconUsers size={22} color="var(--purple)" />, title: 'Group chats', desc: 'Join public rooms or create private spaces for your community.' },
  { icon: <IconEyeOff size={22} color="var(--pink)" />, title: 'NSFW controls', desc: 'Mutual opt-in NSFW toggle — both users must consent.' },
  { icon: <IconLock size={22} color="var(--blue)" />, title: 'Zero data retention', desc: 'We never sell your data. We don\'t even keep it longer than 24 hours.' },
];

export default function AboutPage() {
  const router = useRouter();

  return (
    <div className="page">
      <div className="topbar">
        <div className="topbar-inner" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href="/" className="topbar-brand">around<span>U</span></a>
          <button className="btn btn-sm btn-ghost" onClick={() => router.push('/')}><IconChevLeft size={14} /> Back</button>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 20, paddingBottom: 60, maxWidth: 520 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>About <span style={{ color: 'var(--pink)' }}>AroundU</span></h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
          AroundU is a region-based anonymous chat and hookup platform. Think Omegle, but with persistent rooms,
          group chats, dating, and a strict 24-hour data purge. We&apos;re built for adults who want real, raw
          connections without the baggage of traditional social apps.
        </p>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>How it works</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 32 }}>
          {features.map(f => (
            <div key={f.title} className="card" style={{ padding: 16 }}>
              <div style={{ marginBottom: 8 }}>{f.icon}</div>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{f.title}</h3>
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 20, borderColor: 'var(--pink)', borderWidth: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <IconTrash size={20} color="var(--pink)" />
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>24-Hour Data Policy</h3>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
            Every message, image, and shared file is <strong style={{ color: 'var(--text-0)' }}>permanently deleted</strong> 24 hours after
            it was sent. This is automated — no one can access old data, not even us. Your conversations are truly ephemeral.
          </p>
        </div>

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>
            AroundU is an 18+ platform. Underage usage is strictly prohibited.<br />
            We reserve the right to ban users who violate our community guidelines.
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 12 }}>
            Built with Next.js, Supabase, and Cloudinary.
          </p>
        </div>
      </div>
    </div>
  );
}
