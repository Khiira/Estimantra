-- Añadir soporte para guardar feriados automáticos detectados por la API
ALTER TABLE projects ADD COLUMN IF NOT EXISTS auto_holidays JSONB DEFAULT '[]'::jsonb;
