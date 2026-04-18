-- ============================================================
-- Estimantra - Agregar columna version a tasks
-- ============================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS version TEXT DEFAULT '1.0';
