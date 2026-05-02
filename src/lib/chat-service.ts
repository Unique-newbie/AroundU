import { supabase, Message } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

let activeChannel: RealtimeChannel | null = null;

// ---- Create a chat room ----
export async function createRoom(type: '1v1' | 'group', region = 'global', groupId?: string) {
  const { data, error } = await supabase.from('chat_rooms').insert({
    type, region, group_id: groupId || null,
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

// ---- Join a room ----
export async function joinRoom(roomId: string, userId: string, username: string) {
  await supabase.from('chat_participants').upsert({
    room_id: roomId, user_id: userId, username,
  }, { onConflict: 'id' });
}

// ---- Send message (via server API to bypass RLS) ----
export async function sendMessage(roomId: string, senderId: string, senderUsername: string, content: string, mediaUrl?: string) {
  const res = await fetch('/api/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: senderId, roomId, senderId, senderUsername, content, mediaUrl }),
  });
  if (!res.ok) {
    const err = await res.json();
    console.error('[sendMessage] Failed:', err.error);
    throw new Error(err.error || 'Failed to send');
  }
}

// ---- Send system message ----
export async function sendSystemMessage(roomId: string, content: string) {
  await supabase.from('messages').insert({
    room_id: roomId,
    sender_id: null,
    sender_username: 'system',
    content,
    msg_type: 'system',
  });
}

// ---- Load room messages ----
export async function loadMessages(roomId: string, limit = 50): Promise<Message[]> {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(limit);
  return (data as Message[]) || [];
}

// ---- Subscribe to real-time messages ----
export function subscribeToMessages(
  roomId: string,
  onMessage: (msg: Message) => void
): RealtimeChannel {
  // Cleanup previous subscription
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
  }

  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        onMessage(payload.new as Message);
      }
    )
    .subscribe();

  activeChannel = channel;
  return channel;
}

// ---- Unsubscribe from room ----
export function unsubscribeFromRoom() {
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
  }
}

// ---- Get room participants ----
export async function getRoomParticipants(roomId: string) {
  const { data } = await supabase.from('chat_participants').select('*').eq('room_id', roomId);
  return data || [];
}

// ---- Report a user ----
export async function reportUser(
  reporterId: string,
  reporterUsername: string,
  reportedId: string,
  reportedUsername: string,
  reason: string,
  roomId?: string,
) {
  await supabase.from('reports').insert({
    reporter_id: reporterId,
    reporter_username: reporterUsername,
    reported_id: reportedId,
    reported_username: reportedUsername,
    reason,
    room_id: roomId || null,
  });
}
