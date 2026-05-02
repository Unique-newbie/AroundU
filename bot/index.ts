import { Telegraf, Markup } from 'telegraf';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TELEGRAM_BOT_TOKEN) { console.error("Missing TELEGRAM_BOT_TOKEN"); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error("Missing Supabase keys"); process.exit(1); }

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- Types ----
interface Session {
  userId: string;
  username: string;
  gender: string;
  genderPref: string;
  region: string;
  queueId: string | null;
  roomId: string | null;
  sub: any;
  poll: ReturnType<typeof setInterval> | null;
  status: 'idle' | 'searching' | 'chatting';
  awaitingInput: string | null; // for multi-step flows
  platformPref: string;
}

const sessions = new Map<number, Session>();
const WEB_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://aroundu.app';

// ---- Auth ----
async function getOrCreateUser(chatId: number): Promise<Session | null> {
  if (sessions.has(chatId)) return sessions.get(chatId)!;

  const email = `telegram_${chatId}@aroundu.bot`;
  const password = `TelegramUser!${chatId}`;
  const username = `TG·${chatId.toString().slice(-4)}`;
  let userId = '';

  const { data, error } = await db.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { username, is_guest: 'false' }
  });

  if (error) {
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = (list?.users as any[])?.find((u: any) => u.email === email);
    if (existing) userId = existing.id;
    else { console.error("Auth error:", error.message); return null; }
  } else {
    userId = data.user.id;
  }

  // Load profile for saved preferences
  const { data: profile } = await db.from('profiles').select('*').eq('id', userId).single();

  await db.from('profiles').update({ username, is_guest: false }).eq('id', userId);

  const s: Session = {
    userId, username,
    gender: profile?.gender || 'Other',
    genderPref: 'Any',
    region: 'global',
    queueId: null, roomId: null, sub: null, poll: null,
    status: 'idle', awaitingInput: null,
    platformPref: 'Any',
  };
  sessions.set(chatId, s);
  return s;
}

// ---- DB Helpers ----
async function createRoom(region = 'global') {
  const { data, error } = await db.from('chat_rooms').insert({ type: '1v1', region, group_id: null }).select().single();
  if (error) throw error;
  return data;
}

async function sendDbMessage(roomId: string, senderId: string | null, senderUsername: string, content: string, mediaUrl?: string, msgType = 'text') {
  await db.from('messages').insert({
    room_id: roomId, sender_id: senderId, sender_username: senderUsername,
    content, media_url: mediaUrl || null, msg_type: msgType,
  });
}

