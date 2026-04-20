-- ============================================================
-- Estimantra - Refuerzo de Seguridad Integral (is_member v2)
-- ============================================================

-- 1. Función Maestra de Seguridad (SECURITY DEFINER)
-- Esta función comprueba si el usuario actual es miembro de una organización.
CREATE OR REPLACE FUNCTION public.is_member(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members 
    WHERE org_id = target_org_id AND user_id = auth.uid()
  );
$$;

-- 2. Limpiar políticas existentes para evitar duplicados/conflictos
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('organizations', 'organization_members', 'projects', 'clients', 'project_roles', 'team_members', 'tasks')) 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- 3. ORGANIZATIONS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_select" ON organizations FOR SELECT USING (is_member(id) OR join_code IS NOT NULL);
CREATE POLICY "org_insert" ON organizations FOR INSERT WITH CHECK (true);
CREATE POLICY "org_update" ON organizations FOR UPDATE USING (is_member(id));
CREATE POLICY "org_delete" ON organizations FOR DELETE USING (is_member(id));

-- 4. ORGANIZATION_MEMBERS
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mem_select" ON organization_members FOR SELECT USING (is_member(org_id) OR user_id = auth.uid());
CREATE POLICY "mem_insert" ON organization_members FOR INSERT WITH CHECK (user_id = auth.uid() OR is_member(org_id));
CREATE POLICY "mem_update" ON organization_members FOR UPDATE USING (is_member(org_id));
CREATE POLICY "mem_delete" ON organization_members FOR DELETE USING (is_member(org_id));

-- 5. CLIENTS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_access" ON clients FOR ALL USING (is_member(org_id));

-- 6. PROJECTS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_access" ON projects FOR ALL USING (is_member(org_id));

-- 7. PROJECT_ROLES
ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_access" ON project_roles FOR ALL USING (
  project_id IN (SELECT id FROM projects WHERE is_member(org_id))
);

-- 8. TEAM_MEMBERS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_access" ON team_members FOR ALL USING (
  project_id IN (SELECT id FROM projects WHERE is_member(org_id))
);

-- 9. TASKS (El punto que reportó el usuario)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_access" ON tasks FOR ALL USING (
  project_id IN (SELECT id FROM projects WHERE is_member(org_id))
);

-- 10. PROFILES (Seguridad de usuario)
-- Ya suelen tener políticas, pero aseguramos las básicas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_access" ON profiles;
CREATE POLICY "profiles_access" ON profiles FOR ALL USING (id = auth.uid() OR EXISTS (
    SELECT 1 FROM organization_members WHERE user_id = profiles.id AND org_id IN (
        SELECT org_id FROM organization_members WHERE user_id = auth.uid()
    )
));
