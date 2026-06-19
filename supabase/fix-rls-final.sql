-- =============================================================================
-- FIX DEFINITIVO: Políticas RLS para group_members
-- Ejecutar este archivo en el SQL Editor de Supabase
-- =============================================================================

-- Eliminar TODAS las políticas existentes de group_members
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

-- Asegurar que RLS esté habilitado
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- POLÍTICA 1: INSERT - Permitir que cualquier usuario autenticado se agregue a cualquier grupo
-- Esto permite: registro con link, unirse a grupo, crear grupo
CREATE POLICY "allow_insert_group_members"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (true);

-- POLÍTICA 2: SELECT - Ver miembros de grupos donde soy miembro o admin
CREATE POLICY "allow_select_group_members"
ON public.group_members
FOR SELECT
TO authenticated
USING (
  profile_id = auth.uid()
  OR public.is_group_member(group_id)
);

-- POLÍTICA 3: UPDATE - Solo admin puede actualizar miembros
CREATE POLICY "allow_update_group_members"
ON public.group_members
FOR UPDATE
TO authenticated
USING (public.is_group_admin(group_id))
WITH CHECK (public.is_group_admin(group_id));

-- POLÍTICA 4: DELETE - Solo admin puede eliminar miembros
CREATE POLICY "allow_delete_group_members"
ON public.group_members
FOR DELETE
TO authenticated
USING (public.is_group_admin(group_id));

-- Asegurar que la constraint CHECK permita los tres roles
ALTER TABLE public.group_members
DROP CONSTRAINT IF EXISTS group_members_role_check;

ALTER TABLE public.group_members
ADD CONSTRAINT group_members_role_check
CHECK (role IN ('super_admin', 'admin', 'player'));

-- =============================================================================
-- POLÍTICAS PARA groups (tablas padres)
-- =============================================================================

-- Verificar que la tabla groups tenga RLS habilitado
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes de groups
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'groups'
      AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s" ON public.groups', pol.policyname);
  END LOOP;
END $$;

-- Política SELECT para groups: ver grupos donde soy miembro
CREATE POLICY "allow_select_groups"
ON public.groups
FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_group_member(id)
);

-- Política INSERT para groups: cualquier usuario puede crear grupos
CREATE POLICY "allow_insert_groups"
ON public.groups
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- Política UPDATE para groups: solo owner puede actualizar
CREATE POLICY "allow_update_groups"
ON public.groups
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Política DELETE para groups: solo owner puede eliminar
CREATE POLICY "allow_delete_groups"
ON public.groups
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- =============================================================================
-- VERIFICAR QUE LAS FUNCIONES EXISTAN
-- =============================================================================

-- Función is_group_member
CREATE OR REPLACE FUNCTION public.is_group_member(target_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = target_group_id
      AND profile_id = auth.uid()
  );
$$;

-- Función is_group_admin
CREATE OR REPLACE FUNCTION public.is_group_admin(target_group_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = target_group_id
      AND profile_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$;
