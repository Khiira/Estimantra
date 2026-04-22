-- ============================================================
-- Estimantra - Migraciones Seguras para Seguimiento Paralelo
-- ============================================================

-- 1. Añadir dependencias y modo de seguimiento a tasks y projects
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS predecessor_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tracking_mode TEXT DEFAULT 'linear';

-- 2. Vincular miembros del equipo con roles para cálculo de capacidad
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES project_roles(id) ON DELETE SET NULL;

-- 3. Comentario de seguridad: 
-- Estas columnas son opcionales y no afectan el funcionamiento actual de producción.
