-- ============================================================
-- Estimantra - Estados de Proyecto y Configuración de Seguimiento
-- ============================================================

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'en_progreso',
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS working_days INTEGER[] DEFAULT '{1,2,3,4,5}',
ADD COLUMN IF NOT EXISTS holidays DATE[] DEFAULT '{}';

-- Comentario para documentar los estados permitidos:
-- status: 'en_progreso', 'en_espera', 'aprobado'
