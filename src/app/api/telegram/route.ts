import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import * as tg from '@/lib/telegram';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://around-u-psi.vercel.app';

// ---- Session helpers (Supabase-backed) ----
async function getSession(chatId: number) {
  const { data } = await db.from('telegram_sessions').select('*').eq('chat_id', chatId).single();
  return data;
}

async function upsertSession(chatId: number, fields: Record<string, any>) {
  await db.from('telegram_sessions').upsert({ chat_id: chatId, ...fields }, { onConflict: 'chat_id' });
}

// ---- Auth: get or create Supabase user for Telegram user ----
async function getOrCreateUser(chatId: number) {
  const existing = await getSession(chatId);
  if (existing?.user_id) return existing;

  const email = `telegram_${chatId}@aroundu.bot`;
  const password = `TelegramUser!${chatId}`;
  const username = `TG·${chatId.toString().slice(-4)}`;
  let userId = '';

  const { data, error } = await db.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { username, is_guest: 'false' },
  });

  if (error) {
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = (list?.users as any[])?.find((u: any) => u.email === email);
    if (found) userId = found.id;
    else return null;
  } else {
    userId = data.user.id;
  }

  const { data: profile } = await db.from('profiles').select('gender').eq('id', userId).single();
  await db.from('profiles').update({ username, is_guest: false }).eq('id', userId);

  const session = {
    chat_id: chatId, user_id: userId, username,
    gender: profile?.gender || 'Other', gender_pref: 'Any',
    region: 'global', platform_pref: 'Any',
    status: 'idle', room_id: null, queue_id: null, awaiting_input: null,
  };
  await upsertSession(chatId, session);
  return session;
}

// ---- DB helpers ----
async function sendDbMessage(roomId: string, senderId: string | null, senderUsername: string, content: string, mediaUrl?: string, msgType = 'text') {
  await db.from('messages').insert({
    room_id: roomId, sender_id: senderId, sender_username: senderUsername,
    content, media_url: mediaUrl || null, msg_type: msgType,
  });
}

async function endSession(chatId: number, session: any) {
  if (session.room_id) {
    await sendDbMessage(session.room_id, null, 'system', `${session.username} left the chat.`, undefined, 'system');
  }
  if (session.status === 'searching' && session.queue_id) {
    await db.from('match_queue').delete().eq('id', session.queue_id);
  }
  await upsertSession(chatId, { status: 'idle', room_id: null, queue_id: null });
}

