import { supabaseAdmin, getUserFromRequest } from '@/lib/server-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get('q');

  if (!q || q.length < 3) {
    return NextResponse.json({ users: [] }); // Require at least 3 chars
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, avatar_url, bio, city, state')
      .ilike('username', `%${q}%`)
      .neq('id', user.id) // Don't return self
      .limit(10);

    if (error) throw error;
    
    return NextResponse.json({ users: data });
  } catch (err: any) {
    console.error('User search error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
