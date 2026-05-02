-- ============================================
-- AroundU — Complete Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";

-- ============================================
-- 1. PROFILES (extends auth.users)
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  bio text default '',
  avatar_url text,
  gender text check (gender in ('M', 'F', 'Other')) default 'Other',
  city text default '',
  state text default '',
  country text default '',
  country_code text default '',
  lat double precision default 0,
  lng double precision default 0,
  is_online boolean default false,
  last_seen timestamptz default now(),
  nsfw_enabled boolean default false,
  is_guest boolean default false,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, is_guest)
  values (
    new.id,
    'User' || substr(new.id::text, 1, 6),
    coalesce(new.raw_user_meta_data->>'is_guest', 'false')::boolean
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- 2. MATCH QUEUE
-- ============================================
create table public.match_queue (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  username text not null,
  region text not null check (region in ('nearby', 'state', 'country', 'global')),
  gender text default 'Any',
  gender_pref text default 'Any',
  city text default '',
  state text default '',
  country text default '',
  lat double precision default 0,
  lng double precision default 0,
  status text default 'waiting' check (status in ('waiting', 'matched')),
  platform text default 'web' check (platform in ('web', 'telegram')),
  platform_pref text default 'Any' check (platform_pref in ('web', 'telegram', 'Any')),
  matched_with uuid,
  room_id uuid,
  created_at timestamptz default now()
);

-- ============================================
-- 3. CHAT ROOMS
-- ============================================
create table public.chat_rooms (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('1v1', 'group')),
  region text default 'global',
  group_id uuid,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '24 hours')
);

-- ============================================
-- 4. CHAT PARTICIPANTS
-- ============================================
create table public.chat_participants (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.chat_rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  username text not null,
  joined_at timestamptz default now()
);

-- ============================================
-- 5. MESSAGES
-- ============================================
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.chat_rooms(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_username text not null,
  content text default '',
  media_url text,
  msg_type text default 'text' check (msg_type in ('text', 'image', 'system')),
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '24 hours')
);

-- Index for fast room message queries
create index idx_messages_room on public.messages(room_id, created_at desc);

-- ============================================
-- 6. GROUPS
-- ============================================
create table public.groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text default '',
  type text default 'official' check (type in ('official', 'private')),
  nsfw boolean default false,
  color text default 'blue',
  created_by uuid references auth.users(id) on delete set null,
  member_count integer default 0,
  online_count integer default 0,
  room_id uuid references public.chat_rooms(id) on delete set null,
  created_at timestamptz default now()
);

-- Seed default groups
insert into public.groups (name, description, type, nsfw, color) values
  ('Late Night Talks', 'For the night owls. Deep convos after midnight.', 'official', false, 'purple'),
  ('Meme Exchange', 'Share cursed memes. No normie stuff.', 'official', false, 'blue'),
  ('Confessions', 'Anonymous confessions. No judgement zone.', 'official', false, 'pink'),
  ('Music Nerds', 'Drop your playlists, roast others.', 'official', false, 'green'),
  ('After Dark', '18+ only. NSFW content allowed. Be respectful.', 'official', true, 'pink'),
  ('Spicy Chat', 'Flirty group chat. Adults only. Keep it consensual.', 'official', true, 'pink'),
  ('College Chat — Delhi', 'DU / JNU / IP / DTU students only vibes', 'private', false, 'blue'),
  ('Developers Hub', 'Talk code, share projects, debug together.', 'private', false, 'green'),
  ('Anime & Manga', 'Weebs unite. Spoilers = ban.', 'private', false, 'purple'),
  ('Startup Ideas', 'Pitch your startup. Get honest feedback.', 'private', false, 'blue');

-- ============================================
-- 7. REPORTS
-- ============================================
create table public.reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid references auth.users(id) on delete set null,
  reporter_username text not null,
  reported_id uuid references auth.users(id) on delete set null,
  reported_username text not null,
  reason text not null,
  room_id uuid,
  status text default 'pending' check (status in ('pending', 'resolved', 'banned')),
  created_at timestamptz default now()
);

-- ============================================
-- 8. BANS
-- ============================================
create table public.bans (
  id uuid primary key default uuid_generate_v4(),
  ip_address text,
  user_id uuid references auth.users(id) on delete cascade,
  reason text not null,
  banned_at timestamptz default now(),
  expires_at timestamptz -- null = permanent
);

-- ============================================
-- 9. CONNECTIONS (saved strangers)
-- ============================================
create table public.connections (
  id uuid primary key default uuid_generate_v4(),
  user_a uuid references auth.users(id) on delete cascade,
  user_b uuid references auth.users(id) on delete cascade,
  room_id uuid references public.chat_rooms(id) on delete set null,
  last_message text default '',
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_a, user_b)
);

-- ============================================
-- 10. DATING PROFILES
-- ============================================
create table public.dating_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique,
  display_name text not null,
  age integer not null check (age >= 18 and age <= 99),
  bio text default '',
  tags text[] default '{}',
  color text default 'blue',
  verified boolean default false,
  city text default '',
  lat double precision default 0,
  lng double precision default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- ============================================
-- 11. DATING SWIPES
-- ============================================
create table public.dating_swipes (
  id uuid primary key default uuid_generate_v4(),
  swiper_id uuid references auth.users(id) on delete cascade,
  swiped_id uuid references auth.users(id) on delete cascade,
  action text not null check (action in ('like', 'pass', 'super')),
  created_at timestamptz default now(),
  unique(swiper_id, swiped_id)
);

