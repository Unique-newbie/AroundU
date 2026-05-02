import { supabaseAdmin, getUserFromRequest } from '@/lib/server-auth';
import { NextRequest, NextResponse } from 'next/server';
import { sendMessage as sendTgMessage, sendPhoto as sendTgPhoto } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  try {
    const { roomId, senderId, senderUsername, content, mediaUrl, userId } = await req.json();

    const { user } = await getUserFromRequest(req);
    
    if (!user || user.id !== senderId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!roomId || !senderId || !senderUsername) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from('messages').insert({
      room_id: roomId,
      sender_id: senderId,
      sender_username: senderUsername,
      content: content || '',
      media_url: mediaUrl || null,
      msg_type: mediaUrl ? 'image' : 'text',
    }).select().single();

    if (error) {
      console.error('[MSG API] Insert error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Forward to Telegram users in this room (if any)
    try {
      const { data: tgSessions } = await supabaseAdmin
        .from('telegram_sessions')
        .select('chat_id, user_id')
        .eq('room_id', roomId)
        .eq('status', 'chatting')
        .neq('user_id', senderId);

      if (tgSessions?.length) {
        for (const tg of tgSessions) {
          if (mediaUrl) {
            await sendTgPhoto(tg.chat_id, mediaUrl, content || '');
          } else {
            await sendTgMessage(tg.chat_id, content || '[empty]');
          }
        }
      }
    } catch (tgErr) {
      console.error('[MSG API] Telegram forward error:', tgErr);
      // Don't fail the request if TG forwarding fails
    }

    return NextResponse.json({ id: data.id });
  } catch (err: any) {
    console.error('[MSG API] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