// ---- Matching ----
async function startSearching(ctx: any, s: Session) {
  if (s.status !== 'idle') return;
  s.status = 'searching';

  const regionLabel = { nearby: '📍 Nearby', state: '🗺 State', country: '🌐 Country', global: '🌍 Global' }[s.region] || '🌍 Global';
  const prefLabel = s.genderPref === 'Any' ? 'Anyone' : s.genderPref === 'M' ? 'Men' : 'Women';
  ctx.reply(`🔍 Searching...\n\nRegion: ${regionLabel}\nMatch with: ${prefLabel}\nAs: ${s.username}`);
  ctx.sendChatAction('typing');

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Enter queue via API
  try {
    const enterRes = await fetch(`${APP_URL}/api/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'enter',
        userId: s.userId, username: s.username, region: s.region,
        gender: s.gender, genderPref: s.genderPref,
        city: '', state: '', country: '', lat: 0, lng: 0,
        platform: 'telegram', platformPref: s.platformPref,
      }),
    });
    if (!enterRes.ok) {
      const err = await enterRes.json();
      console.error('[BOT] Queue enter failed:', err.error);
      s.status = 'idle';
      return ctx.reply(`❌ Queue error: ${err.error}`);
    }
    const { entry } = await enterRes.json();
    s.queueId = entry.id;
    console.log(`[BOT] Entered queue: ${entry.id} for user ${s.userId}`);
  } catch (e: any) {
    console.error('[BOT] Queue enter error:', e.message);
    s.status = 'idle';
    return ctx.reply('❌ Could not join queue. Try again.');
  }

  // Listen for being matched by the OTHER side (web or another bot user)
  const ch = db.channel(`tg_q:${s.queueId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_queue', filter: `id=eq.${s.queueId}` },
      async (p) => {
        if (p.new.status === 'matched' && p.new.room_id && s.status === 'searching') {
          cleanup(s, ch);
          s.roomId = p.new.room_id;
          s.status = 'chatting';
          ctx.reply("🎉 Connected! Say hi.\n\n/next — skip\n/stop — leave\n/report — report user");
          listenRoom(ctx, s);
        }
      }).subscribe();

  // Poll using the same /api/queue API as the web app
  s.poll = setInterval(async () => {
    if (s.status !== 'searching') { cleanup(s, ch); return; }
    try {
      // Step 1: Find match
      const findRes = await fetch(`${APP_URL}/api/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'find', myEntryId: s.queueId, userId: s.userId }),
      });

      // If our entry is gone (404), check if we were matched by the other side
      if (findRes.status === 404) {
        const { data: myEntry } = await db.from('match_queue')
          .select('*').eq('id', s.queueId).single();
        if (myEntry && myEntry.status === 'matched' && myEntry.room_id) {
          console.log('[BOT POLL] Already matched by other side, room:', myEntry.room_id);
          cleanup(s, ch);
          s.roomId = myEntry.room_id;
          s.status = 'chatting';
          ctx.reply("🎉 Connected! Say hi.\n\n/next — skip\n/stop — leave\n/report — report user");
          listenRoom(ctx, s);
        }
        return;
      }

      if (!findRes.ok) return;
      const findResult = await findRes.json();
      if (!findResult.match) return;

      console.log('[BOT POLL] Found match:', findResult.match.username);

      // Step 2: Execute match
      const execRes = await fetch(`${APP_URL}/api/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          myEntryId: s.queueId,
          matchEntryId: findResult.match.id,
          userId: s.userId,
        }),
      });

      if (execRes.status === 409) {
        // Race: other side executed first. Check if we're matched
        const { data: myEntry } = await db.from('match_queue')
          .select('*').eq('id', s.queueId).single();
        if (myEntry && myEntry.status === 'matched' && myEntry.room_id) {
          console.log('[BOT POLL] Matched by other side during execute, room:', myEntry.room_id);
          cleanup(s, ch);
          s.roomId = myEntry.room_id;
          s.status = 'chatting';
          ctx.reply("🎉 Connected! Say hi.\n\n/next — skip\n/stop — leave\n/report — report user");
          listenRoom(ctx, s);
        }
        return;
      }

      if (!execRes.ok) {
        console.log('[BOT POLL] Execute failed:', execRes.status);
        return;
      }
      const execResult = await execRes.json();

      cleanup(s, ch);
      s.roomId = execResult.roomId;
      s.status = 'chatting';
      ctx.reply("🎉 Connected! Say hi.\n\n/next — skip\n/stop — leave\n/report — report user");
      listenRoom(ctx, s);
    } catch (e: any) { console.error('[BOT POLL] Error:', e.message); }
  }, 3000);
}

function cleanup(s: Session, ch?: any) {
  if (s.poll) { clearInterval(s.poll); s.poll = null; }
  if (ch) db.removeChannel(ch);
  if (s.sub) { db.removeChannel(s.sub); s.sub = null; }
}

function listenRoom(ctx: any, s: Session) {
  if (!s.roomId) return;
  
  let lastMsgTime = new Date().toISOString();
  
  s.sub = db.channel(`tg_r:${s.roomId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${s.roomId}` },
      (p) => {
        const msg = p.new;
        if (msg.sender_id === s.userId) return;
        if (msg.created_at > lastMsgTime) lastMsgTime = msg.created_at;
        if (msg.msg_type === 'system') ctx.reply(`📢 ${msg.content}`);
        else if (msg.msg_type === 'image' && msg.media_url)
          ctx.replyWithPhoto(msg.media_url, { caption: msg.content || '' }).catch(() => ctx.reply(`🖼 ${msg.content || '[Image]'}`));
        else ctx.reply(msg.content);
      }).subscribe();

  // Polling fallback for messages
  s.poll = setInterval(async () => {
    if (!s.roomId || s.status !== 'chatting') return;
    try {
      const { data: newMsgs } = await db.from('messages')
        .select('*')
        .eq('room_id', s.roomId)
        .gt('created_at', lastMsgTime)
        .order('created_at', { ascending: true });
        
      if (newMsgs && newMsgs.length > 0) {
        lastMsgTime = newMsgs[newMsgs.length - 1].created_at;
        for (const msg of newMsgs) {
          if (msg.sender_id === s.userId) continue;
          if (msg.msg_type === 'system') ctx.reply(`📢 ${msg.content}`);
          else if (msg.msg_type === 'image' && msg.media_url)
            ctx.replyWithPhoto(msg.media_url, { caption: msg.content || '' }).catch(() => ctx.reply(`🖼 ${msg.content || '[Image]'}`));
          else ctx.reply(msg.content);
        }
      }
    } catch (e: any) { console.error('[BOT POLL MSG] Error:', e.message); }
  }, 2000);
}

