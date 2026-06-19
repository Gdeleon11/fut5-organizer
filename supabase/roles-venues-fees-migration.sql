-- =============================================================================
-- MIGRATION: Roles, Venues, Match Fees, Collections
-- Run this once against your Supabase project via the SQL editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ROLES — add super_admin to group_members
-- -----------------------------------------------------------------------------

alter table public.group_members
  drop constraint if exists group_members_role_check;

alter table public.group_members
  add constraint group_members_role_check
  check (role in ('super_admin', 'admin', 'player'));

-- Promote existing admins that are also group owners to super_admin
update public.group_members gm
set role = 'super_admin'
from public.groups g
where gm.group_id = g.id
  and gm.profile_id = g.owner_id
  and gm.role = 'admin';

-- -----------------------------------------------------------------------------
-- 2. VENUES — court catalogue per group
-- -----------------------------------------------------------------------------

create table if not exists public.venues (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  name        text not null,
  address     text,
  photo_url   text,
  default_cost numeric not null default 0,
  notes       text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists venues_set_updated_at on public.venues;
create trigger venues_set_updated_at
before update on public.venues
for each row execute function public.set_updated_at();

create index if not exists venues_group_idx on public.venues(group_id);

-- Add venue_id and court_cost to matches
alter table public.matches
  add column if not exists venue_id uuid references public.venues(id) on delete set null;

alter table public.matches
  add column if not exists court_cost numeric not null default 0;

-- -----------------------------------------------------------------------------
-- 3. MATCH FEES — per-match court cost splitting
-- -----------------------------------------------------------------------------

create table if not exists public.match_fees (
  id                 uuid primary key default gen_random_uuid(),
  match_id           uuid not null references public.matches(id) on delete cascade,
  group_id           uuid not null references public.groups(id) on delete cascade,
  total_amount       numeric not null default 0,
  per_player_amount  numeric not null default 0,
  due_before         timestamptz,
  status             text not null default 'open'
                       check (status in ('open', 'settled')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (match_id)  -- one fee record per match
);

drop trigger if exists match_fees_set_updated_at on public.match_fees;
create trigger match_fees_set_updated_at
before update on public.match_fees
for each row execute function public.set_updated_at();

create index if not exists match_fees_group_idx on public.match_fees(group_id);
create index if not exists match_fees_match_idx on public.match_fees(match_id);

-- -----------------------------------------------------------------------------
-- 4. MATCH FEE PAYMENTS — individual payment tracking
-- -----------------------------------------------------------------------------

create table if not exists public.match_fee_payments (
  id            uuid primary key default gen_random_uuid(),
  match_fee_id  uuid not null references public.match_fees(id) on delete cascade,
  group_id      uuid not null references public.groups(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending', 'paid', 'forgiven')),
  paid_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (match_fee_id, profile_id)
);

drop trigger if exists match_fee_payments_set_updated_at on public.match_fee_payments;
create trigger match_fee_payments_set_updated_at
before update on public.match_fee_payments
for each row execute function public.set_updated_at();

create index if not exists match_fee_payments_fee_idx
  on public.match_fee_payments(match_fee_id);
create index if not exists match_fee_payments_profile_idx
  on public.match_fee_payments(profile_id, status);
create index if not exists match_fee_payments_group_idx
  on public.match_fee_payments(group_id);

-- -----------------------------------------------------------------------------
-- 5. COLLECTIONS — extra group-wide fundraisers
-- -----------------------------------------------------------------------------

create table if not exists public.collections (
  id                 uuid primary key default gen_random_uuid(),
  group_id           uuid not null references public.groups(id) on delete cascade,
  title              text not null,
  description        text,
  amount_per_player  numeric not null default 0,
  due_date           date,
  status             text not null default 'open'
                       check (status in ('open', 'closed')),
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
before update on public.collections
for each row execute function public.set_updated_at();

create index if not exists collections_group_idx on public.collections(group_id);

-- -----------------------------------------------------------------------------
-- 6. COLLECTION PAYMENTS — individual payment tracking for collections
-- -----------------------------------------------------------------------------

create table if not exists public.collection_payments (
  id             uuid primary key default gen_random_uuid(),
  collection_id  uuid not null references public.collections(id) on delete cascade,
  group_id       uuid not null references public.groups(id) on delete cascade,
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  status         text not null default 'pending'
                   check (status in ('pending', 'paid', 'forgiven')),
  paid_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (collection_id, profile_id)
);

drop trigger if exists collection_payments_set_updated_at on public.collection_payments;
create trigger collection_payments_set_updated_at
before update on public.collection_payments
for each row execute function public.set_updated_at();

create index if not exists collection_payments_collection_idx
  on public.collection_payments(collection_id);
create index if not exists collection_payments_profile_idx
  on public.collection_payments(profile_id, status);
create index if not exists collection_payments_group_idx
  on public.collection_payments(group_id);

-- -----------------------------------------------------------------------------
-- 7. HELPER FUNCTIONS — role checks
-- -----------------------------------------------------------------------------

-- Check if current user is super_admin in a group
create or replace function public.is_group_super_admin(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = target_group_id
      and profile_id = auth.uid()
      and role = 'super_admin'
  );
$$;

-- Check if current user is admin OR super_admin in a group (for backwards compat)
create or replace function public.is_group_admin(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = target_group_id
      and profile_id = auth.uid()
      and role in ('admin', 'super_admin')
  );
$$;

-- Check if current user is an active member of a group
create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = target_group_id
      and profile_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- 8. RLS — venues
-- -----------------------------------------------------------------------------

alter table public.venues enable row level security;

drop policy if exists "venues select member" on public.venues;
create policy "venues select member"
on public.venues for select to authenticated
using (public.is_group_member(group_id));

drop policy if exists "venues insert admin" on public.venues;
create policy "venues insert admin"
on public.venues for insert to authenticated
with check (public.is_group_admin(group_id));

drop policy if exists "venues update admin" on public.venues;
create policy "venues update admin"
on public.venues for update to authenticated
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));

drop policy if exists "venues delete admin" on public.venues;
create policy "venues delete admin"
on public.venues for delete to authenticated
using (public.is_group_admin(group_id));

-- -----------------------------------------------------------------------------
-- 9. RLS — match_fees
-- -----------------------------------------------------------------------------

alter table public.match_fees enable row level security;

drop policy if exists "match fees select member" on public.match_fees;
create policy "match fees select member"
on public.match_fees for select to authenticated
using (public.is_group_member(group_id));

drop policy if exists "match fees insert admin" on public.match_fees;
create policy "match fees insert admin"
on public.match_fees for insert to authenticated
with check (public.is_group_admin(group_id));

drop policy if exists "match fees update admin" on public.match_fees;
create policy "match fees update admin"
on public.match_fees for update to authenticated
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));

