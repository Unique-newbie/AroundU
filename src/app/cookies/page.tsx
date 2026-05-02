import Link from "next/link";
import { IconShield } from "@/lib/icons";

export default function CookiesPolicy() {
  return (
    <div className="page" style={{ paddingTop: 60, paddingBottom: 80, paddingLeft: 20, paddingRight: 20 }}>
      <div className="container" style={{ maxWidth: 800, margin: '0 auto' }}>
        <Link href="/" className="topbar-brand" style={{ marginBottom: 40, display: 'inline-block' }}>around<span>U</span></Link>
        
        <div style={{ background: 'var(--bg-2)', padding: '40px', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ background: 'var(--accent)', padding: 10, borderRadius: 12, color: '#fff' }}>
              <IconShield size={24} />
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>Cookie Policy</h1>
          </div>
          
          <p style={{ color: 'var(--text-2)', fontSize: 16, marginBottom: 32, lineHeight: 1.6 }}>
            Last updated: May 2026<br/><br/>
            AroundU is committed to being transparent about how we use cookies and similar technologies. Since we are an anonymous platform, our use of cookies is strictly minimal and focused on security and functionality.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, color: 'var(--text-2)', lineHeight: 1.7 }}>
            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>1. Essential Cookies Only</h2>
              <p>We do not use tracking cookies, advertising cookies, or third-party analytics that identify you across websites. We only use "strictly necessary" technologies required for the platform to function.</p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>2. Local Storage (Age Verification)</h2>
              <p>When you confirm that you are 18 or older, we store a small token (`aroundu_age_verified`) in your browser's Local Storage. This prevents the Age Gate from appearing every time you navigate or refresh the page. This token contains no personal data.</p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>3. Session Cookies (Authentication)</h2>
              <p>If you create an account to access Admin features or save groups, Supabase securely stores an authentication cookie to keep you logged in. If you use the site as an anonymous guest, a temporary session is established without persistent identifying cookies.</p>
            </section>
            
            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>4. Managing Your Preferences</h2>
              <p>Because our technologies are strictly necessary for the core functionality and legal compliance (Age Gate) of AroundU, they cannot be disabled through the site. You may clear your browser cookies and local storage at any time, but doing so will log you out and require you to pass the Age Gate again.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
