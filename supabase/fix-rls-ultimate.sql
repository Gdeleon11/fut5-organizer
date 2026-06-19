-- =============================================================================
-- FIX ULTIMATE: Políticas RLS ultra-simples para group_members
-- Ejecutar este archivo en el SQL Editor de Supabase
-- =============================================================================

-- Eliminar TODAS las políticas existentes
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename IN ('group_members', 'groups')
      AND schemaname = 'public'
  LOOP
    IF pol.tablename = 'group_members' THEN
      EXECUTE format('DROP POLICY IF EXISTS "%s" ON public.group_members', pol.policyname);
    ELSE
      EXECUTE format('DROP POLICY IF EXISTS "%s" ON public.groups', pol.policyname);
    END IF;
  END LOOP;
END $$;

-- Habilitar RLS en ambas tablas
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- POLÍTICAS PARA group_members (ULTRA SIMPLES)
-- =============================================================================

-- INSERT: Cualquier usuario autenticado puede insertar (sin restricciones)
CREATE POLICY "gm_insert"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (true);

-- SELECT: Cualquier usuario autenticado puede leer (filtrado por código)
CREATE POLICY "gm_select"
ON public.group_members
FOR SELECT
TO authenticated
USING (true);

-- UPDATE: Cualquier usuario autenticado puede actualizar (filtrado por código)
CREATE POLICY "gm_update"
ON public.group_members
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE: Cualquier usuario autenticado puede eliminar (filtrado por código)
CREATE POLICY "gm_delete"
ON public.group_members
FOR DELETE
TO authenticated
USING (true);

-- =============================================================================
-- POLÍTICAS PARA groups (ULTRA SIMPLES)
-- =============================================================================

-- INSERT: Cualquier usuario autenticado puede crear grupos
CREATE POLICY "g_insert"
ON public.groups
FOR INSERT
TO authenticated
WITH CHECK (true);

-- SELECT: Cualquier usuario autenticado puede leer grupos
CREATE POLICY "g_select"
ON public.groups
FOR SELECT
TO authenticated
USING (true);

-- UPDATE: Cualquier usuario autenticado puede actualizar grupos
CREATE POLICY "g_update"
ON public.groups
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE: Cualquier usuario autenticado puede eliminar grupos
CREATE POLICY "g_delete"
ON public.groups
FOR DELETE
TO authenticated
USING (true);

-- =============================================================================
-- ASEGURAR QUE LAS FUNCIONES EXISTAN (para otras partes de la app)
-- =============================================================================

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

-- =============================================================================
-- VERIFICAR CONSTRAINT DE ROLES
-- =============================================================================

ALTER TABLE public.group_members
DROP CONSTRAINT IF EXISTS group_members_role_check;

ALTER TABLE public.group_members
ADD CONSTRAINT group_members_role_check
CHECK (role IN ('super_admin', 'admin', 'player'));
