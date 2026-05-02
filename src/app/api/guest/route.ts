import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();
    const guestName = username || 'Guest';

    // Create a guest user with a random email/password
    const randomId = crypto.randomUUID().slice(0, 8);
    const email = `guest_${randomId}@aroundu.local`;
    const password = `GuestPass!${randomId}${Date.now()}`;

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: guestName, is_guest: 'true' },
    });

    if (error) {
      console.error('[GUEST API] Create user error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update profile
    await supabaseAdmin.from('profiles').update({
      username: guestName,
      is_guest: true,
    }).eq('id', data.user.id);

    // Return credentials so the client can sign in
    return NextResponse.json({
      email,
      password,
      userId: data.user.id,
    });
  } catch (err: any) {
    console.error('[GUEST API] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
