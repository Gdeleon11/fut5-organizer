-- Player voting system (1-10 rating)
-- Run this in Supabase SQL Editor

-- Drop old table if exists and recreate
DROP TABLE IF EXISTS public.player_votes CASCADE;

create table public.player_votes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  voted_id uuid not null references public.profiles(id) on delete cascade,
  vote integer not null check (vote between 1 and 10),
  created_at timestamptz not null default now(),
  unique(group_id, voter_id, voted_id)
);

alter table public.player_votes enable row level security;

create policy "player_votes_select" on public.player_votes for select using (true);
create policy "player_votes_insert" on public.player_votes for insert with check (true);
create policy "player_votes_update" on public.player_votes for update using (true);
create policy "player_votes_delete" on public.player_votes for delete using (true);

create index idx_player_votes_group on public.player_votes(group_id);
create index idx_player_votes_voted on public.player_votes(voted_id);
create index idx_player_votes_voter on public.player_votes(voter_id);
