-- Migración para Gamificación y Finanzas Transparentes (Caja Chica)

-- 1. Tabla de Estadísticas de Jugador por Partido
create table if not exists public.match_player_stats (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  match_id uuid references public.matches(id) on delete cascade not null,
  player_id uuid references public.profiles(id) on delete cascade,
  guest_player_id uuid references public.guest_players(id) on delete cascade,
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  mvp boolean not null default false,
  clean_sheet boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references public.profiles(id) on delete set null,
  
  -- Asegurar que un jugador (o invitado) tenga solo una fila de estadísticas por partido
  constraint match_player_stats_unique_player unique (match_id, player_id),
  constraint match_player_stats_unique_guest unique (match_id, guest_player_id),
  -- Debe apuntar a un jugador registrado o a un invitado, pero no a ambos
  constraint match_player_stats_target_check check (
    (player_id is not null and guest_player_id is null) or
    (player_id is null and guest_player_id is not null)
  )
);

-- Habilitar RLS en match_player_stats
alter table public.match_player_stats enable row level security;

-- Política de lectura para miembros del grupo
create policy "Permitir lectura de estadísticas a miembros"
  on public.match_player_stats for select
  using (
    public.is_group_member(group_id)
  );

-- Política de modificación total para administradores del grupo
create policy "Permitir gestionar estadísticas a administradores"
  on public.match_player_stats for all
  using (
    public.is_group_admin(group_id)
  );


-- 2. Tabla de Gastos Manuales del Grupo
create table if not exists public.group_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade not null,
  description text not null,
  amount numeric(10,2) not null check (amount > 0),
  category text not null check (category in ('canchas', 'balones', 'chalecos', 'arbitraje', 'comida', 'otros')),
  expense_date date not null default current_date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references public.profiles(id) on delete set null
);

-- Habilitar RLS en group_expenses
alter table public.group_expenses enable row level security;

-- Política de lectura para miembros del grupo
create policy "Permitir lectura de egresos a miembros"
  on public.group_expenses for select
  using (
    public.is_group_member(group_id)
  );

-- Política de modificación total para administradores del grupo
create policy "Permitir gestionar egresos a administradores"
  on public.group_expenses for all
  using (
    public.is_group_admin(group_id)
  );
