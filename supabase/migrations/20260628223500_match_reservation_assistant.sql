-- Reservation assistant fields on matches.

alter table public.matches
  add column if not exists requires_reservation boolean not null default false,
  add column if not exists reservation_owner_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists reservation_notes text,
  add column if not exists preferred_dates date[] not null default '{}',
  add column if not exists preferred_time_range text,
  add column if not exists reservation_status text not null default 'none';

alter table public.matches
  drop constraint if exists matches_reservation_status_check;

alter table public.matches
  add constraint matches_reservation_status_check
  check (reservation_status in ('none', 'pending', 'confirmed', 'failed'));

create index if not exists matches_reservation_owner_idx
  on public.matches(reservation_owner_user_id, reservation_status);

create index if not exists matches_requires_reservation_idx
  on public.matches(group_id, requires_reservation, reservation_status);