-- ============================================
-- 12. DATING MATCHES
-- ============================================
create table public.dating_matches (
  id uuid primary key default uuid_generate_v4(),
  user_a uuid references auth.users(id) on delete cascade,
  user_b uuid references auth.users(id) on delete cascade,
  room_id uuid references public.chat_rooms(id) on delete set null,
  created_at timestamptz default now(),
  unique(user_a, user_b)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Profiles: anyone can read, only owner can update
alter table public.profiles enable row level security;
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Match queue: authenticated users can insert/read/update their own
alter table public.match_queue enable row level security;
create policy "Users can manage own queue entries" on public.match_queue for all using (auth.uid() = user_id);
create policy "Users can read queue for matching" on public.match_queue for select using (true);

-- Chat rooms: participants can read
alter table public.chat_rooms enable row level security;
create policy "Anyone can read rooms" on public.chat_rooms for select using (true);
create policy "Anyone can create rooms" on public.chat_rooms for insert with check (true);

-- Participants: anyone in the room can read
alter table public.chat_participants enable row level security;
create policy "Participants viewable" on public.chat_participants for select using (true);
create policy "Users can join rooms" on public.chat_participants for insert with check (auth.uid() = user_id);

-- Messages: anyone in the room can read, sender can write
alter table public.messages enable row level security;
create policy "Messages viewable in room" on public.messages for select using (true);
create policy "Users can send messages" on public.messages for insert with check (auth.uid() = sender_id);

-- Groups: everyone can read
alter table public.groups enable row level security;
create policy "Groups are public" on public.groups for select using (true);

-- Reports: authenticated users can create
alter table public.reports enable row level security;
create policy "Users can create reports" on public.reports for insert with check (auth.uid() = reporter_id);
create policy "Admins can read reports" on public.reports for select using (true);

-- Bans: only readable (admin checks)
alter table public.bans enable row level security;
create policy "Bans are readable" on public.bans for select using (true);

-- Connections: users can manage their own
alter table public.connections enable row level security;
create policy "Users can read own connections" on public.connections for select using (auth.uid() = user_a or auth.uid() = user_b);
create policy "Users can create connections" on public.connections for insert with check (auth.uid() = user_a);
create policy "Users can delete connections" on public.connections for delete using (auth.uid() = user_a or auth.uid() = user_b);

-- Dating: authenticated users only
alter table public.dating_profiles enable row level security;
create policy "Dating profiles viewable" on public.dating_profiles for select using (true);
create policy "Users manage own dating profile" on public.dating_profiles for all using (auth.uid() = user_id);

alter table public.dating_swipes enable row level security;
create policy "Users manage own swipes" on public.dating_swipes for all using (auth.uid() = swiper_id);

alter table public.dating_matches enable row level security;
create policy "Users see own matches" on public.dating_matches for select using (auth.uid() = user_a or auth.uid() = user_b);

-- ============================================
-- REALTIME — enable for chat
-- ============================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.match_queue;
alter publication supabase_realtime add table public.chat_participants;

-- ============================================
-- 24-HOUR AUTO-DELETE CRON JOBS
-- ============================================

-- Delete expired messages every 15 minutes
select cron.schedule(
  'delete-expired-messages',
  '*/15 * * * *',
  $$delete from public.messages where expires_at < now()$$
);

-- Delete expired chat rooms every 15 minutes
select cron.schedule(
  'delete-expired-rooms',
  '*/15 * * * *',
  $$delete from public.chat_rooms where expires_at < now()$$
);

-- Clean stale queue entries (older than 5 minutes)
select cron.schedule(
  'clean-stale-queue',
  '*/5 * * * *',
  $$delete from public.match_queue where created_at < now() - interval '5 minutes' and status = 'waiting'$$
);

-- Mark users offline if last_seen > 5 min ago
select cron.schedule(
  'mark-users-offline',
  '*/2 * * * *',
  $$update public.profiles set is_online = false where is_online = true and last_seen < now() - interval '5 minutes'$$
);

-- ============================================
-- 7. RPCs (Stored Procedures)
-- ============================================

create or replace function get_region_activity()
returns table (
  region_type text,
  region_name text,
  active_users bigint
) as $$
begin
  return query
    -- City Level
    select 'city'::text as region_type, city as region_name, count(*) as active_users
    from public.profiles
    where is_online = true and city != ''
    group by city
    
    union all
    
    -- State Level
    select 'state'::text as region_type, state as region_name, count(*) as active_users
    from public.profiles
    where is_online = true and state != ''
    group by state
    
    union all
    
    -- Country Level
    select 'country'::text as region_type, country as region_name, count(*) as active_users
    from public.profiles
    where is_online = true and country != ''
    group by country;
end;
$$ language plpgsql security definer;

-- ============================================
-- TELEGRAM FILES LOG (admin audit)
-- ============================================
create table if not exists public.telegram_files (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  username text default '',
  telegram_chat_id text default '',
  file_id text not null,
  file_type text not null default 'unknown',
  file_name text default '',
  file_size integer default 0,
  mime_type text default '',
  room_id uuid,
  created_at timestamptz default now()
);

alter table public.telegram_files enable row level security;

-- ============================================
-- PROFILE GALLERY
-- ============================================
create table if not exists public.profile_gallery (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  image_url text not null,
  is_private boolean default false,
  created_at timestamptz default now()
);

alter table public.profile_gallery enable row level security;
create policy "Public images are viewable by everyone" on public.profile_gallery for select using (is_private = false);
create policy "Users can view own private images" on public.profile_gallery for select using (auth.uid() = user_id);
create policy "Users can insert own images" on public.profile_gallery for insert with check (auth.uid() = user_id);
create policy "Users can update own images" on public.profile_gallery for update using (auth.uid() = user_id);
create policy "Users can delete own images" on public.profile_gallery for delete using (auth.uid() = user_id);
