"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, MapPin, Loader2, Image as ImageIcon, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/components/AuthProvider';

export default function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [messaging, setMessaging] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`/api/profile?userId=${id}`);
      if (!res.ok) {
        if (res.status === 401) router.push('/login');
        return;
      }
      const data = await res.json();
      setProfile(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startDirectMessage = async () => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    setMessaging(true);
    try {
      const res = await fetch('/api/direct-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, targetUserId: profile.id })
      });
      const data = await res.json();
      if (data.roomId) {
        router.push(`/chat?roomId=${data.roomId}`);
      } else {
        alert(data.error || 'Failed to start message');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to start message');
    } finally {
      setMessaging(false);
    }
  };

  if (loading) {
    return (
      <div className="page page-center">
        <Loader2 className="profile-spinner" />
      </div>
    );
  }

  if (!profile || profile.error) {
    return (
      <div className="page page-center">
        <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>👤</div>
          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: 'var(--text-2)' }}>
            Profile not found
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="profile-container">
        {/* Profile Header Card */}
        <div className="card profile-card">
          <div className="profile-banner" />

          <div className="profile-card-body">
            <div className="profile-avatar-section">
              <div className="profile-avatar-wrapper">
                <div className="profile-avatar-img">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" />
                  ) : (
                    <span className="profile-avatar-letter">
                      {profile.username?.charAt(0).toUpperCase() || '?'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* User Info */}
            <div className="pub-profile-info">
              <div className="pub-profile-name-row">
                <h1 className="pub-profile-name">{profile.username}</h1>
                {profile.is_online && <span className="pub-profile-online" title="Online now" />}
              </div>

              <div className="pub-profile-meta">
                {(profile.city || profile.country) && (
                  <span className="pub-profile-meta-item">
                    <MapPin style={{ width: 14, height: 14 }} />
                    {profile.city}{profile.city && profile.country ? ', ' : ''}{profile.country}
                  </span>
                )}
                {!profile.is_online && profile.last_seen && (
                  <span className="pub-profile-meta-item">
                    <Clock style={{ width: 14, height: 14 }} />
                    Last seen {formatDistanceToNow(new Date(profile.last_seen), { addSuffix: true })}
                  </span>
                )}
              </div>

              {profile.bio && (
                <p className="pub-profile-bio">{profile.bio}</p>
              )}

              <button
                className="btn btn-primary btn-lg"
                onClick={startDirectMessage}
                disabled={messaging}
                style={{ marginTop: 8 }}
              >
                {messaging ? (
                  <Loader2 style={{ width: 20, height: 20, animation: 'spin 1s linear infinite' }} />
                ) : (
                  <MessageSquare style={{ width: 20, height: 20 }} />
                )}
                Message
              </button>
            </div>
          </div>
        </div>

        {/* Public Gallery */}
        <div className="card profile-gallery-card">
          <div className="profile-gallery-header">
            <h2 className="profile-gallery-title">
              <ImageIcon style={{ width: 20, height: 20, color: 'var(--purple)' }} />
              Public Gallery
            </h2>
          </div>

          {profile.gallery?.length === 0 ? (
            <div className="profile-gallery-empty">
              <ImageIcon style={{ width: 48, height: 48, opacity: 0.2 }} />
              <p>No public photos yet</p>
            </div>
          ) : (
            <div className="profile-gallery-grid">
              {profile.gallery?.map((img: any) => (
                <div key={img.id} className="profile-gallery-item">
                  <img src={img.image_url} alt="Gallery" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