drop policy if exists "match fees delete admin" on public.match_fees;
create policy "match fees delete admin"
on public.match_fees for delete to authenticated
using (public.is_group_admin(group_id));

-- -----------------------------------------------------------------------------
-- 10. RLS — match_fee_payments
-- -----------------------------------------------------------------------------

alter table public.match_fee_payments enable row level security;

drop policy if exists "match fee payments select own or admin" on public.match_fee_payments;
create policy "match fee payments select own or admin"
on public.match_fee_payments for select to authenticated
using (
  profile_id = auth.uid()
  or public.is_group_admin(group_id)
);

drop policy if exists "match fee payments insert admin" on public.match_fee_payments;
create policy "match fee payments insert admin"
on public.match_fee_payments for insert to authenticated
with check (public.is_group_admin(group_id));

drop policy if exists "match fee payments update admin" on public.match_fee_payments;
create policy "match fee payments update admin"
on public.match_fee_payments for update to authenticated
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));

-- -----------------------------------------------------------------------------
-- 11. RLS — collections
-- -----------------------------------------------------------------------------

alter table public.collections enable row level security;

drop policy if exists "collections select member" on public.collections;
create policy "collections select member"
on public.collections for select to authenticated
using (public.is_group_member(group_id));

drop policy if exists "collections insert admin" on public.collections;
create policy "collections insert admin"
on public.collections for insert to authenticated
with check (public.is_group_admin(group_id));

drop policy if exists "collections update admin" on public.collections;
create policy "collections update admin"
on public.collections for update to authenticated
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));

drop policy if exists "collections delete admin" on public.collections;
create policy "collections delete admin"
on public.collections for delete to authenticated
using (public.is_group_admin(group_id));

-- -----------------------------------------------------------------------------
-- 12. RLS — collection_payments
-- -----------------------------------------------------------------------------

alter table public.collection_payments enable row level security;

drop policy if exists "collection payments select own or admin" on public.collection_payments;
create policy "collection payments select own or admin"
on public.collection_payments for select to authenticated
using (
  profile_id = auth.uid()
  or public.is_group_admin(group_id)
);

drop policy if exists "collection payments insert admin" on public.collection_payments;
create policy "collection payments insert admin"
on public.collection_payments for insert to authenticated
with check (public.is_group_admin(group_id));

drop policy if exists "collection payments update admin" on public.collection_payments;
create policy "collection payments update admin"
on public.collection_payments for update to authenticated
using (public.is_group_admin(group_id))
with check (public.is_group_admin(group_id));

-- -----------------------------------------------------------------------------
-- 13. RLS — player_ratings: only super_admin can insert
-- -----------------------------------------------------------------------------

drop policy if exists "ratings insert admin" on public.player_ratings;
create policy "ratings insert super_admin"
on public.player_ratings for insert to authenticated
with check (public.is_group_super_admin(group_id) and assigned_by = auth.uid());

drop policy if exists "ratings update admin" on public.player_ratings;
create policy "ratings update super_admin"
on public.player_ratings for update to authenticated
using (public.is_group_super_admin(group_id))
with check (public.is_group_super_admin(group_id));

-- -----------------------------------------------------------------------------
-- 14. Storage bucket for venue photos
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'venue-photos',
  'venue-photos',
  true,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "venue photos public read" on storage.objects;
create policy "venue photos public read"
on storage.objects for select to public
using (bucket_id = 'venue-photos');

drop policy if exists "venue photos admin upload" on storage.objects;
create policy "venue photos admin upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'venue-photos');

drop policy if exists "venue photos admin update" on storage.objects;
create policy "venue photos admin update"
on storage.objects for update to authenticated
using (bucket_id = 'venue-photos')
with check (bucket_id = 'venue-photos');

drop policy if exists "venue photos admin delete" on storage.objects;
create policy "venue photos admin delete"
on storage.objects for delete to authenticated
using (bucket_id = 'venue-photos');

-- -----------------------------------------------------------------------------
-- 15. Fix group_members insert policy to allow super_admin role for group owner
-- -----------------------------------------------------------------------------

drop policy if exists "group members join self or owner admin" on public.group_members;
create policy "group members join self or owner admin"
on public.group_members
for insert
to authenticated
with check (
  -- Any authenticated user can join as an inactive player
  (profile_id = auth.uid() and role = 'player' and is_active = false)
  or
  -- The group owner inserts themselves as super_admin when creating a group
  (
    profile_id = auth.uid()
    and role in ('super_admin', 'admin')
    and is_active = true
    and exists (
      select 1 from public.groups
      where groups.id = group_id
        and groups.owner_id = auth.uid()
    )
  )
);
