import { supabaseAdmin, getUserFromRequest } from '@/lib/server-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { targetUserId } = await request.json();

    if (!targetUserId || targetUserId === user.id) {
      return NextResponse.json({ error: 'Invalid target user' }, { status: 400 });
    }

    // 1. Check if a connection already exists
    const { data: existingConnection, error: connError } = await supabaseAdmin
      .from('connections')
      .select('room_id')
      .or(`and(user_a.eq.${user.id},user_b.eq.${targetUserId}),and(user_a.eq.${targetUserId},user_b.eq.${user.id})`)
      .single();

    if (!connError && existingConnection?.room_id) {
      return NextResponse.json({ roomId: existingConnection.room_id });
    }

    // 2. Fetch both users' profiles to get usernames
    const { data: profiles, error: profError } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .in('id', [user.id, targetUserId]);

    if (profError || !profiles || profiles.length !== 2) {
      throw new Error('Could not find profiles');
    }

    const myProfile = profiles.find(p => p.id === user.id);
    const targetProfile = profiles.find(p => p.id === targetUserId);

    // 3. Create a persistent 1v1 chat room (expires_at = null)
    // Supabase allows explicit null to override the default 24h
    const { data: room, error: roomError } = await supabaseAdmin
      .from('chat_rooms')
      .insert({ type: '1v1', expires_at: null })
      .select()
      .single();

    if (roomError) throw roomError;

    // 4. Create participants
    const participants = [
      { room_id: room.id, user_id: myProfile!.id, username: myProfile!.username },
      { room_id: room.id, user_id: targetProfile!.id, username: targetProfile!.username },
    ];

    const { error: partError } = await supabaseAdmin
      .from('chat_participants')
      .insert(participants);

    if (partError) throw partError;

    // 5. Create or update the connection to store the room_id
    if (existingConnection) {
       await supabaseAdmin
         .from('connections')
         .update({ room_id: room.id })
         .or(`and(user_a.eq.${user.id},user_b.eq.${targetUserId}),and(user_a.eq.${targetUserId},user_b.eq.${user.id})`);
    } else {
       await supabaseAdmin
         .from('connections')
         .insert({ user_a: user.id, user_b: targetUserId, room_id: room.id });
    }

    return NextResponse.json({ roomId: room.id });
  } catch (err: any) {
    console.error('Direct message error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
