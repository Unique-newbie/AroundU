import Link from "next/link";
import { IconShield } from "@/lib/icons";

export default function PrivacyPolicy() {
  return (
    <div className="page" style={{ paddingTop: 60, paddingBottom: 80, paddingLeft: 20, paddingRight: 20 }}>
      <div className="container" style={{ maxWidth: 800, margin: '0 auto' }}>
        <Link href="/" className="topbar-brand" style={{ marginBottom: 40, display: 'inline-block' }}>around<span>U</span></Link>
        
        <div style={{ background: 'var(--bg-2)', padding: '40px', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ background: 'var(--accent)', padding: 10, borderRadius: 12, color: '#fff' }}>
              <IconShield size={24} />
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>Privacy Policy</h1>
          </div>
        
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, color: 'var(--text-2)', lineHeight: 1.7 }}>
            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>1. Information We Collect</h2>
              <p>We collect information you provide directly to us (e.g., email, username) and automatically generated data (e.g., location based on IP address or GPS if permitted, and chat messages).</p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>2. 24-Hour Deletion Policy</h2>
              <p>To ensure your privacy, <strong>all chat messages, group rooms, and uploaded media are permanently deleted from our servers every 24 hours</strong>. We do not keep backups of your private conversations beyond this period.</p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>3. Location Data</h2>
              <p>Location data is used strictly for regional matching (city, state, country level) and aggregated statistical displays. Precise coordinates are stored but not shared with other users.</p>
            </section>
            
            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>4. Third-Party Services</h2>
              <p>We use Supabase for database and authentication, and Cloudinary for temporary media storage. Please review their respective privacy policies.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
