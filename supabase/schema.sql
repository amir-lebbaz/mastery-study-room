-- Supabase PostgreSQL Schema for Mastery Study Room
-- Safe, Scalable & Idempotent Schema Migration (Multi-User 3+ Participants + Zero-Cost Caching)

-- 1. Enable UUID Extension
create extension if not exists "uuid-ossp";

-- 2. Rooms Table
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  timer_mode text check (timer_mode in ('focus', 'break')) default 'focus',
  timer_seconds_remaining int default 3000,
  timer_ends_at timestamptz,
  paused_remaining_seconds int default 3000,
  is_running boolean default false,
  active_source_id uuid,
  created_at timestamptz default now()
);

alter table public.rooms add column if not exists timer_ends_at timestamptz;
alter table public.rooms add column if not exists paused_remaining_seconds int default 3000;

-- 3. Sources Table (Course PDF / Exercises & Extracted Roadmaps)
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  file_name text not null,
  storage_path text,
  extracted_text text,
  roadmap_json jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table public.sources add column if not exists extracted_text text;

-- 4. Student Progress Table (Multi-User tracking: Host & Guests)
create table if not exists public.student_progress (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  user_id text,
  role text default 'guest',
  student_slot text default 'B',
  student_name text default 'Student',
  current_exercise int default 1,
  current_stage int default 1,
  strikes int default 0,
  last_score int default 0,
  passed_stages_json jsonb default '[]'::jsonb,
  mistakes_json jsonb default '[]'::jsonb,
  is_online boolean default false,
  last_seen_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.student_progress add column if not exists user_id text;
alter table public.student_progress add column if not exists role text default 'guest';

-- 5. Tutor Messages Table (AI Evaluations & User Solutions)
create table if not exists public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  user_id text,
  student_slot text default 'shared',
  exercise_index int not null,
  phase int check (phase in (1, 2)) not null,
  role text check (role in ('user', 'assistant', 'system')) not null,
  content text not null,
  image_url text,
  score int,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.tutor_messages add column if not exists user_id text;

-- 6. Room Messages Table (Focus Quick Signals, Break Lounge Chat, Peer Lifelines)
create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  user_id text,
  role text default 'guest',
  sender_slot text default 'B',
  sender_name text not null,
  type text check (type in ('signal', 'chat', 'lifeline')) not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.room_messages add column if not exists user_id text;
alter table public.room_messages add column if not exists role text default 'guest';

-- 7. Mistake Bank Table (Backing MistakeBankModal.tsx)
create table if not exists public.mistake_bank (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade,
  user_id text,
  student_slot text default 'B',
  exercise_index int not null,
  stage int default 1,
  weakness_summary text not null,
  resolved boolean default false,
  created_at timestamptz default now()
);

alter table public.mistake_bank add column if not exists user_id text;

-- 8. Exercise Onboarding Cache Table (Zero-Cost Gemini Token Optimization)
create table if not exists public.exercise_onboarding_cache (
  id uuid primary key default gen_random_uuid(),
  source_id text not null,
  exercise_index int not null,
  content_markdown text not null,
  created_at timestamptz default now(),
  unique(source_id, exercise_index)
);

-- 9. Realtime Enablement
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.student_progress;
alter publication supabase_realtime add table public.room_messages;
alter publication supabase_realtime add table public.tutor_messages;
alter publication supabase_realtime add table public.mistake_bank;

-- 10. Storage Bucket for Course Materials
insert into storage.buckets (id, name, public) 
values ('course_materials', 'course_materials', true)
on conflict (id) do nothing;

-- 11. Row Level Security (RLS) - Open access for Room Code pattern
alter table public.rooms enable row level security;
alter table public.sources enable row level security;
alter table public.student_progress enable row level security;
alter table public.tutor_messages enable row level security;
alter table public.room_messages enable row level security;
alter table public.mistake_bank enable row level security;
alter table public.exercise_onboarding_cache enable row level security;

create policy "Allow all operations for public rooms" on public.rooms for all using (true) with check (true);
create policy "Allow all operations for sources" on public.sources for all using (true) with check (true);
create policy "Allow all operations for student_progress" on public.student_progress for all using (true) with check (true);
create policy "Allow all operations for tutor_messages" on public.tutor_messages for all using (true) with check (true);
create policy "Allow all operations for room_messages" on public.room_messages for all using (true) with check (true);
create policy "Allow all operations for mistake_bank" on public.mistake_bank for all using (true) with check (true);
create policy "Allow all operations for onboarding cache" on public.exercise_onboarding_cache for all using (true) with check (true);
