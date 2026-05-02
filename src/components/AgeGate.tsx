'use client';
import { useState, useEffect } from 'react';
import { IconShield } from '@/lib/icons';

export default function AgeGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if user has already verified age
    const isVerified = localStorage.getItem('aroundu_age_verified');
    if (!isVerified) {
      setShow(true);
    }
  }, []);

  const handleConfirm = () => {
    localStorage.setItem('aroundu_age_verified', 'true');
    setShow(false);
  };

  const handleDeny = () => {
    window.location.href = 'https://www.google.com';
  };

  if (!show) return null;

  return (
    <div className="overlay" style={{ zIndex: 9999, backdropFilter: 'blur(10px)' }}>
      <div className="modal" style={{ maxWidth: 360, textAlign: 'center', padding: '32px 24px' }}>
        <IconShield size={48} color="var(--pink)" style={{ marginBottom: 16 }} />
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Age Verification</h2>
        <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          This website contains adult content. You must be at least 18 years old to enter. 
          By clicking &quot;I am 18 or older&quot;, you agree to our Terms of Service and Privacy Policy.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-primary btn-lg w-full" onClick={handleConfirm}>
            I am 18 or older
          </button>
          <button className="btn btn-ghost btn-lg w-full" onClick={handleDeny} style={{ color: 'var(--text-3)' }}>
            I am under 18
          </button>
        </div>
      </div>
    </div>
  );
}
