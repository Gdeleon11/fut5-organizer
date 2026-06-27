-- Court reservations system
-- Run this in Supabase SQL Editor

create table if not exists public.court_reservations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  venue text not null,
  reservation_date date not null,
  reservation_time text,
  assigned_to uuid references public.profiles(id) on delete set null,
  assigned_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'canceled')),
  proof_url text,
  notes text,
  match_id uuid references public.matches(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.court_reservations enable row level security;

drop policy if exists "court_reservations_select" on public.court_reservations;
drop policy if exists "court_reservations_insert" on public.court_reservations;
drop policy if exists "court_reservations_update" on public.court_reservations;
drop policy if exists "court_reservations_delete" on public.court_reservations;

create policy "court_reservations_select" on public.court_reservations for select using (true);
create policy "court_reservations_insert" on public.court_reservations for insert with check (true);
create policy "court_reservations_update" on public.court_reservations for update using (true);
create policy "court_reservations_delete" on public.court_reservations for delete using (true);

create index if not exists idx_court_reservations_group on public.court_reservations(group_id);
create index if not exists idx_court_reservations_date on public.court_reservations(reservation_date);
create index if not exists idx_court_reservations_assigned on public.court_reservations(assigned_to);
