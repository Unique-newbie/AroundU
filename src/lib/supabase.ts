import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper types for our tables
export type Profile = {
  id: string;
  username: string;
  gender: string;
  city: string;
  state: string;
  country: string;
  country_code: string;
  lat: number;
  lng: number;
  is_online: boolean;
  last_seen: string;
  nsfw_enabled: boolean;
  is_guest: boolean;
  is_admin: boolean;
  created_at: string;
};

export type ChatRoom = {
  id: string;
  type: '1v1' | 'group';
  region: string;
  group_id: string | null;
  created_at: string;
  expires_at: string;
};

export type Message = {
  id: string;
  room_id: string;
  sender_id: string | null;
  sender_username: string;
  content: string;
  media_url: string | null;
  msg_type: 'text' | 'image' | 'system';
  created_at: string;
  expires_at: string;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  type: 'official' | 'private';
  nsfw: boolean;
  color: string;
  member_count: number;
  online_count: number;
  room_id: string | null;
  created_at: string;
};

export type Report = {
  id: string;
  reporter_id: string;
  reporter_username: string;
  reported_id: string;
  reported_username: string;
  reason: string;
  room_id: string | null;
  status: 'pending' | 'resolved' | 'banned';
  created_at: string;
};

export type DatingProfile = {
  id: string;
  user_id: string;
  display_name: string;
  age: number;
  bio: string;
  tags: string[];
  color: string;
  verified: boolean;
  city: string;
  lat: number;
  lng: number;
  active: boolean;
  created_at: string;
};

export type Connection = {
  id: string;
  user_a: string;
  user_b: string;
  last_message: string;
  last_message_at: string;
  created_at: string;
};