async function endSession(s: Session) {
  cleanup(s);
  if (s.roomId) {
    await sendDbMessage(s.roomId, null, 'system', `${s.username} left the chat.`, undefined, 'system');
    s.roomId = null;
  }
  if (s.status === 'searching') await db.from('match_queue').delete().eq('user_id', s.userId);
  s.queueId = null;
  s.status = 'idle';
}

// ============================================
// COMMANDS
// ============================================

bot.start(async (ctx) => {
  const s = await getOrCreateUser(ctx.chat.id);
  ctx.reply(
    "🎭 *Welcome to AroundU!*\n\n" +
    "Anonymous chat & hookups — right from Telegram.\n" +
    "No sign-up needed. All chats auto-delete in 24h.\n\n" +
    "━━━━━━━━━━━━━━━\n" +
    "⚡ *Quick Start:*\n\n" +
    "1️⃣ Tap ⚙️ *Settings* to pick your region & preferences\n" +
    "2️⃣ Tap 🔍 *Find* to get matched with a stranger\n" +
    "3️⃣ Start chatting! Send text, photos, anything\n\n" +
    "━━━━━━━━━━━━━━━\n" +
    "💡 Type /help anytime to see all commands\n\n" +
    `🌐 Want groups, dating & more? Visit [AroundU Web](${WEB_URL})`,
    { parse_mode: 'Markdown', ...Markup.keyboard([
      ['🔍 Find', '⚙️ Settings'],
      ['⏭ Next', '🛑 Stop'],
      ['👥 Groups', '👤 Profile'],
      ['❓ Help'],
    ]).resize() }
  );
});

// ---- Help ----
bot.command('help', async (ctx) => {
  ctx.reply(
    "📖 *AroundU Bot — Help Guide*\n\n" +
    "━━━ 💬 *Chatting* ━━━\n" +
    "/find — Search for a random stranger\n" +
    "/next — Skip & find someone new\n" +
    "/stop — Leave current chat or search\n\n" +
    "━━━ ⚙️ *Preferences* ━━━\n" +
    "/settings — Open settings menu\n" +
    "  ├ 📍 Region (Nearby / State / Country / Global)\n" +
    "  ├ 🚻 Your gender (Male / Female / Other)\n" +
    "  ├ 💕 Match with (Anyone / Men / Women)\n" +
    "  ├ 📱 Platform (Any / Web / Telegram)\n" +
    "  └ ✏️ Change username\n\n" +
    "━━━ 👥 *Social* ━━━\n" +
    "/groups — Browse & join group chats\n" +
    "/profile — View your current settings\n" +
    "/report — Report someone in a chat\n\n" +
    "━━━ 📸 *Media* ━━━\n" +
    "Send photos while in a chat — they'll\n" +
    "be shared with your match instantly.\n\n" +
    "━━━ ℹ️ *Info* ━━━\n" +
    "• All chats auto-delete after 24 hours\n" +
    "• Your identity stays anonymous\n" +
    "• 18+ only platform\n\n" +
    `🌐 [Visit AroundU Web](${WEB_URL}) for dating,\nconnections & full features`,
    { parse_mode: 'Markdown' }
  );
});

// ---- Settings ----
bot.command('settings', async (ctx) => {
  const s = await getOrCreateUser(ctx.chat.id);
  if (!s) return;
  if (s.status !== 'idle') return ctx.reply("⚠️ Use /stop first to change settings.");

  ctx.reply("⚙️ *Settings*\n\nChoose what to configure:", {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('📍 Region', 'set_region')],
      [Markup.button.callback('🚻 Your Gender', 'set_gender')],
      [Markup.button.callback('💕 Match Preference', 'set_pref')],
      [Markup.button.callback('📱 Platform Preference', 'set_platform_pref')],
      [Markup.button.callback('✏️ Change Username', 'set_name')],
    ])
  });
});