// ---- Matching ----
async function tryFind(chatId: number, session: any) {
  try {
    await upsertSession(chatId, { status: 'searching' });

    // 1. Enter queue directly
    await db.from('match_queue').delete().eq('user_id', session.user_id);
    const { data: entry, error: enterErr } = await db.from('match_queue').insert({
      user_id: session.user_id, username: session.username,
      region: session.region || 'global',
      gender: session.gender || 'Other', gender_pref: session.gender_pref || 'Any',
      city: '', state: '', country: '', lat: 0, lng: 0,
      status: 'waiting', platform: 'telegram', platform_pref: session.platform_pref || 'Any',
    }).select().single();

    if (enterErr || !entry) {
      await upsertSession(chatId, { status: 'idle' });
      return tg.sendMessage(chatId, '❌ Queue error. Try again.');
    }

    await upsertSession(chatId, { queue_id: entry.id });

    // 2. Find match directly
    const { data: candidates } = await db
      .from('match_queue').select('*')
      .eq('status', 'waiting').neq('user_id', session.user_id)
      .order('created_at', { ascending: true });

    let match = null;
    if (candidates && candidates.length > 0) {
      const filtered = candidates.filter((c: any) => {
        if (entry.region === 'global' || c.region === 'global') return true;
        return true; // Simple global matching fallback for TG
      }).filter((c: any) => {
        const myOk = entry.gender_pref === 'Any' || entry.gender_pref === c.gender;
        const theirOk = c.gender_pref === 'Any' || c.gender_pref === entry.gender;
        return myOk && theirOk;
      }).filter((c: any) => {
        const myOk = entry.platform_pref === 'Any' || entry.platform_pref === c.platform;
        const theirOk = c.platform_pref === 'Any' || c.platform_pref === entry.platform;
        return myOk && theirOk;
      });
      if (filtered.length > 0) match = filtered[0];
    }

    // 3. Execute match if found
    if (match) {
      // Create room
      const { data: room, error: roomErr } = await db.from('chat_rooms').insert({
        type: '1v1', region: entry.region || 'global',
      }).select().single();

      if (room && !roomErr) {
        // Update both to matched
        await db.from('match_queue').update({ status: 'matched', matched_with: match.user_id, room_id: room.id }).eq('id', entry.id);
        await db.from('match_queue').update({ status: 'matched', matched_with: entry.user_id, room_id: room.id }).eq('id', match.id);
        
        await db.from('chat_participants').insert([
          { room_id: room.id, user_id: entry.user_id, username: entry.username },
          { room_id: room.id, user_id: match.user_id, username: match.username },
        ]);

        await sendDbMessage(room.id, null, 'system', `${entry.username} and ${match.username} connected!`, undefined, 'system');

        await upsertSession(chatId, { status: 'chatting', room_id: room.id, queue_id: null });
        
        // Notify the other user if they are on Telegram
        const { data: otherTg } = await db.from('telegram_sessions').select('chat_id').eq('user_id', match.user_id).single();
        if (otherTg) {
          await upsertSession(otherTg.chat_id, { status: 'chatting', room_id: room.id, queue_id: null });
          await tg.sendMessage(otherTg.chat_id, "🎉 Connected! Say hi.\n\n/next — skip\n/stop — leave\n/report — report user");
        }

        return tg.sendMessage(chatId, "🎉 Connected! Say hi.\n\n/next — skip\n/stop — leave\n/report — report user");
      }
    }

    // No immediate match
    await tg.sendMessage(chatId, `🔍 Searching...\n\nRegion: ${session.region}\nYou're in the queue — we'll notify you when matched!\n\nUse /stop to cancel.`);
  } catch (err: any) {
    console.error('[tryFind error]', err);
    await tg.sendMessage(chatId, `⚠️ Error: ${err.message}`);
  }
}

