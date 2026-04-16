-- ============================================================
-- Estimantra - Añadir Esquema de Documento Modular a Proyectos
-- ============================================================

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS proposal_schema JSONB DEFAULT '[]'::jsonb;
