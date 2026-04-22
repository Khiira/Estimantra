-- Migration 015: Add actual execution dates to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_start_date TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_end_date TIMESTAMPTZ;
