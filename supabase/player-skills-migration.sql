-- Player skills system
-- Run this in Supabase SQL Editor

create table if not exists public.player_skills (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  skill text not null check (skill in (
    'wizard', 'cannon', 'wings', 'shield', 'strong_leg', 'goalkeeper', 'captain', 'veteran', 'speedy', 'tactician'
  )),
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(group_id, player_id, skill)
);

alter table public.player_skills enable row level security;

drop policy if exists "player_skills_select" on public.player_skills;
drop policy if exists "player_skills_insert" on public.player_skills;
drop policy if exists "player_skills_update" on public.player_skills;
drop policy if exists "player_skills_delete" on public.player_skills;

create policy "player_skills_select" on public.player_skills for select using (true);
create policy "player_skills_insert" on public.player_skills for insert with check (true);
create policy "player_skills_update" on public.player_skills for update using (true);
create policy "player_skills_delete" on public.player_skills for delete using (true);

create index idx_player_skills_group on public.player_skills(group_id);
create index idx_player_skills_player on public.player_skills(player_id);
create index idx_player_skills_skill on public.player_skills(skill);
