-- Recap tables for grouping multi-transaction notes and payments
-- Postgres SQL

BEGIN;

-- recap_notes
CREATE TABLE IF NOT EXISTS recap_notes (
  id SERIAL PRIMARY KEY,
  recap_number VARCHAR(50) UNIQUE NOT NULL,
  recap_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_mode VARCHAR(10) NOT NULL CHECK (payment_mode IN ('cash','tempo')),
  supplier VARCHAR(255),
  vehicle_id INTEGER,
  notes TEXT,
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','partial','paid')),
  due_date DATE,
  created_by INTEGER,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recap_notes_number ON recap_notes (recap_number);
CREATE INDEX IF NOT EXISTS idx_recap_notes_date ON recap_notes (recap_date);
CREATE INDEX IF NOT EXISTS idx_recap_notes_status ON recap_notes (status);

-- recap_note_items
-- NOTE: base schema (init.sql) and Sequelize model use column name "type", not "item_type"
CREATE TABLE IF NOT EXISTS recap_note_items (
  id SERIAL PRIMARY KEY,
  recap_id INTEGER NOT NULL REFERENCES recap_notes(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('service','stock','stock_usage','cash','tire_purchase')),
  reference_id INTEGER,
  description TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recap_items_recap_id ON recap_note_items (recap_id);
CREATE INDEX IF NOT EXISTS idx_recap_items_type ON recap_note_items (type);

COMMIT;



-- Ensure stock usage note tables exist (idempotent)
BEGIN;
CREATE TABLE IF NOT EXISTS stock_usage_notes (
  id SERIAL PRIMARY KEY,
  note_number VARCHAR(50) UNIQUE NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  notes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_usage_note_items (
  id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES stock_usage_notes(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES stock_items(id),
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  from_stock BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
COMMIT;