// Region selection
bot.action('set_region', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.editMessageText("📍 *Choose your search region:*", {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('📍 Nearby (City)', 'region_nearby')],
      [Markup.button.callback('🗺 State', 'region_state')],
      [Markup.button.callback('🌐 Country', 'region_country')],
      [Markup.button.callback('🌍 Global', 'region_global')],
    ])
  });
});

for (const r of ['nearby', 'state', 'country', 'global'] as const) {
  bot.action(`region_${r}`, async (ctx) => {
    const s = sessions.get(ctx.chat!.id);
    if (s) s.region = r;
    await ctx.answerCbQuery(`Region set to ${r}`);
    ctx.editMessageText(`✅ Region set to *${r}*`, { parse_mode: 'Markdown' });
  });
}

// Gender selection
bot.action('set_gender', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.editMessageText("🚻 *What's your gender?*", {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('♂ Male', 'gender_M')],
      [Markup.button.callback('♀ Female', 'gender_F')],
      [Markup.button.callback('⚧ Other', 'gender_Other')],
    ])
  });
});

for (const g of ['M', 'F', 'Other'] as const) {
  bot.action(`gender_${g}`, async (ctx) => {
    const s = sessions.get(ctx.chat!.id);
    if (s) {
      s.gender = g;
      await db.from('profiles').update({ gender: g }).eq('id', s.userId);
    }
    await ctx.answerCbQuery(`Gender set to ${g}`);
    ctx.editMessageText(`✅ Gender set to *${g}*`, { parse_mode: 'Markdown' });
  });
}

// Gender preference
bot.action('set_pref', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.editMessageText("💕 *Who do you want to match with?*", {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('👥 Anyone', 'pref_Any')],
      [Markup.button.callback('♂ Men only', 'pref_M')],
      [Markup.button.callback('♀ Women only', 'pref_F')],
    ])
  });
});

for (const p of ['Any', 'M', 'F'] as const) {
  bot.action(`pref_${p}`, async (ctx) => {
    const s = sessions.get(ctx.chat!.id);
    if (s) s.genderPref = p;
    const label = p === 'Any' ? 'Anyone' : p === 'M' ? 'Men' : 'Women';
    await ctx.answerCbQuery(`Preference: ${label}`);
    ctx.editMessageText(`✅ Match preference set to *${label}*`, { parse_mode: 'Markdown' });
  });
}

// Platform preference
bot.action('set_platform_pref', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.editMessageText("📱 *Which platform users do you want to match with?*", {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Any Platform', 'platpref_Any')],
      [Markup.button.callback('💻 Web App Only', 'platpref_web')],
      [Markup.button.callback('📱 Telegram Only', 'platpref_telegram')],
    ])
  });
});

for (const p of ['Any', 'web', 'telegram'] as const) {
  bot.action(`platpref_${p}`, async (ctx) => {
    const s = sessions.get(ctx.chat!.id);
    if (s) s.platformPref = p;
    const label = p === 'Any' ? 'Any Platform' : p === 'web' ? 'Web App Only' : 'Telegram Only';
    await ctx.answerCbQuery(`Platform: ${label}`);
    ctx.editMessageText(`✅ Platform preference set to *${label}*`, { parse_mode: 'Markdown' });
  });
}

// Username change
bot.action('set_name', async (ctx) => {
  const s = sessions.get(ctx.chat!.id);
  if (s) s.awaitingInput = 'username';
  await ctx.answerCbQuery();
  ctx.editMessageText("✏️ Type your new username:");
});

// ---- Find ----
bot.command('find', async (ctx) => {
  const s = await getOrCreateUser(ctx.chat.id);
  if (!s) return ctx.reply("❌ Backend error. Try again.");
  if (s.status !== 'idle') return ctx.reply("⚠️ Already searching/chatting. Use /stop first.");
  await startSearching(ctx, s);
});

// ---- Next ----
bot.command('next', async (ctx) => {
  const s = sessions.get(ctx.chat.id);
  if (!s) return ctx.reply("Use /find first.");
  await endSession(s);
  ctx.reply("⏭ Skipped!");
  await startSearching(ctx, s);
});

// ---- Stop ----
bot.command('stop', async (ctx) => {
  const s = sessions.get(ctx.chat.id);
  if (!s || s.status === 'idle') return ctx.reply("You're not in a chat.");
  await endSession(s);
  ctx.reply("👋 You left the chat.\n\nUse /find to start again or /settings to adjust preferences.");
});

