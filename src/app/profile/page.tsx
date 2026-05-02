"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Image as ImageIcon, Lock, Unlock, Trash2, Loader2, Save, User, PenLine } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [editingUsername, setEditingUsername] = useState('');
  const [editingBio, setEditingBio] = useState('');

  useEffect(() => {
    if (user) fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/profile?userId=${user.id}`);
      if (!res.ok) {
        if (res.status === 401) router.push('/login');
        return;
      }
      const data = await res.json();
      setProfile(data);
      setEditingUsername(data.username || '');
      setEditingBio(data.bio || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (updates: any) => {
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, ...updates }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile((prev: any) => ({ ...prev, ...updated }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadImage = async (file: File, type: 'avatar' | 'gallery') => {
    if (type === 'avatar') setUploadingAvatar(true);
    else setUploadingGallery(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (user?.id) formData.append('userId', user.id);
      
      const res = await fetch('/api/upload/profile', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();

      if (type === 'avatar') {
        await handleUpdateProfile({ avatar_url: url });
      } else {
        const galRes = await fetch('/api/gallery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user?.id, image_url: url, is_private: false })
        });
        if (galRes.ok) {
          const newImage = await galRes.json();
          setProfile((prev: any) => ({
            ...prev,
            gallery: [newImage, ...(prev.gallery || [])]
          }));
        }
      }
    } catch (err) {
      console.error(err);
      alert('Failed to upload image.');
    } finally {
      if (type === 'avatar') setUploadingAvatar(false);
      else setUploadingGallery(false);
    }
  };

  const toggleGalleryPrivacy = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/gallery', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, id, is_private: !currentStatus })
      });
      if (res.ok) {
        setProfile((prev: any) => ({
          ...prev,
          gallery: prev.gallery.map((g: any) => g.id === id ? { ...g, is_private: !currentStatus } : g)
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteGalleryImage = async (id: string) => {
    if (!confirm('Delete this image?')) return;
    try {
      const res = await fetch(`/api/gallery?id=${id}&userId=${user?.id}`, { method: 'DELETE' });
      if (res.ok) {
        setProfile((prev: any) => ({
          ...prev,
          gallery: prev.gallery.filter((g: any) => g.id !== id)
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="page page-center">
        <Loader2 className="profile-spinner" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="page">
      <div className="profile-container">
        {/* Page Header */}
        <div className="profile-header">
          <h1 className="profile-title">
            <User style={{ width: 28, height: 28 }} />
            My Profile
          </h1>
          <p className="profile-subtitle">Manage your profile, avatar, and gallery</p>
        </div>

        {/* Profile Card */}
        <div className="card profile-card">
          {/* Banner */}
          <div className="profile-banner" />

          <div className="profile-card-body">
            {/* Avatar Section */}
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
                <label className="profile-avatar-overlay">
                  {uploadingAvatar ? (
                    <Loader2 className="profile-spinner-sm" />
                  ) : (
                    <Camera style={{ width: 22, height: 22, color: '#fff' }} />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files?.[0] && handleUploadImage(e.target.files[0], 'avatar')}
                  />
                </label>
              </div>
              <div className="profile-avatar-hint">Click to change avatar</div>
            </div>

            {/* Form Fields */}
            <div className="profile-form">
              <div className="profile-field">
                <label className="profile-label">
                  <PenLine style={{ width: 14, height: 14 }} />
                  Username
                </label>
                <input
                  type="text"
                  className="input"
                  value={editingUsername}
                  onChange={(e) => setEditingUsername(e.target.value)}
                  placeholder="Enter your username"
                />
              </div>

              <div className="profile-field">
                <label className="profile-label">
                  <PenLine style={{ width: 14, height: 14 }} />
                  Bio
                </label>
                <textarea
                  className="input profile-textarea"
                  value={editingBio}
                  onChange={(e) => setEditingBio(e.target.value)}
                  placeholder="Tell the world about yourself..."
                  rows={3}
                />
              </div>

              <div className="profile-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => handleUpdateProfile({ username: editingUsername, bio: editingBio })}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Save style={{ width: 16, height: 16 }} />
                  )}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Gallery Card */}
        <div className="card profile-gallery-card">
          <div className="profile-gallery-header">
            <h2 className="profile-gallery-title">
              <ImageIcon style={{ width: 20, height: 20, color: 'var(--pink)' }} />
              My Gallery
            </h2>
            <label className="btn btn-outline btn-sm profile-upload-btn">
              {uploadingGallery ? (
                <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
              ) : (
                <Camera style={{ width: 16, height: 16 }} />
              )}
              Add Photo
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleUploadImage(e.target.files[0], 'gallery')}
              />
            </label>
          </div>

          {profile.gallery?.length === 0 ? (
            <div className="profile-gallery-empty">
              <ImageIcon style={{ width: 48, height: 48, opacity: 0.2 }} />
              <p>Your gallery is empty</p>
              <span>Upload photos to share with others or keep private.</span>
            </div>
          ) : (
            <div className="profile-gallery-grid">
              {profile.gallery?.map((img: any) => (
                <div key={img.id} className="profile-gallery-item">
                  <img src={img.image_url} alt="Gallery" />

                  {/* Hover Overlay */}
                  <div className="profile-gallery-overlay">
                    <button
                      className="profile-gallery-action"
                      onClick={() => toggleGalleryPrivacy(img.id, img.is_private)}
                      title={img.is_private ? 'Make Public' : 'Make Private'}
                    >
                      {img.is_private ? (
                        <Lock style={{ width: 16, height: 16, color: 'var(--pink)' }} />
                      ) : (
                        <Unlock style={{ width: 16, height: 16, color: 'var(--green)' }} />
                      )}
                    </button>
                    <button
                      className="profile-gallery-action profile-gallery-delete"
                      onClick={() => deleteGalleryImage(img.id)}
                      title="Delete Photo"
                    >
                      <Trash2 style={{ width: 16, height: 16 }} />
                    </button>
                  </div>

                  {/* Private Badge */}
                  {img.is_private && (
                    <div className="profile-gallery-badge">
                      <Lock style={{ width: 12, height: 12 }} />
                      Private
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