// ---- Command Handlers ----
async function handleCommand(chatId: number, command: string, session: any) {
  switch (command) {
    case '/start':
      return tg.sendMessage(chatId,
        "🎭 *Welcome to AroundU!*\n\n" +
        "Anonymous chat — right from Telegram.\nNo sign-up needed. Chats auto-delete in 24h.\n\n" +
        "⚡ *Quick Start:*\n1️⃣ Tap ⚙️ Settings\n2️⃣ Tap 🔍 Find\n3️⃣ Start chatting!\n\n" +
        `🌐 [AroundU Web](${APP_URL})`,
        tg.MAIN_KEYBOARD
      );

    case '/help':
      return tg.sendMessage(chatId,
        "📖 *AroundU Help*\n\n" +
        "💬 /find — Find a stranger\n⏭ /next — Skip person\n🛑 /stop — Leave chat\n" +
        "⚙️ /settings — Preferences\n👥 /groups — Group chats\n👤 /profile — Your info\n🚩 /report — Report user\n\n" +
        "📸 Send photos while chatting!"
      );

    case '/find':
      if (session.status !== 'idle') return tg.sendMessage(chatId, "⚠️ Already active. Use /stop first.");
      return tryFind(chatId, session);

    case '/stop':
      if (session.status === 'idle') return tg.sendMessage(chatId, "You're not in a chat.");
      await endSession(chatId, session);
      return tg.sendMessage(chatId, "👋 You left.\n\nUse /find to start again.");

    case '/next':
      if (session.status === 'idle') return tg.sendMessage(chatId, "Use /find first.");
      await endSession(chatId, session);
      await tg.sendMessage(chatId, "⏭ Skipped!");
      // Re-fetch session after end
      const refreshed = await getSession(chatId);
      if (refreshed) return tryFind(chatId, refreshed);
      return;

    case '/settings':
      if (session.status !== 'idle') return tg.sendMessage(chatId, "⚠️ Use /stop first.");
      return tg.sendMessage(chatId, "⚙️ *Settings*\n\nChoose:", tg.inlineKeyboard([
        [{ text: '📍 Region', callback_data: 'set_region' }],
        [{ text: '🚻 Your Gender', callback_data: 'set_gender' }],
        [{ text: '💕 Match Preference', callback_data: 'set_pref' }],
        [{ text: '📱 Platform Preference', callback_data: 'set_platform_pref' }],
        [{ text: '✏️ Change Username', callback_data: 'set_name' }],
      ]));

    case '/profile': {
      const pref = session.gender_pref === 'Any' ? 'Anyone' : session.gender_pref === 'M' ? 'Men' : 'Women';
      return tg.sendMessage(chatId,
        `👤 *Your Profile*\n\nUsername: \`${session.username}\`\nGender: ${session.gender}\nPreference: ${pref}\nRegion: ${session.region}\n\nUse /settings to change.`
      );
    }

    case '/groups': {
      const { data: groups } = await db.from('groups').select('*').order('member_count', { ascending: false }).limit(10);
      if (!groups?.length) return tg.sendMessage(chatId, "No groups available.");
      const buttons = groups.map((g: any) => [{ text: `${g.nsfw ? '🔥 ' : ''}${g.name} (${g.member_count})`, callback_data: `join_group_${g.id}` }]);
      return tg.sendMessage(chatId, "👥 *Available Groups*\n\nTap to join:", tg.inlineKeyboard(buttons));
    }

    case '/report':
      if (session.status !== 'chatting' || !session.room_id) return tg.sendMessage(chatId, "Not in a chat.");
      return tg.sendMessage(chatId, "🚩 *Report for:*", tg.inlineKeyboard([
        [{ text: 'Harassment', callback_data: 'report_Harassment' }],
        [{ text: 'Spam', callback_data: 'report_Spam' }],
        [{ text: 'Underage', callback_data: 'report_Underage' }],
        [{ text: 'Illegal content', callback_data: 'report_Illegal' }],
      ]));

    default:
      return;
  }
}

