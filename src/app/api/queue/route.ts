import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ---- ENTER queue ----
    if (action === 'enter') {
      const { userId, username, region, gender, genderPref, city, state, country, lat, lng, platform = 'web', platformPref = 'Any' } = body;
      if (!userId || !username) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

      // Clean up existing entries
      await supabaseAdmin.from('match_queue').delete().eq('user_id', userId);

      const { data: entry, error } = await supabaseAdmin.from('match_queue').insert({
        user_id: userId, username, region: region || 'global',
        gender: gender || 'Other', gender_pref: genderPref || 'Any',
        city: city || '', state: state || '', country: country || '',
        lat: lat || 0, lng: lng || 0, status: 'waiting',
        platform, platform_pref: platformPref,
      }).select().single();

      if (error) {
        console.error('[QUEUE API] Enter error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log('[QUEUE API] Entered:', entry.id, 'user:', userId, 'region:', region);
      return NextResponse.json({ entry });
    }

    // ---- LEAVE queue ----
    if (action === 'leave') {
      const { userId } = body;
      if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
      await supabaseAdmin.from('match_queue').delete().eq('user_id', userId);
      return NextResponse.json({ ok: true });
    }

    // ---- FIND match ----
    if (action === 'find') {
      const { myEntryId, userId } = body;
      if (!myEntryId || !userId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

      const { data: myEntry, error: myErr } = await supabaseAdmin
        .from('match_queue').select('*').eq('id', myEntryId).eq('status', 'waiting').single();

      if (!myEntry) {
        return NextResponse.json({ error: 'Entry not found or already matched' }, { status: 404 });
      }
      if (myEntry.user_id !== userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Get all waiting candidates (DIFFERENT user)
      const { data: candidates } = await supabaseAdmin
        .from('match_queue').select('*')
        .eq('status', 'waiting').neq('user_id', userId)
        .order('created_at', { ascending: true });

      if (!candidates || candidates.length === 0) {
        return NextResponse.json({ match: null });
      }

      // Region filter
      let filtered = candidates.filter((c: any) => {
        if (myEntry.region === 'global' || c.region === 'global') return true;
        if (myEntry.region === 'nearby' && c.region === 'nearby') return myEntry.city === c.city;
        if (myEntry.region === 'state' && c.region === 'state') return myEntry.state === c.state;
        if (myEntry.region === 'country' && c.region === 'country') return myEntry.country === c.country;
        return true;
      });

      // Gender pref filter (bidirectional)
      filtered = filtered.filter((c: any) => {
        const myOk = myEntry.gender_pref === 'Any' || myEntry.gender_pref === c.gender;
        const theirOk = c.gender_pref === 'Any' || c.gender_pref === myEntry.gender;
        return myOk && theirOk;
      });

      // Platform pref filter (bidirectional)
      filtered = filtered.filter((c: any) => {
        const myOk = myEntry.platform_pref === 'Any' || myEntry.platform_pref === c.platform;
        const theirOk = c.platform_pref === 'Any' || c.platform_pref === myEntry.platform;
        return myOk && theirOk;
      });

      console.log('[QUEUE API] Find:', candidates.length, 'candidates,', filtered.length, 'after filter');
      return NextResponse.json({ match: filtered.length > 0 ? filtered[0] : null });
    }

    // ---- EXECUTE match ----
    if (action === 'execute') {
      const { myEntryId, matchEntryId, userId } = body;
      if (!myEntryId || !matchEntryId || !userId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

      // Verify both entries are still waiting (atomic check)
      const { data: myEntry } = await supabaseAdmin
        .from('match_queue').select('*').eq('id', myEntryId).eq('status', 'waiting').single();
      const { data: matchEntry } = await supabaseAdmin
        .from('match_queue').select('*').eq('id', matchEntryId).eq('status', 'waiting').single();

      if (!myEntry || !matchEntry) {
        return NextResponse.json({ error: 'Entries no longer waiting' }, { status: 409 });
      }
      if (myEntry.user_id !== userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      // Create room
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
        room_id: room.id, sender_id: null, sender_username: 'system',
        content: `${myEntry.username} and ${matchEntry.username} connected!`,
        msg_type: 'system',
      });

      console.log('[QUEUE API] Match executed:', myEntry.username, '<->', matchEntry.username, 'room:', room.id);
      return NextResponse.json({ roomId: room.id });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('[QUEUE API] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
