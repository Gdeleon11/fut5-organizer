DROP POLICY IF EXISTS "gm_insert" ON public.group_members;
DROP POLICY IF EXISTS "gm_select" ON public.group_members;
DROP POLICY IF EXISTS "gm_update" ON public.group_members;
DROP POLICY IF EXISTS "gm_delete" ON public.group_members;
DROP POLICY IF EXISTS "group members join self or owner admin" ON public.group_members;
DROP POLICY IF EXISTS "group members select group" ON public.group_members;
DROP POLICY IF EXISTS "group members update admin" ON public.group_members;
DROP POLICY IF EXISTS "group members delete admin" ON public.group_members;
DROP POLICY IF EXISTS "group members insert flexible" ON public.group_members;
DROP POLICY IF EXISTS "allow_insert_group_members" ON public.group_members;
DROP POLICY IF EXISTS "allow_select_group_members" ON public.group_members;
DROP POLICY IF EXISTS "allow_update_group_members" ON public.group_members;
DROP POLICY IF EXISTS "allow_delete_group_members" ON public.group_members;

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm_insert" ON public.group_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "gm_select" ON public.group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "gm_update" ON public.group_members FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "gm_delete" ON public.group_members FOR DELETE TO authenticated USING (true);

CREATE POLICY "g_insert" ON public.groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "g_select" ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "g_update" ON public.groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "g_delete" ON public.groups FOR DELETE TO authenticated USING (true);

CREATE POLICY "m_insert" ON public.matches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "m_select" ON public.matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "m_update" ON public.matches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "m_delete" ON public.matches FOR DELETE TO authenticated USING (true);

CREATE POLICY "a_insert" ON public.attendances FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "a_select" ON public.attendances FOR SELECT TO authenticated USING (true);
CREATE POLICY "a_update" ON public.attendances FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "a_delete" ON public.attendances FOR DELETE TO authenticated USING (true);

CREATE POLICY "t_insert" ON public.teams FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "t_select" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "t_update" ON public.teams FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "t_delete" ON public.teams FOR DELETE TO authenticated USING (true);

CREATE POLICY "f_insert" ON public.fines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "f_select" ON public.fines FOR SELECT TO authenticated USING (true);
CREATE POLICY "f_update" ON public.fines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "f_delete" ON public.fines FOR DELETE TO authenticated USING (true);

CREATE POLICY "pr_insert" ON public.player_ratings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pr_select" ON public.player_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "pr_update" ON public.player_ratings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pr_delete" ON public.player_ratings FOR DELETE TO authenticated USING (true);

CREATE POLICY "s_insert" ON public.settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "s_select" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "s_update" ON public.settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "s_delete" ON public.settings FOR DELETE TO authenticated USING (true);

CREATE POLICY "p_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "p_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "p_update" ON public.profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "p_delete" ON public.profiles FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.is_group_member(target_group_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = target_group_id AND profile_id = auth.uid()); $$;

CREATE OR REPLACE FUNCTION public.is_group_admin(target_group_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = target_group_id AND profile_id = auth.uid() AND role IN ('admin', 'super_admin')); $$;

ALTER TABLE public.group_members DROP CONSTRAINT IF EXISTS group_members_role_check;
ALTER TABLE public.group_members ADD CONSTRAINT group_members_role_check CHECK (role IN ('super_admin', 'admin', 'player'));
