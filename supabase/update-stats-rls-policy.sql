-- Política para permitir a los jugadores insertar y actualizar sus propias estadísticas
-- de partido si son miembros activos del grupo.

create policy "Permitir a jugadores gestionar sus propias estadísticas"
  on public.match_player_stats for all
  using (
    auth.uid() = player_id and public.is_group_member(group_id)
  )
  with check (
    auth.uid() = player_id and public.is_group_member(group_id)
  );
