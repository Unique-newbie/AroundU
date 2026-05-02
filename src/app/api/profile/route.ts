import { supabaseAdmin, getUserFromRequest } from '@/lib/server-auth';
import { NextRequest, NextResponse } from 'next/server';

// Get own profile or a specific user's public profile
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);

  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');

  if (!user && !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const targetId = userId || user?.id;

  try {
    // Get profile
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, username, bio, avatar_url, gender, city, state, country, is_online, last_seen')
      .eq('id', targetId)
      .single();

    if (profileErr) throw profileErr;

    // Get gallery
    let galleryQuery = supabaseAdmin
      .from('profile_gallery')
      .select('id, image_url, is_private, created_at')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false });

    // If not fetching own profile, only show public gallery
    if (user?.id !== targetId) {
      galleryQuery = galleryQuery.eq('is_private', false);
    }

    const { data: gallery, error: galleryErr } = await galleryQuery;
    if (galleryErr) throw galleryErr;

    return NextResponse.json({ ...profile, gallery });
  } catch (err: any) {
    console.error('Fetch profile error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Update own profile
export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const updates = await request.json();
    
    // Whitelist allowed fields to update
    const allowedUpdates: any = {};
    if (updates.username !== undefined) allowedUpdates.username = updates.username;
    if (updates.bio !== undefined) allowedUpdates.bio = updates.bio;
    if (updates.avatar_url !== undefined) allowedUpdates.avatar_url = updates.avatar_url;
    if (updates.gender !== undefined) allowedUpdates.gender = updates.gender;
    if (updates.city !== undefined) allowedUpdates.city = updates.city;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(allowedUpdates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Update profile error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
