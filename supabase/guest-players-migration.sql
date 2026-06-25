-- Guest players for matches (temporary, match-only)
-- Run this in Supabase SQL Editor

-- Drop and recreate with nullable group_id
DROP TABLE IF EXISTS public.guest_players CASCADE;

create table public.guest_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  name text not null,
  rating integer not null default 2 check (rating between 1 and 4),
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.guest_players enable row level security;

create policy "guest_players_select" on public.guest_players for select using (true);
create policy "guest_players_insert" on public.guest_players for insert with check (true);
create policy "guest_players_update" on public.guest_players for update using (true);
create policy "guest_players_delete" on public.guest_players for delete using (true);

create index idx_guest_players_match on public.guest_players(match_id);
create index idx_guest_players_group on public.guest_players(group_id);
