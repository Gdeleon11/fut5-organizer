DROP POLICY IF EXISTS "gm_insert" ON public.group_members;
DROP POLICY IF EXISTS "gm_select" ON public.group_members;
DROP POLICY IF EXISTS "gm_update" ON public.group_members;
DROP POLICY IF EXISTS "gm_delete" ON public.group_members;
DROP POLICY IF EXISTS "g_insert" ON public.groups;
DROP POLICY IF EXISTS "g_select" ON public.groups;
DROP POLICY IF EXISTS "g_update" ON public.groups;
DROP POLICY IF EXISTS "g_delete" ON public.groups;
DROP POLICY IF EXISTS "group members join self or owner admin" ON public.group_members;
DROP POLICY IF EXISTS "group members select group" ON public.group_members;
DROP POLICY IF EXISTS "group members update admin" ON public.group_members;
DROP POLICY IF EXISTS "group members delete admin" ON public.group_members;
DROP POLICY IF EXISTS "group members insert flexible" ON public.group_members;
DROP POLICY IF EXISTS "group members insert any" ON public.group_members;
DROP POLICY IF EXISTS "group_members_insert_any" ON public.group_members;
DROP POLICY IF EXISTS "group_members_select" ON public.group_members;
DROP POLICY IF EXISTS "group_members_insert" ON public.group_members;
DROP POLICY IF EXISTS "group_members_update" ON public.group_members;
DROP POLICY IF EXISTS "group_members_delete" ON public.group_members;
DROP POLICY IF EXISTS "allow_insert_group_members" ON public.group_members;
DROP POLICY IF EXISTS "allow_select_group_members" ON public.group_members;
DROP POLICY IF EXISTS "allow_update_group_members" ON public.group_members;
DROP POLICY IF EXISTS "allow_delete_group_members" ON public.group_members;

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm_insert" ON public.group_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "gm_select" ON public.group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "gm_update" ON public.group_members FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "gm_delete" ON public.group_members FOR DELETE TO authenticated USING (true);

CREATE POLICY "g_insert" ON public.groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "g_select" ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "g_update" ON public.groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "g_delete" ON public.groups FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.is_group_member(target_group_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = target_group_id AND profile_id = auth.uid()); $$;

CREATE OR REPLACE FUNCTION public.is_group_admin(target_group_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = target_group_id AND profile_id = auth.uid() AND role IN ('admin', 'super_admin')); $$;

ALTER TABLE public.group_members DROP CONSTRAINT IF EXISTS group_members_role_check;
ALTER TABLE public.group_members ADD CONSTRAINT group_members_role_check CHECK (role IN ('super_admin', 'admin', 'player'));
