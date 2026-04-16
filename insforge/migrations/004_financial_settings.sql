-- ============================================================
-- Estimantra - Financial Settings & UF Conversion
-- ============================================================

ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS base_currency VARCHAR(5) DEFAULT 'CLP',
ADD COLUMN IF NOT EXISTS uf_conversion_rate NUMERIC(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS billing_mode VARCHAR(20) DEFAULT 'by_role',
ADD COLUMN IF NOT EXISTS flat_hourly_rate NUMERIC(10,2) DEFAULT 0;
