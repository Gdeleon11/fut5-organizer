-- Tournament system migration
-- Run this in Supabase SQL Editor

-- 1. Tournaments table
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  format text not null check (format in ('cuadrangular', 'league', 'league_playoffs', 'playoffs_only')),
  status text not null default 'draft' check (status in ('draft', 'active', 'finished')),
  start_date date,
  match_time text default '19:00',
  match_day text default 'monday',
  venue text,
  created_at timestamptz not null default now()
);

-- 2. Tournament teams (the teams in the tournament)
create table if not exists public.tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  team_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(tournament_id, team_order)
);

-- 3. Tournament team members (which players belong to which team)
create table if not exists public.tournament_team_members (
  id uuid primary key default gen_random_uuid(),
  tournament_team_id uuid not null references public.tournament_teams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(tournament_team_id, profile_id)
);

-- 4. Tournament matches (generated fixtures)
create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round integer not null default 1,
  match_order integer not null default 0,
  home_team_id uuid references public.tournament_teams(id) on delete set null,
  away_team_id uuid references public.tournament_teams(id) on delete set null,
  match_date date,
  match_time text,
  venue text,
  home_score integer,
  away_score integer,
  status text not null default 'pending' check (status in ('pending', 'played', 'canceled')),
  match_id uuid references public.matches(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 5. Tournament standings (auto-calculated or manual)
create table if not exists public.tournament_standings (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  tournament_team_id uuid not null references public.tournament_teams(id) on delete cascade,
  played integer not null default 0,
  won integer not null default 0,
  drawn integer not null default 0,
  lost integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  unique(tournament_id, tournament_team_id)
);

-- 6. Match statistics
create table if not exists public.match_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  goals integer not null default 0,
  assists integer not null default 0,
  yellow_cards integer not null default 0,
  red_cards integer not null default 0,
  minutes_played integer,
  created_at timestamptz not null default now(),
  unique(match_id, profile_id)
);

-- 7. Recurring matches config
create table if not exists public.recurring_matches (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text default 'Chamuscón semanal',
  venue text,
  match_time text default '19:00',
  day_of_week integer not null default 1,
  min_players integer default 10,
  max_players integer default 18,
  is_active boolean not null default true,
  last_generated_date date,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_tournament_team_members_team on public.tournament_team_members(tournament_team_id);
create index if not exists idx_tournament_team_members_profile on public.tournament_team_members(profile_id);
create index if not exists idx_tournament_matches_tournament on public.tournament_matches(tournament_id);
create index if not exists idx_tournament_standings_tournament on public.tournament_standings(tournament_id);
create index if not exists idx_match_stats_match on public.match_stats(match_id);
create index if not exists idx_match_stats_profile on public.match_stats(profile_id);
create index if not exists idx_recurring_matches_group on public.recurring_matches(group_id);

-- RLS policies
alter table public.tournaments enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.tournament_team_members enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.tournament_standings enable row level security;
alter table public.match_stats enable row level security;
alter table public.recurring_matches enable row level security;

-- Tournaments: everyone in group can read, admin can write
create policy "tournaments_select" on public.tournaments for select using (true);
create policy "tournaments_insert" on public.tournaments for insert with check (true);
create policy "tournaments_update" on public.tournaments for update using (true);
create policy "tournaments_delete" on public.tournaments for delete using (true);

create policy "tournament_teams_select" on public.tournament_teams for select using (true);
create policy "tournament_teams_insert" on public.tournament_teams for insert with check (true);
create policy "tournament_teams_update" on public.tournament_teams for update using (true);
create policy "tournament_teams_delete" on public.tournament_teams for delete using (true);

create policy "tournament_team_members_select" on public.tournament_team_members for select using (true);
create policy "tournament_team_members_insert" on public.tournament_team_members for insert with check (true);
create policy "tournament_team_members_update" on public.tournament_team_members for update using (true);
create policy "tournament_team_members_delete" on public.tournament_team_members for delete using (true);

create policy "tournament_matches_select" on public.tournament_matches for select using (true);
create policy "tournament_matches_insert" on public.tournament_matches for insert with check (true);
create policy "tournament_matches_update" on public.tournament_matches for update using (true);
create policy "tournament_matches_delete" on public.tournament_matches for delete using (true);

create policy "tournament_standings_select" on public.tournament_standings for select using (true);
create policy "tournament_standings_insert" on public.tournament_standings for insert with check (true);
create policy "tournament_standings_update" on public.tournament_standings for update using (true);
create policy "tournament_standings_delete" on public.tournament_standings for delete using (true);

create policy "match_stats_select" on public.match_stats for select using (true);
create policy "match_stats_insert" on public.match_stats for insert with check (true);
create policy "match_stats_update" on public.match_stats for update using (true);
create policy "match_stats_delete" on public.match_stats for delete using (true);

create policy "recurring_matches_select" on public.recurring_matches for select using (true);
create policy "recurring_matches_insert" on public.recurring_matches for insert with check (true);
create policy "recurring_matches_update" on public.recurring_matches for update using (true);
create policy "recurring_matches_delete" on public.recurring_matches for delete using (true);
