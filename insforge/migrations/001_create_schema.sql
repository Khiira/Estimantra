-- ============================================================
-- Estimantra - Schema Multi-Inquilino (Limpieza y Recreación)
-- ============================================================

-- DROP TOTAL PARA RECONSTRUCCIÓN LIMPIA
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS project_roles CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_owner_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_owner_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_owner_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. ORGANIZACIONES
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_insert" ON organizations FOR INSERT WITH CHECK (true);

-- 3. MIEMBROS DE ORGANIZACIÓN
CREATE TABLE IF NOT EXISTS organization_members (
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin',
  PRIMARY KEY (org_id, user_id)
);

-- Ahora que existe organization_members, podemos añadir la política de organizaciones
CREATE POLICY "org_select" ON organizations FOR SELECT USING (
  id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
-- Regla simple: un usuario ve sus propios records
CREATE POLICY "org_mem_select" ON organization_members FOR SELECT USING (user_id = auth.uid());
-- Un usuario puede insertarse a sí mismo en una Org recién creada
CREATE POLICY "org_mem_insert" ON organization_members FOR INSERT WITH CHECK (user_id = auth.uid());

-- 4. CLIENTES
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_org" ON clients FOR ALL USING (
  org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
);

-- 5. PROYECTOS (ESTIMACIONES)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  category TEXT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_org" ON projects FOR ALL USING (
  org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
);

-- 6. PERFILES TÉCNICOS
CREATE TABLE IF NOT EXISTS project_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hourly_rate NUMERIC(8, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_org" ON project_roles FOR ALL USING (
  project_id IN (SELECT id FROM projects WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()))
);

-- 7. TEAM MEMBERS (OPCIONAL EN PROYECTO)
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role_profile TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team_members_org" ON team_members FOR ALL USING (
  project_id IN (SELECT id FROM projects WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()))
);

-- 8. TAREAS ESTRUCTURALES
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  description TEXT,
  estimated_hours NUMERIC(8, 2) NOT NULL DEFAULT 0,
  assignee_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  assigned_role_id UUID REFERENCES project_roles(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_org" ON tasks FOR ALL USING (
  project_id IN (SELECT id FROM projects WHERE org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()))
);
