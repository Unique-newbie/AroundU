/**
 * Telegram Bot API helpers for serverless webhook mode.
 * Used by /api/telegram webhook and other API routes to send notifications.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendMessage(chatId: number | string, text: string, extra: Record<string, any> = {}) {
  const res = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...extra }),
  });
  return res.json();
}

export async function sendPhoto(chatId: number | string, photoUrl: string, caption = '') {
  const res = await fetch(`${API}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, parse_mode: 'Markdown' }),
  });
  return res.json();
}

export async function answerCallbackQuery(callbackQueryId: string, text = '') {
  await fetch(`${API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

export async function editMessageText(chatId: number | string, messageId: number, text: string, extra: Record<string, any> = {}) {
  await fetch(`${API}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown', ...extra }),
  });
}

export async function sendChatAction(chatId: number | string, action = 'typing') {
  await fetch(`${API}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action }),
  });
}

export async function getFileLink(fileId: string): Promise<string | null> {
  const res = await fetch(`${API}/getFile?file_id=${fileId}`);
  const data = await res.json();
  if (!data.ok) return null;
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
}

export async function setWebhook(url: string, secret?: string) {
  const payload: any = { url, allowed_updates: ['message', 'callback_query'] };
  if (secret) payload.secret_token = secret;
  const res = await fetch(`${API}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function deleteWebhook() {
  const res = await fetch(`${API}/deleteWebhook`);
  return res.json();
}

export async function getWebhookInfo() {
  const res = await fetch(`${API}/getWebhookInfo`);
  return res.json();
}

export async function setMyCommands() {
  await fetch(`${API}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: '👋 Welcome & quick start' },
        { command: 'help', description: '📖 Full command guide' },
        { command: 'find', description: '🔍 Find a random stranger' },
        { command: 'settings', description: '⚙️ Region, gender & preferences' },
        { command: 'next', description: '⏭ Skip to next person' },
        { command: 'stop', description: '🛑 Leave the chat' },
        { command: 'groups', description: '👥 Browse group chats' },
        { command: 'profile', description: '👤 View your profile' },
        { command: 'report', description: '🚩 Report current user' },
      ],
    }),
  });
}

/** Build inline keyboard JSON */
export function inlineKeyboard(buttons: { text: string; callback_data: string }[][]) {
  return { reply_markup: { inline_keyboard: buttons } };
}

/** Build reply keyboard JSON */
export function replyKeyboard(buttons: string[][], resize = true) {
  return {
    reply_markup: {
      keyboard: buttons.map(row => row.map(text => ({ text }))),
      resize_keyboard: resize,
    },
  };
}

export const MAIN_KEYBOARD = replyKeyboard([
  ['🔍 Find', '⚙️ Settings'],
  ['⏭ Next', '🛑 Stop'],
  ['👥 Groups', '👤 Profile'],
  ['❓ Help'],
]);
