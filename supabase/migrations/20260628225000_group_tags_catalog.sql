-- Reusable subgroup tag catalog per group.

create table if not exists public.group_tags (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (group_id, name)
);

alter table public.group_tags enable row level security;

drop policy if exists "group_tags_select" on public.group_tags;
create policy "group_tags_select" on public.group_tags
for select using (true);

drop policy if exists "group_tags_insert" on public.group_tags;
create policy "group_tags_insert" on public.group_tags
for insert with check (true);

drop policy if exists "group_tags_delete" on public.group_tags;
create policy "group_tags_delete" on public.group_tags
for delete using (true);

create index if not exists group_tags_group_idx on public.group_tags(group_id);

insert into public.group_tags (group_id, name)
select distinct gm.group_id, tag
from public.group_members gm
join public.profiles p on p.id = gm.profile_id
cross join unnest(coalesce(p.group_tags, '{}')) as tag
where tag is not null and tag <> ''
on conflict (group_id, name) do nothing;
