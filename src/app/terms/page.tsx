import Link from "next/link";
import { IconDocument } from "@/lib/icons";

export default function TermsOfService() {
  return (
    <div className="page" style={{ paddingTop: 60, paddingBottom: 80, paddingLeft: 20, paddingRight: 20 }}>
      <div className="container" style={{ maxWidth: 800, margin: '0 auto' }}>
        <Link href="/" className="topbar-brand" style={{ marginBottom: 40, display: 'inline-block' }}>around<span>U</span></Link>
        
        <div style={{ background: 'var(--bg-2)', padding: '40px', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ background: 'var(--accent)', padding: 10, borderRadius: 12, color: '#fff' }}>
              <IconDocument size={24} />
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>Terms of Service</h1>
          </div>
        
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, color: 'var(--text-2)', lineHeight: 1.7 }}>
            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>1. Age Restriction</h2>
              <p>You must be at least 18 years of age to access or use AroundU. By using this service, you represent and warrant that you meet this age requirement. If you are under 18, you are strictly prohibited from using the platform.</p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>2. User Content & Conduct</h2>
              <p>You are solely responsible for your conduct and any data, text, files, information, images, or links that you submit or display on AroundU. While we allow mature themes in private contexts, sharing illegal content (such as CSAM, non-consensual imagery, or content promoting terrorism) is strictly prohibited and will result in an immediate permanent ban and potential legal action.</p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>3. Platform Moderation</h2>
              <p>We rely heavily on user reports to moderate the platform. We reserve the right to ban any account or IP address that violates these terms or disrupts the community.</p>
            </section>

            <section>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>4. No Warranty</h2>
              <p>AroundU is provided &quot;as is&quot; without warranty of any kind. We do not guarantee continuous, uninterrupted access to the platform.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
