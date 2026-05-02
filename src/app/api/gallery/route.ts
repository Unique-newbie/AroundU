import { supabaseAdmin, getUserFromRequest } from '@/lib/server-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { image_url, is_private } = await request.json();

    if (!image_url) {
      return NextResponse.json({ error: 'Missing image_url' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('profile_gallery')
      .insert({
        user_id: user.id,
        image_url,
        is_private: !!is_private
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, is_private } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('profile_gallery')
      .update({ is_private })
      .eq('id', id)
      .eq('user_id', user.id) // security check, though RLS handles it too
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { user } = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('profile_gallery')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id); // security check

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
