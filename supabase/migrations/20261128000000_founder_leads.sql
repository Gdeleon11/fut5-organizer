-- =============================================================================
-- Migration: Founder leads capture (Commercial Launch V1)
-- Safe for Staging. NOT to be applied to Production until validated.
--
-- Table: public.founder_leads
-- Stores interest submissions from organizers willing to join the Organizer
-- Pro Fundadores pilot. Access restricted: public can INSERT, only admins can
-- SELECT. No email/phone/names exposed through frontend or analytics events.
-- =============================================================================

BEGIN;

create table if not exists public.founder_leads (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  email text not null,
  city text not null,
  group_frequency text not null,
  group_size text not null,
  consent boolean not null default false,
  source text not null default 'landing',
  status text not null default 'new'
    check (status in ('new', 'contacted', 'onboarded', 'declined')),
  created_at timestamptz not null default now()
);

create index if not exists founder_leads_status_idx on public.founder_leads(status);
create index if not exists founder_leads_created_at_idx on public.founder_leads(created_at desc);

alter table public.founder_leads enable row level security;

-- Public (anon/authenticated) can submit a lead. Never read others' submissions.
drop policy if exists "founder_leads insert public" on public.founder_leads;
create policy "founder_leads insert public"
  on public.founder_leads
  for insert
  to anon, authenticated
  with check (true);

-- Only admins can read leads (private admin view).
drop policy if exists "founder_leads select admin" on public.founder_leads;
create policy "founder_leads select admin"
  on public.founder_leads
  for select
  to authenticated
  using (public.is_admin());

-- Admins can update status (e.g. mark contacted/onboarded/declined).
drop policy if exists "founder_leads update admin" on public.founder_leads;
create policy "founder_leads update admin"
  on public.founder_leads
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

COMMIT;