// ---- Profile ----
bot.command('profile', async (ctx) => {
  const s = await getOrCreateUser(ctx.chat.id);
  if (!s) return;
  const prefLabel = s.genderPref === 'Any' ? 'Anyone' : s.genderPref === 'M' ? 'Men' : 'Women';
  ctx.reply(
    `👤 *Your Profile*\n\n` +
    `Username: \`${s.username}\`\n` +
    `Gender: ${s.gender}\n` +
    `Preference: ${prefLabel}\n` +
    `Region: ${s.region}\n\n` +
    `Use /settings to change these.`,
    { parse_mode: 'Markdown' }
  );
});

// ---- Groups ----
bot.command('groups', async (ctx) => {
  const s = await getOrCreateUser(ctx.chat.id);
  if (!s) return;

  const { data: groups } = await db.from('groups').select('*').order('member_count', { ascending: false }).limit(10);
  if (!groups || groups.length === 0) return ctx.reply("No groups available.");

  const buttons = groups.map((g: any) => [
    Markup.button.callback(`${g.nsfw ? '🔥 ' : ''}${g.name} (${g.member_count} members)`, `join_group_${g.id}`)
  ]);

  ctx.reply("👥 *Available Groups*\n\nTap to join:", {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
});

// Group join handler
bot.action(/^join_group_(.+)$/, async (ctx) => {
  const s = sessions.get(ctx.chat!.id);
  if (!s) return ctx.answerCbQuery("Use /start first");
  if (s.status !== 'idle') return ctx.answerCbQuery("Leave current chat first (/stop)");

  const groupId = ctx.match[1];
  const { data: group } = await db.from('groups').select('*').eq('id', groupId).single();
  if (!group) return ctx.answerCbQuery("Group not found");

  await ctx.answerCbQuery(`Joining ${group.name}...`);

  let roomId = group.room_id;
  if (!roomId) {
    const room = await createRoom('global');
    roomId = room.id;
    await db.from('groups').update({ room_id: room.id }).eq('id', groupId);
  }

  await db.from('chat_participants').upsert(
    { room_id: roomId, user_id: s.userId, username: s.username },
    { onConflict: 'id' }
  );
  await db.from('groups').update({ member_count: group.member_count + 1 }).eq('id', groupId);

  s.roomId = roomId;
  s.status = 'chatting';
  ctx.editMessageText(`✅ Joined *${group.name}*!\n\nType messages to chat. Use /stop to leave.`, { parse_mode: 'Markdown' });
  listenRoom(ctx, s);
});

// ---- Report ----
bot.command('report', async (ctx) => {
  const s = sessions.get(ctx.chat.id);
  if (!s || s.status !== 'chatting' || !s.roomId) return ctx.reply("You're not in a chat to report.");

  ctx.reply("🚩 *Report this user for:*", {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('Harassment', 'report_Harassment')],
      [Markup.button.callback('Spam', 'report_Spam')],
      [Markup.button.callback('Underage', 'report_Underage')],
      [Markup.button.callback('Illegal content', 'report_Illegal')],
      [Markup.button.callback('Non-consensual', 'report_Nonconsensual')],
    ])
  });
});

bot.action(/^report_(.+)$/, async (ctx) => {
  const s = sessions.get(ctx.chat!.id);
  if (!s || !s.roomId) return ctx.answerCbQuery("Not in a chat");

  const reason = ctx.match[1];
  const { data: participants } = await db.from('chat_participants')
    .select('user_id, username').eq('room_id', s.roomId).neq('user_id', s.userId).limit(1);

  if (participants?.[0]) {
    await db.from('reports').insert({
      reporter_id: s.userId, reporter_username: s.username,
      reported_id: participants[0].user_id, reported_username: participants[0].username,
      reason, room_id: s.roomId,
    });
  }

  await ctx.answerCbQuery("Report submitted");
  ctx.editMessageText("✅ Report submitted. Thank you for keeping AroundU safe.");
});

// ---- Keyboard button texts (used to skip them in the text handler) ----
const BUTTON_TEXTS = new Set(['🔍 Find', '⚙️ Settings', '⏭ Next', '🛑 Stop', '👥 Groups', '👤 Profile', '❓ Help']);