// ---- Callback Query Handler ----
async function handleCallback(chatId: number, cbId: string, msgId: number, data: string, session: any) {
  // Region
  if (data === 'set_region') {
    await tg.answerCallbackQuery(cbId);
    return tg.editMessageText(chatId, msgId, "📍 *Choose region:*", tg.inlineKeyboard([
      [{ text: '📍 Nearby', callback_data: 'region_nearby' }],
      [{ text: '🗺 State', callback_data: 'region_state' }],
      [{ text: '🌐 Country', callback_data: 'region_country' }],
      [{ text: '🌍 Global', callback_data: 'region_global' }],
    ]));
  }
  if (data.startsWith('region_')) {
    const r = data.replace('region_', '');
    await upsertSession(chatId, { region: r });
    await tg.answerCallbackQuery(cbId, `Region: ${r}`);
    return tg.editMessageText(chatId, msgId, `✅ Region set to *${r}*`);
  }

  // Gender
  if (data === 'set_gender') {
    await tg.answerCallbackQuery(cbId);
    return tg.editMessageText(chatId, msgId, "🚻 *Your gender:*", tg.inlineKeyboard([
      [{ text: '♂ Male', callback_data: 'gender_M' }],
      [{ text: '♀ Female', callback_data: 'gender_F' }],
      [{ text: '⚧ Other', callback_data: 'gender_Other' }],
    ]));
  }
  if (data.startsWith('gender_')) {
    const g = data.replace('gender_', '');
    await upsertSession(chatId, { gender: g });
    await db.from('profiles').update({ gender: g }).eq('id', session.user_id);
    await tg.answerCallbackQuery(cbId, `Gender: ${g}`);
    return tg.editMessageText(chatId, msgId, `✅ Gender set to *${g}*`);
  }

  // Preference
  if (data === 'set_pref') {
    await tg.answerCallbackQuery(cbId);
    return tg.editMessageText(chatId, msgId, "💕 *Match with:*", tg.inlineKeyboard([
      [{ text: '👥 Anyone', callback_data: 'pref_Any' }],
      [{ text: '♂ Men', callback_data: 'pref_M' }],
      [{ text: '♀ Women', callback_data: 'pref_F' }],
    ]));
  }
  if (data.startsWith('pref_')) {
    const p = data.replace('pref_', '');
    await upsertSession(chatId, { gender_pref: p });
    const label = p === 'Any' ? 'Anyone' : p === 'M' ? 'Men' : 'Women';
    await tg.answerCallbackQuery(cbId, label);
    return tg.editMessageText(chatId, msgId, `✅ Preference: *${label}*`);
  }

  // Platform pref
  if (data === 'set_platform_pref') {
    await tg.answerCallbackQuery(cbId);
    return tg.editMessageText(chatId, msgId, "📱 *Platform:*", tg.inlineKeyboard([
      [{ text: '🔄 Any', callback_data: 'platpref_Any' }],
      [{ text: '💻 Web Only', callback_data: 'platpref_web' }],
      [{ text: '📱 Telegram Only', callback_data: 'platpref_telegram' }],
    ]));
  }
  if (data.startsWith('platpref_')) {
    const p = data.replace('platpref_', '');
    await upsertSession(chatId, { platform_pref: p });
    await tg.answerCallbackQuery(cbId, p);
    return tg.editMessageText(chatId, msgId, `✅ Platform: *${p}*`);
  }

  // Username
  if (data === 'set_name') {
    await upsertSession(chatId, { awaiting_input: 'username' });
    await tg.answerCallbackQuery(cbId);
    return tg.editMessageText(chatId, msgId, "✏️ Type your new username:");
  }

  // Group join
  if (data.startsWith('join_group_')) {
    if (session.status !== 'idle') { await tg.answerCallbackQuery(cbId, "Leave chat first (/stop)"); return; }
    const groupId = data.replace('join_group_', '');
    const { data: group } = await db.from('groups').select('*').eq('id', groupId).single();
    if (!group) { await tg.answerCallbackQuery(cbId, "Not found"); return; }

    let roomId = group.room_id;
    if (!roomId) {
      const { data: room } = await db.from('chat_rooms').insert({ type: '1v1', region: 'global' }).select().single();
      roomId = room!.id;
      await db.from('groups').update({ room_id: roomId }).eq('id', groupId);
    }

    await db.from('chat_participants').upsert(
      { room_id: roomId, user_id: session.user_id, username: session.username },
      { onConflict: 'id' }
    );
    await upsertSession(chatId, { status: 'chatting', room_id: roomId });
    await tg.answerCallbackQuery(cbId, `Joined ${group.name}`);
    return tg.editMessageText(chatId, msgId, `✅ Joined *${group.name}*!\n\nType to chat. /stop to leave.`);
  }

  // Report
  if (data.startsWith('report_')) {
    const reason = data.replace('report_', '');
    if (session.room_id) {
      const { data: parts } = await db.from('chat_participants')
        .select('user_id, username').eq('room_id', session.room_id).neq('user_id', session.user_id).limit(1);
      if (parts?.[0]) {
        await db.from('reports').insert({
          reporter_id: session.user_id, reporter_username: session.username,
          reported_id: parts[0].user_id, reported_username: parts[0].username,
          reason, room_id: session.room_id,
        });
      }
    }
    await tg.answerCallbackQuery(cbId, "Report submitted");
    return tg.editMessageText(chatId, msgId, "✅ Report submitted. Thank you.");
  }

  await tg.answerCallbackQuery(cbId);
}

