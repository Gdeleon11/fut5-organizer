-- =============================================================================
-- FIX: Corregir políticas RLS de group_members
-- Ejecutar esta migración para arreglar el error "new row violates row-level 
-- security policy" al registrarse con un link de grupo compartido
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Eliminar todas las políticas RLS existentes de group_members
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "group members join self or owner admin" ON public.group_members;
DROP POLICY IF EXISTS "group members select group" ON public.group_members;
DROP POLICY IF EXISTS "group members update admin" ON public.group_members;
DROP POLICY IF EXISTS "group members delete admin" ON public.group_members;

-- -----------------------------------------------------------------------------
-- 2. Crear políticas RLS corregidas
-- -----------------------------------------------------------------------------

-- SELECT: Los miembros del grupo pueden ver a otros miembros del mismo grupo
CREATE POLICY "group members select group"
ON public.group_members
FOR SELECT
TO authenticated
USING (public.is_group_member(group_id));

-- INSERT: Permitir三种情况:
--   a) Usuario se une a sí mismo como player inactivo (registro con link compartido)
--   b) Owner del grupo se inserta como super_admin (creación de grupo)
--   c) Admin del grupo puede insertar nuevos miembros
CREATE POLICY "group members insert flexible"
ON public.group_members
FOR INSERT
TO authenticated
WITH CHECK (
  -- Caso a): Cualquier usuario autenticado puede unirse a un grupo como player inactivo
  -- Esto permite el registro con link compartido (?group=xxx)
  (
    profile_id = auth.uid()
    AND role = 'player'
    AND is_active = false
  )
  OR
  -- Caso b): El owner del grupo puede insertarse como super_admin o admin
  -- Esto permite crear un grupo nuevo
  (
    profile_id = auth.uid()
    AND role IN ('super_admin', 'admin')
    AND is_active = true
    AND EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_id
        AND groups.owner_id = auth.uid()
    )
  )
  OR
  -- Caso c): Un admin o super_admin del grupo puede insertar nuevos miembros
  -- Esto permite agregar jugadores desde el panel de admin
  (
    public.is_group_admin(group_id)
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = profile_id
    )
  )
);

-- UPDATE: Admin del grupo puede actualizar miembros
CREATE POLICY "group members update admin"
ON public.group_members
FOR UPDATE
TO authenticated
USING (public.is_group_admin(group_id))
WITH CHECK (public.is_group_admin(group_id));

-- DELETE: Admin del grupo puede eliminar miembros
CREATE POLICY "group members delete admin"
ON public.group_members
FOR DELETE
TO authenticated
USING (public.is_group_admin(group_id));

-- -----------------------------------------------------------------------------
-- 3. Verificar que la función is_group_admin existe y funciona correctamente
-- -----------------------------------------------------------------------------

-- La función ya debería existir de migraciones anteriores, pero la recreamos
-- para asegurar que esté correcta
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

-- -----------------------------------------------------------------------------
-- 4. Verificar que la función is_group_member existe
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- 5. Asegurar que el constraint CHECK permita 'super_admin'
-- -----------------------------------------------------------------------------

-- Eliminar constraint anterior si existe
ALTER TABLE public.group_members
DROP CONSTRAINT IF EXISTS group_members_role_check;

-- Crear constraint que permita los tres roles
ALTER TABLE public.group_members
ADD CONSTRAINT group_members_role_check
CHECK (role IN ('super_admin', 'admin', 'player'));

-- -----------------------------------------------------------------------------
-- 6. Habilitar RLS en la tabla (por si no está habilitado)
-- -----------------------------------------------------------------------------

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