// Direct handlers for each keyboard button
bot.hears('🔍 Find', async (ctx) => {
  const s = await getOrCreateUser(ctx.chat.id);
  if (!s) return ctx.reply("❌ Backend error.");
  if (s.status !== 'idle') return ctx.reply("⚠️ Already active. Use /stop first.");
  await startSearching(ctx, s);
});
bot.hears('⚙️ Settings', async (ctx) => {
  const s = await getOrCreateUser(ctx.chat.id);
  if (!s) return;
  if (s.status !== 'idle') return ctx.reply("⚠️ Use /stop first.");
  ctx.reply("⚙️ *Settings*\n\nChoose what to configure:", { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
    [Markup.button.callback('📍 Region', 'set_region')],
    [Markup.button.callback('🚻 Your Gender', 'set_gender')],
    [Markup.button.callback('💕 Match Preference', 'set_pref')],
    [Markup.button.callback('✏️ Change Username', 'set_name')],
  ]) });
});
bot.hears('⏭ Next', async (ctx) => {
  const s = sessions.get(ctx.chat.id);
  if (!s) return ctx.reply("Use /find first.");
  await endSession(s);
  ctx.reply("⏭ Skipped!");
  await startSearching(ctx, s);
});
bot.hears('🛑 Stop', async (ctx) => {
  const s = sessions.get(ctx.chat.id);
  if (!s || s.status === 'idle') return ctx.reply("You're not in a chat.");
  await endSession(s);
  ctx.reply("👋 You left. Use /find to start again.");
});
bot.hears('👥 Groups', async (ctx) => {
  const s = await getOrCreateUser(ctx.chat.id);
  if (!s) return;
  const { data: groups } = await db.from('groups').select('*').order('member_count', { ascending: false }).limit(10);
  if (!groups || groups.length === 0) return ctx.reply("No groups available.");
  const buttons = groups.map((g: any) => [Markup.button.callback(`${g.nsfw ? '🔥 ' : ''}${g.name} (${g.member_count})`, `join_group_${g.id}`)]);
  ctx.reply("👥 *Available Groups*\n\nTap to join:", { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
});
bot.hears('👤 Profile', async (ctx) => {
  const s = await getOrCreateUser(ctx.chat.id);
  if (!s) return;
  const pref = s.genderPref === 'Any' ? 'Anyone' : s.genderPref === 'M' ? 'Men' : 'Women';
  ctx.reply(`👤 *Your Profile*\n\nUsername: \`${s.username}\`\nGender: ${s.gender}\nPreference: ${pref}\nRegion: ${s.region}\n\nUse /settings to change.`, { parse_mode: 'Markdown' });
});
bot.hears('❓ Help', (ctx) => {
  ctx.reply(
    "📖 *AroundU Help*\n\n" +
    "━━━ 💬 *Chat* ━━━\n/find — Find a stranger\n/next — Skip person\n/stop — Leave chat\n\n" +
    "━━━ ⚙️ *Settings* ━━━\n/settings — Region, gender, preferences\n\n" +
    "━━━ 👥 *Social* ━━━\n/groups — Group chats\n/profile — Your info\n/report — Report user\n\n" +
    "📸 Send photos while chatting!\n• Chats auto-delete in 24h\n• 18+ only",
    { parse_mode: 'Markdown' }
  );
});

// ---- Text handler (chat messages + username input) ----
bot.on('text', async (ctx) => {
  // Skip keyboard button presses — handled above
  if (BUTTON_TEXTS.has(ctx.message.text)) return;

  const s = sessions.get(ctx.chat.id);
  if (!s) return ctx.reply("Use /start first.");

  // Handle username input
  if (s.awaitingInput === 'username') {
    const newName = ctx.message.text.trim().slice(0, 20);
    if (newName.length < 2) return ctx.reply("Username must be at least 2 characters.");
    s.username = newName;
    s.awaitingInput = null;
    await db.from('profiles').update({ username: newName }).eq('id', s.userId);
    return ctx.reply(`✅ Username changed to *${newName}*`, { parse_mode: 'Markdown' });
  }

  // Chat message
  if (s.status !== 'chatting' || !s.roomId) {
    return ctx.reply("💡 Not in a chat. Tap *🔍 Find* or *👥 Groups* to start!", { parse_mode: 'Markdown' });
  }

  ctx.sendChatAction('typing');
  try {
    await sendDbMessage(s.roomId, s.userId, s.username, ctx.message.text);
  } catch (e) {
    console.error("Send error:", e);
    ctx.reply("⚠️ Failed to send.");
  }
});

// ---- Log any Telegram file to DB ----
async function logTelegramFile(userId: string, username: string, chatId: number, fileId: string, fileType: string, fileName: string, fileSize: number, mimeType: string, roomId: string | null) {
  try {
    await db.from('telegram_files').insert({
      user_id: userId, username, telegram_chat_id: chatId.toString(),
      file_id: fileId, file_type: fileType, file_name: fileName,
      file_size: fileSize, mime_type: mimeType, room_id: roomId,
    });
  } catch (e) { console.error('[BOT] logTelegramFile error:', e); }
}

// ---- Photo handler ----
bot.on('photo', async (ctx) => {
  const s = sessions.get(ctx.chat.id);
  if (!s || s.status !== 'chatting' || !s.roomId) return ctx.reply("Not connected.");

  ctx.sendChatAction('upload_photo');
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  // Log file_id for admin access
  await logTelegramFile(s.userId, s.username, ctx.chat.id, photo.file_id, 'photo', '', photo.file_size || 0, 'image/jpeg', s.roomId);
  try {
    const url = await ctx.telegram.getFileLink(photo.file_id);
    const res = await cloudinary.uploader.upload(url.href, { folder: 'aroundu_chats' });
    await sendDbMessage(s.roomId, s.userId, s.username, ctx.message.caption || '', res.secure_url);
  } catch (e) {
    console.error("Upload error:", e);
    ctx.reply("⚠️ Failed to send image.");
  }
});

// ---- Document handler ----
bot.on('document', async (ctx) => {
  const s = sessions.get(ctx.chat.id);
  if (!s) return;
  const doc = ctx.message.document;
  await logTelegramFile(s.userId, s.username, ctx.chat.id, doc.file_id, 'document', doc.file_name || 'file', doc.file_size || 0, doc.mime_type || '', s.roomId);
  if (s.status === 'chatting' && s.roomId) {
    ctx.reply("📎 File received & logged (documents can't be forwarded in chat).");
  }
});

// ---- Video handler ----
bot.on('video', async (ctx) => {
  const s = sessions.get(ctx.chat.id);
  if (!s) return;
  const vid = ctx.message.video;
  await logTelegramFile(s.userId, s.username, ctx.chat.id, vid.file_id, 'video', '', vid.file_size || 0, vid.mime_type || 'video/mp4', s.roomId);
  if (s.status === 'chatting' && s.roomId) {
    ctx.reply("🎬 Video received & logged.");
  }
});

// ---- Voice handler ----
bot.on('voice', async (ctx) => {
  const s = sessions.get(ctx.chat.id);
  if (!s) return;
  const v = ctx.message.voice;
  await logTelegramFile(s.userId, s.username, ctx.chat.id, v.file_id, 'voice', '', v.file_size || 0, v.mime_type || 'audio/ogg', s.roomId);
  if (s.status === 'chatting' && s.roomId) {
    ctx.reply("🎙 Voice note received & logged.");
  }
});

// ---- Video note (round video) handler ----
bot.on('video_note', async (ctx) => {
  const s = sessions.get(ctx.chat.id);
  if (!s) return;
  const vn = ctx.message.video_note;
  await logTelegramFile(s.userId, s.username, ctx.chat.id, vn.file_id, 'video_note', '', vn.file_size || 0, 'video/mp4', s.roomId);
});

// ---- Sticker handler ----
bot.on('sticker', async (ctx) => {
  const s = sessions.get(ctx.chat.id);
  if (!s) return;
  const st = ctx.message.sticker;
  await logTelegramFile(s.userId, s.username, ctx.chat.id, st.file_id, 'sticker', st.emoji || '🏷', st.file_size || 0, st.is_animated ? 'application/x-tgsticker' : 'image/webp', s.roomId);
});

// ---- Launch ----
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

console.log("Starting Telegram Bot...");
bot.launch().then(async () => {
  console.log("✅ Bot running!");
  await bot.telegram.setMyCommands([
    { command: 'start', description: '👋 Welcome & quick start' },
    { command: 'help', description: '📖 Full command guide' },
    { command: 'find', description: '🔍 Find a random stranger' },
    { command: 'settings', description: '⚙️ Region, gender & preferences' },
    { command: 'next', description: '⏭ Skip to next person' },
    { command: 'stop', description: '🛑 Leave the chat' },
    { command: 'groups', description: '👥 Browse group chats' },
    { command: 'profile', description: '👤 View your profile' },
    { command: 'report', description: '🚩 Report current user' },
  ]);
  console.log("✅ Menu commands registered!");
});
