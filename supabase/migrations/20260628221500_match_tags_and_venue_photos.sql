-- Add player subgroup tags and match visibility tags.

alter table public.profiles
  add column if not exists group_tags text[] not null default '{}';

alter table public.matches
  add column if not exists allowed_tags text[] not null default '{}';

alter table public.matches
  add column if not exists court_photo_url text;

alter table public.venues
  add column if not exists photo_url text;

create index if not exists profiles_group_tags_gin
  on public.profiles using gin (group_tags);

create index if not exists matches_allowed_tags_gin
  on public.matches using gin (allowed_tags);
