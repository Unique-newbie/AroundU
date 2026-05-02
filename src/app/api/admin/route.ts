import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Verify caller is admin
async function isAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return null;
  return user.id;
}

export async function POST(req: NextRequest) {
  const adminId = await isAdmin(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { action, ...params } = await req.json();

  try {
    switch (action) {
      case 'getStats': {
        const [
          { count: totalUsers },
          { count: onlineUsers },
          { count: bannedUsers },
          { count: pendingReports },
          { count: totalRooms },
          { count: totalMessages },
          { count: totalDatingProfiles },
          { count: totalMatches },
          { count: totalConnections },
          { count: totalGroups },
        ] = await Promise.all([
          supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_online', true),
          supabaseAdmin.from('bans').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabaseAdmin.from('chat_rooms').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('messages').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('dating_profiles').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('dating_matches').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('connections').select('*', { count: 'exact', head: true }),
          supabaseAdmin.from('groups').select('*', { count: 'exact', head: true }),
        ]);
        return NextResponse.json({
          totalUsers: totalUsers || 0, onlineUsers: onlineUsers || 0,
          bannedUsers: bannedUsers || 0, pendingReports: pendingReports || 0,
          totalRooms: totalRooms || 0, totalMessages: totalMessages || 0,
          totalDatingProfiles: totalDatingProfiles || 0, totalMatches: totalMatches || 0,
          totalConnections: totalConnections || 0, totalGroups: totalGroups || 0,
        });
      }

      case 'getUsers': {
        const { data: profiles } = await supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false }).limit(200);
        // Get auth user emails
        const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const emailMap: Record<string, string> = {};
        const ipMap: Record<string, string> = {};
        authUsers?.forEach(u => {
          emailMap[u.id] = u.email || '';
          // Try to extract IP from user metadata or last sign in
          ipMap[u.id] = (u.user_metadata as any)?.ip_address || '';
        });
        // Check bans
        const { data: bans } = await supabaseAdmin.from('bans').select('user_id');
        const bannedIds = new Set((bans || []).map(b => b.user_id));
        const enriched = (profiles || []).map(p => ({
          ...p,
          email: emailMap[p.id] || '',
          ip_address: ipMap[p.id] || p.ip_address || '',
          is_banned: bannedIds.has(p.id),
        }));
        return NextResponse.json({ users: enriched });
      }

      case 'getRooms': {
        const { data: rooms } = await supabaseAdmin
          .from('chat_rooms').select('*')
          .order('created_at', { ascending: false }).limit(100);
        // Get participants for each room
        const roomIds = (rooms || []).map(r => r.id);
        const { data: participants } = await supabaseAdmin
          .from('chat_participants').select('*').in('room_id', roomIds);
        const enriched = (rooms || []).map(r => ({
          ...r,
          participants: (participants || []).filter(p => p.room_id === r.id),
        }));
        return NextResponse.json({ rooms: enriched });
      }

      case 'getRoomMessages': {
        const { roomId } = params;
        const { data: messages } = await supabaseAdmin
          .from('messages').select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true }).limit(500);
        const { data: participants } = await supabaseAdmin
          .from('chat_participants').select('*').eq('room_id', roomId);
        return NextResponse.json({ messages: messages || [], participants: participants || [] });
      }

      case 'getReports': {
        const { data } = await supabaseAdmin.from('reports').select('*').order('created_at', { ascending: false }).limit(100);
        return NextResponse.json({ reports: data || [] });
      }

      case 'handleReport': {
        const { reportId, status, userId } = params;
        await supabaseAdmin.from('reports').update({ status }).eq('id', reportId);
        if (status === 'banned' && userId) {
          await supabaseAdmin.from('bans').insert({ user_id: userId, reason: 'Banned via admin report' });
        }
        return NextResponse.json({ ok: true });
      }

      case 'getGroups': {
        const { data } = await supabaseAdmin.from('groups').select('*').order('member_count', { ascending: false });
        return NextResponse.json({ groups: data || [] });
      }

      case 'deleteGroup': {
        const { groupId } = params;
        await supabaseAdmin.from('groups').delete().eq('id', groupId);
        return NextResponse.json({ ok: true });
      }

      case 'getDating': {
        const [
          { data: profiles },
          { data: swipes },
          { data: matches },
        ] = await Promise.all([
          supabaseAdmin.from('dating_profiles').select('*').order('created_at', { ascending: false }),
          supabaseAdmin.from('dating_swipes').select('*').order('created_at', { ascending: false }).limit(200),
          supabaseAdmin.from('dating_matches').select('*').order('created_at', { ascending: false }),
        ]);
        return NextResponse.json({ profiles: profiles || [], swipes: swipes || [], matches: matches || [] });
      }

      case 'getConnections': {
        const { data } = await supabaseAdmin.from('connections').select('*').order('last_message_at', { ascending: false }).limit(200);
        // Enrich with usernames
        const userIds = new Set<string>();
        (data || []).forEach(c => { userIds.add(c.user_a); userIds.add(c.user_b); });
        const { data: profiles } = await supabaseAdmin.from('profiles').select('id, username').in('id', [...userIds]);
        const nameMap: Record<string, string> = {};
        (profiles || []).forEach(p => { nameMap[p.id] = p.username; });
        const enriched = (data || []).map(c => ({
          ...c,
          username_a: nameMap[c.user_a] || c.user_a,
          username_b: nameMap[c.user_b] || c.user_b,
        }));
        return NextResponse.json({ connections: enriched });
      }

      case 'banUser': {
        const { userId, reason } = params;
        await supabaseAdmin.from('bans').insert({ user_id: userId, reason: reason || 'Banned by admin' });
        return NextResponse.json({ ok: true });
      }

      case 'unbanUser': {
        const { userId } = params;
        await supabaseAdmin.from('bans').delete().eq('user_id', userId);
        return NextResponse.json({ ok: true });
      }

      case 'getMedia': {
        const { data } = await supabaseAdmin
          .from('messages').select('*')
          .not('media_url', 'is', null)
          .neq('media_url', '')
          .order('created_at', { ascending: false }).limit(200);
        return NextResponse.json({ media: data || [] });
      }

      case 'getTelegramFiles': {
        const { data } = await supabaseAdmin
          .from('telegram_files').select('*')
          .order('created_at', { ascending: false }).limit(200);
        return NextResponse.json({ files: data || [] });
      }

      case 'resolveTelegramFile': {
        const { fileId } = params;
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) return NextResponse.json({ error: 'No bot token' }, { status: 500 });
        const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
        const json = await res.json();
        if (!json.ok) return NextResponse.json({ error: 'File not found on Telegram' }, { status: 404 });
        const fileUrl = `https://api.telegram.org/file/bot${token}/${json.result.file_path}`;
        return NextResponse.json({ url: fileUrl, file_path: json.result.file_path, file_size: json.result.file_size });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[ADMIN API] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
