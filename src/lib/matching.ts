import { supabase } from './supabase';

export type QueueEntry = {
  id: string;
  user_id: string;
  username: string;
  region: string;
  gender: string;
  gender_pref: string;
  city: string;
  state: string;
  country: string;
  status: 'waiting' | 'matched';
  matched_with: string | null;
  room_id: string | null;
  created_at: string;
};

// ---- Enter the match queue (server-side) ----
export async function enterQueue(
  userId: string,
  username: string,
  region: string,
  gender: string,
  genderPref: string,
  location: { city: string; state: string; country: string; lat: number; lng: number },
  platform: string = 'web',
  platformPref: string = 'Any'
): Promise<QueueEntry> {
  const res = await fetch('/api/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'enter',
      userId, username, region, gender, genderPref,
      ...location,
      platform, platformPref,
    }),
  });

  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Failed to enter queue');
  return result.entry as QueueEntry;
}

// ---- Find a compatible match (server-side) ----
export async function findMatch(entry: QueueEntry): Promise<QueueEntry | null> {
  const res = await fetch('/api/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'find',
      myEntryId: entry.id,
      userId: entry.user_id,
    }),
  });

  if (!res.ok) return null;
  const result = await res.json();
  return result.match || null;
}

// ---- Execute match (server-side) ----
export async function executeMatch(entry: QueueEntry, match: QueueEntry): Promise<string> {
  const res = await fetch('/api/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'execute',
      myEntryId: entry.id,
      matchEntryId: match.id,
      userId: entry.user_id,
    }),
  });

  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Match failed');
  return result.roomId;
}

// ---- Leave queue (server-side) ----
export async function leaveQueue(userId: string) {
  await fetch('/api/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'leave', userId }),
  });
}

// ---- Subscribe to queue entry changes (realtime, uses anon key) ----
export function subscribeToQueue(
  entryId: string,
  onMatched: (entry: QueueEntry) => void
) {
  return supabase
    .channel(`queue:${entryId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'match_queue',
        filter: `id=eq.${entryId}`,
      },
      (payload) => {
        const updated = payload.new as QueueEntry;
        if (updated.status === 'matched' && updated.room_id) {
          onMatched(updated);
        }
      }
    )
    .subscribe();
}
