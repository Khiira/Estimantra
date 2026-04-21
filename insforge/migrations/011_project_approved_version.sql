-- Añadir soporte para recordar qué versión del proyecto fue aprobada
ALTER TABLE projects ADD COLUMN IF NOT EXISTS approved_version TEXT;
