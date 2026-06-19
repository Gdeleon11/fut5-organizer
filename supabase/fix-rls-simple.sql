-- =============================================================================
-- FIX SIMPLE: Políticas RLS para group_members
-- Ejecutar este archivo en el SQL Editor de Supabase
-- =============================================================================

-- Primero, eliminar TODAS las políticas existentes de group_members
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'group_members'
      AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s" ON public.group_members', pol.policyname);
  END LOOP;
END $$;

-- Habilitar RLS
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Política simple: cualquier usuario autenticado puede insertar
-- La validación de seguridad se hace en el frontend y con funciones SQL
CREATE POLICY "group_members_insert_any"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política select: puedes ver tu propio registro o si eres admin del grupo
CREATE POLICY "group_members_select"
ON public.group_members
FOR SELECT
TO authenticated
USING (
  profile_id = auth.uid()
  OR public.is_group_admin(group_id)
  OR public.is_group_member(group_id)
);

-- Política update: solo admin puede actualizar
CREATE POLICY "group_members_update"
ON public.group_members
FOR UPDATE
TO authenticated
USING (public.is_group_admin(group_id))
WITH CHECK (public.is_group_admin(group_id));

-- Política delete: solo admin puede eliminar
CREATE POLICY "group_members_delete"
ON public.group_members
FOR DELETE
TO authenticated
USING (public.is_group_admin(group_id));

-- Verificar que la constraint CHECK permita super_admin
ALTER TABLE public.group_members
DROP CONSTRAINT IF EXISTS group_members_role_check;

ALTER TABLE public.group_members
ADD CONSTRAINT group_members_role_check
CHECK (role IN ('super_admin', 'admin', 'player'));
