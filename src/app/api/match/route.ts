import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { myEntryId, matchEntryId, userId } = await req.json();

    if (!myEntryId || !userId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // --- FIND mode: if no matchEntryId, search for a match ---
    if (!matchEntryId) {
      const { data: myEntry, error: myErr } = await supabaseAdmin
        .from('match_queue').select('*').eq('id', myEntryId).eq('status', 'waiting').single();

      console.log('[MATCH API] FIND mode for entry:', myEntryId, 'user:', userId);
      console.log('[MATCH API] My entry found:', !!myEntry, 'error:', myErr?.message || 'none');

      if (!myEntry) {
        return NextResponse.json({ error: 'Entry not found or already matched' }, { status: 404 });
      }

      if (myEntry.user_id !== userId) {
        console.log('[MATCH API] User mismatch:', myEntry.user_id, '!==', userId);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Query all waiting candidates
      const { data: candidates, error: candErr } = await supabaseAdmin
        .from('match_queue')
        .select('*')
        .eq('status', 'waiting')
        .neq('user_id', userId)
        .order('created_at', { ascending: true });

      console.log('[MATCH API] Candidates found:', candidates?.length ?? 0, 'error:', candErr?.message || 'none');
      if (candidates) candidates.forEach((c: any) => console.log('[MATCH API]   -', c.username, 'region:', c.region, 'gender:', c.gender, 'pref:', c.gender_pref));

      if (!candidates || candidates.length === 0) {
        return NextResponse.json({ match: null });
      }

      // Region compatibility filter
      let filtered = candidates.filter((c: any) => {
        if (myEntry.region === 'global' || c.region === 'global') return true;
        if (myEntry.region === 'nearby' && c.region === 'nearby') return myEntry.city === c.city;
        if (myEntry.region === 'state' && c.region === 'state') return myEntry.state === c.state;
        if (myEntry.region === 'country' && c.region === 'country') return myEntry.country === c.country;
        if (myEntry.region === 'country' || c.region === 'country') {
          return myEntry.country === c.country || !myEntry.country || !c.country;
        }
        if (myEntry.region === 'state' || c.region === 'state') {
          return myEntry.state === c.state || !myEntry.state || !c.state;
        }
        return true;
      });

      // Gender preference filter (bidirectional)
      filtered = filtered.filter((c: any) => {
        const myPrefOk = myEntry.gender_pref === 'Any' || myEntry.gender_pref === c.gender;
        const theirPrefOk = c.gender_pref === 'Any' || c.gender_pref === myEntry.gender;
        return myPrefOk && theirPrefOk;
      });

      return NextResponse.json({ match: filtered.length > 0 ? filtered[0] : null });
    }

    // --- EXECUTE mode: matchEntryId provided, create room ---
    const { data: myEntry } = await supabaseAdmin
      .from('match_queue').select('*').eq('id', myEntryId).eq('status', 'waiting').single();
    const { data: matchEntry } = await supabaseAdmin
      .from('match_queue').select('*').eq('id', matchEntryId).eq('status', 'waiting').single();

    if (!myEntry || !matchEntry) {
      return NextResponse.json({ error: 'One or both entries no longer waiting' }, { status: 409 });
    }

    if (myEntry.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Create chat room
    const { data: room, error: roomErr } = await supabaseAdmin.from('chat_rooms').insert({
      type: '1v1', region: myEntry.region || 'global', group_id: null,
    }).select().single();

    if (roomErr || !room) {
      return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
    }

    // Join both users
    await supabaseAdmin.from('chat_participants').insert([
      { room_id: room.id, user_id: myEntry.user_id, username: myEntry.username },
      { room_id: room.id, user_id: matchEntry.user_id, username: matchEntry.username },
    ]);

    // Update BOTH queue entries
    await supabaseAdmin.from('match_queue').update({
      status: 'matched', matched_with: matchEntry.user_id, room_id: room.id,
    }).eq('id', myEntryId);

    await supabaseAdmin.from('match_queue').update({
      status: 'matched', matched_with: myEntry.user_id, room_id: room.id,
    }).eq('id', matchEntryId);

    // System message
    await supabaseAdmin.from('messages').insert({
      room_id: room.id,
      sender_id: null,
      sender_username: 'system',
      content: `${myEntry.username} and ${matchEntry.username} matched!`,
      msg_type: 'system',
    });

    return NextResponse.json({ roomId: room.id });
  } catch (err: any) {
    console.error('Match API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