// ---- Text handler ----
async function handleText(chatId: number, text: string, session: any) {
  // Username input
  if (session.awaiting_input === 'username') {
    const name = text.trim().slice(0, 20);
    if (name.length < 2) return tg.sendMessage(chatId, "Min 2 characters.");
    await upsertSession(chatId, { username: name, awaiting_input: null });
    await db.from('profiles').update({ username: name }).eq('id', session.user_id);
    return tg.sendMessage(chatId, `✅ Username: *${name}*`);
  }

  // Check for match while chatting is pending (user sends message while searching)
  if (session.status === 'searching' && session.queue_id) {
    const { data: entry } = await db.from('match_queue').select('*').eq('id', session.queue_id).single();
    if (entry?.status === 'matched' && entry.room_id) {
      await upsertSession(chatId, { status: 'chatting', room_id: entry.room_id, queue_id: null });
      await tg.sendMessage(chatId, "🎉 You've been matched! Say hi.\n\n/next — skip\n/stop — leave");
      // Now send the message they typed
      await sendDbMessage(entry.room_id, session.user_id, session.username, text);
      return;
    }
    return tg.sendMessage(chatId, "⏳ Still searching... Use /stop to cancel.");
  }

  // Chat message
  if (session.status !== 'chatting' || !session.room_id) {
    return tg.sendMessage(chatId, "💡 Not in a chat. Tap 🔍 Find to start!");
  }

  await sendDbMessage(session.room_id, session.user_id, session.username, text);
}

// ---- Photo handler ----
async function handlePhoto(chatId: number, fileId: string, caption: string, session: any) {
  if (session.status !== 'chatting' || !session.room_id) return tg.sendMessage(chatId, "Not connected.");

  const fileUrl = await tg.getFileLink(fileId);
  if (!fileUrl) return tg.sendMessage(chatId, "⚠️ Failed to get photo.");

  try {
    const res = await cloudinary.uploader.upload(fileUrl, { folder: 'aroundu_chats' });
    await sendDbMessage(session.room_id, session.user_id, session.username, caption || '', res.secure_url, 'image');
  } catch {
    await tg.sendMessage(chatId, "⚠️ Failed to upload.");
  }
}

// ---- Keyboard button text mapping ----
const BUTTON_MAP: Record<string, string> = {
  '🔍 Find': '/find', '⚙️ Settings': '/settings',
  '⏭ Next': '/next', '🛑 Stop': '/stop',
  '👥 Groups': '/groups', '👤 Profile': '/profile', '❓ Help': '/help',
};

// ============== WEBHOOK ENDPOINT ==============
export async function POST(req: NextRequest) {
  try {
    const update = await req.json();

    // Handle callback queries (inline keyboard buttons)
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat?.id;
      if (!chatId) return NextResponse.json({ ok: true });

      let session = await getSession(chatId);
      if (!session) session = await getOrCreateUser(chatId);
      if (!session) return NextResponse.json({ ok: true });

      await handleCallback(chatId, cb.id, cb.message.message_id, cb.data, session);
      return NextResponse.json({ ok: true });
    }

    // Handle messages
    const msg = update.message;
    if (!msg?.chat?.id) return NextResponse.json({ ok: true });
    const chatId = msg.chat.id;

    let session = await getSession(chatId);
    if (!session) session = await getOrCreateUser(chatId);
    if (!session) return NextResponse.json({ ok: true });

    // Commands
    const text = msg.text || '';
    const mapped = BUTTON_MAP[text];
    if (mapped || text.startsWith('/')) {
      await handleCommand(chatId, mapped || text.split('@')[0], session);
      return NextResponse.json({ ok: true });
    }

    // Photos
    if (msg.photo?.length) {
      const photo = msg.photo[msg.photo.length - 1];
      await handlePhoto(chatId, photo.file_id, msg.caption || '', session);
      return NextResponse.json({ ok: true });
    }

    // Text
    if (text) {
      await handleText(chatId, text, session);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[TELEGRAM WEBHOOK] Error:', e.message);
    return NextResponse.json({ ok: true }); // Always 200 so Telegram doesn't retry
  }
}
