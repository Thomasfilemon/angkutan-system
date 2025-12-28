-- Add odometer / hour meter and serial number fields for stock usage notes
-- Postgres SQL

BEGIN;

-- Add optional odometer & hour_meter on usage notes (nullable as requested)
ALTER TABLE stock_usage_notes
  ADD COLUMN IF NOT EXISTS odometer INTEGER NULL,
  ADD COLUMN IF NOT EXISTS hour_meter NUMERIC(10,2) NULL;

-- Add optional serial_number on usage note items (nullable as requested)
ALTER TABLE stock_usage_note_items
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100) NULL;

COMMIT;


