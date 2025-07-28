-- backend/src/migrations/init.sql
-- BAGIAN 1: PENGGUNA & PROFIL
-- =================================================================

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner','admin','driver')),
  expo_push_token VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE admin_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE driver_status AS ENUM ('available', 'busy');
CREATE TABLE driver_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address TEXT NOT NULL,
  id_card_number VARCHAR(50) UNIQUE NOT NULL,
  sim_number VARCHAR(50) UNIQUE,
  license_type VARCHAR(10),
  status driver_status NOT NULL DEFAULT 'available',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- BAGIAN 2: MANAJEMEN ASET & INVENTARIS
-- =================================================================
CREATE TYPE vehicle_status AS ENUM ('available', 'in_use', 'maintenance');

CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  license_plate VARCHAR(20) UNIQUE NOT NULL,
  type VARCHAR(50),
  capacity VARCHAR(10),
  tire_count INTEGER NOT NULL DEFAULT 6,
  spare_tire_count INTEGER NOT NULL DEFAULT 2,
  driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status vehicle_status NOT NULL DEFAULT 'available',
  last_service_date DATE,
  next_service_due DATE,
  stnk_number VARCHAR(50) UNIQUE,
  stnk_expired_date DATE,
  tax_due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_mileage INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE tire_inventory (
  id SERIAL PRIMARY KEY,
  tire_brand VARCHAR(50) NOT NULL,
  tire_size VARCHAR(20) NOT NULL,
  tire_type VARCHAR(50),
  current_stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE tire_instances (
  id SERIAL PRIMARY KEY,
  tire_inventory_id INTEGER REFERENCES tire_inventory(id),
  tire_serial_number VARCHAR(50) UNIQUE,
  purchase_date DATE DEFAULT CURRENT_DATE,
  purchase_price NUMERIC(15,2),
  total_mileage INTEGER DEFAULT 0,
  current_tread_depth NUMERIC(4,2) DEFAULT 10.0,
  condition VARCHAR(20) DEFAULT 'new' CHECK (condition IN ('new', 'good', 'fair', 'poor', 'damaged', 'disposed', 'replace', 'meledak', 'bocor', 'kampasa')),
  status VARCHAR(20) DEFAULT 'in_stock' CHECK(status IN ('in_stock','installed','removed','disposed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE vehicle_tires (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  tire_inventory_id INTEGER REFERENCES tire_inventory(id), -- For backward compatibility & easy lookup
  tire_instance_id INTEGER NOT NULL REFERENCES tire_instances(id), -- Enforce instance tracking
  position VARCHAR(20) NOT NULL,
  install_date DATE NOT NULL DEFAULT CURRENT_DATE,
  remove_date DATE,
  mileage_installed INTEGER DEFAULT 0,
  mileage_removed INTEGER,
  current_pressure NUMERIC(5,2) DEFAULT 0,
  recommended_pressure NUMERIC(5,2) DEFAULT 35,
  tread_depth NUMERIC(4,2) DEFAULT 10.0,
  temperature NUMERIC(4,1) DEFAULT 25.0,
  condition VARCHAR(20) NOT NULL DEFAULT 'good'CHECK (condition IN ('new', 'good', 'fair', 'poor', 'damaged', 'disposed', 'replace', 'meledak', 'bocor', 'kampasa')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active','removed','damaged')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE tire_inspections (
  id SERIAL PRIMARY KEY,
  vehicle_tire_id INTEGER REFERENCES vehicle_tires(id) ON DELETE CASCADE,
  tire_instance_id INTEGER REFERENCES tire_instances(id), -- Direct reference to tire instance
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tread_depth NUMERIC(4,2),
  air_pressure NUMERIC(5,2),
  temperature NUMERIC(4,1),
  condition VARCHAR(20) NOT NULL CHECK (condition IN ('new', 'good', 'fair', 'poor', 'damaged', 'disposed', 'replace', 'meledak', 'bocor', 'kampasa')),
  notes TEXT,
  inspector_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE stock_categories (
    id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE stock_items (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES stock_categories(id),
    item_code VARCHAR(50) UNIQUE,
    item_name VARCHAR(255) NOT NULL,
    supplier VARCHAR(255),
    unit VARCHAR(20) NOT NULL DEFAULT 'Pcs',
    min_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
    average_unit_price NUMERIC(15,2) DEFAULT 0, -- Weighted average price
    total_value NUMERIC(15,2) DEFAULT 0, -- Total value of all batches
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE stock_batches (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES stock_items(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
    original_quantity NUMERIC(10,2) NOT NULL, -- Original quantity when batch was created
    unit_price NUMERIC(15,2) NOT NULL,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(item_id, batch_number)
);

CREATE TABLE stock_transactions (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES stock_items(id) ON DELETE CASCADE,
    batch_id INTEGER REFERENCES stock_batches(id) ON DELETE SET NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK(transaction_type IN ('in','out','adjustment')),
    quantity NUMERIC(10,2) NOT NULL,
    unit_price NUMERIC(15,2),
    total_amount NUMERIC(15,2),
    reference_type VARCHAR(50),
    reference_id INTEGER,
    supplier VARCHAR(255),
    notes TEXT,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE vehicle_services (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  service_number VARCHAR(50) UNIQUE NOT NULL,
  service_date DATE NOT NULL,
  service_type VARCHAR(20) NOT NULL CHECK(service_type IN ('regular', 'with_parts')) DEFAULT 'regular',
  description TEXT NOT NULL,
  workshop_name VARCHAR(255),
  labor_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  parts_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(15,2) GENERATED ALWAYS AS (labor_cost + parts_cost) STORED,
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK(status IN ('completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE service_items (
  id SERIAL PRIMARY KEY,
  service_id INTEGER REFERENCES vehicle_services(id) ON DELETE CASCADE,
  stock_item_id INTEGER REFERENCES stock_items(id),
  item_name VARCHAR(255) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(15,2) NOT NULL,
  total_price NUMERIC(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  from_stock BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_stock_consistency CHECK (
    (from_stock = false) OR (from_stock = true AND stock_item_id IS NOT NULL)
  )
);

-- BAGIAN 3: OPERASIONAL INTI (PO & DO)
-- =================================================================

-- Enhanced deposit groups system (from current)
CREATE TABLE deposit_groups (
    id SERIAL PRIMARY KEY,
    group_name VARCHAR(255) NOT NULL,
    balance NUMERIC(15,2) NOT NULL DEFAULT 0,
    target_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
    deposited_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    remaining_quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
    unit VARCHAR(10) NOT NULL DEFAULT 'ton' CHECK (unit IN ('kilogram', 'ton', 'kubik')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'overdrawn')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  item_name VARCHAR(255) NOT NULL,  -- Multiple items dipisah koma, e.g., "Pasir Silika, Batu Split"
  total_quantity NUMERIC(10, 2) NOT NULL,
  quantity_mutasi NUMERIC(10, 2)[] DEFAULT ARRAY[]::NUMERIC(10,2)[], -- Enhanced mutation tracking (from current)
  unit VARCHAR(10) DEFAULT 'ton' CHECK (unit IN ('kilogram', 'ton', 'kubik')),
  unit_price NUMERIC(15, 2), -- Unit price support
  total_amount NUMERIC(15, 2) DEFAULT 0,  -- Dinamis: sum dari DO
  load_location TEXT,
  unload_location TEXT,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  deposit_group_id INTEGER REFERENCES deposit_groups(id), -- Deposit group integration
  status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'partial', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TYPE delivery_status AS ENUM (
    'assigned',
    'otw_to_load_location',
    'at_load_location',
    'otw_to_unload_location',
    'at_unload_location',
    'otw_to_base',
    'completed',
    'cancelled'
);

CREATE TYPE big_do_status AS ENUM (
    'assigned',
    'in_progress', 
    'completed',
    'cancelled'
);

CREATE TYPE tambahan_status AS ENUM (
    'assigned',
    'picked_up',
    'in_transit',
    'delivered',
    'cancelled'
);

CREATE TYPE unit_type AS ENUM (
    'kilogram',
    'ton', 
    'kubik'
);

CREATE TABLE delivery_orders (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
  driver_id INTEGER REFERENCES users(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  do_name VARCHAR(100),
  do_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  item_name VARCHAR(100),
  
  minimal_load_quantity NUMERIC(10, 2) DEFAULT 0,
  actual_load_quantity NUMERIC(10, 2),

  unit VARCHAR(10) DEFAULT 'ton' CHECK (unit IN ('kilogram', 'ton', 'kubik')),
  unit_price NUMERIC,
  total_amount NUMERIC NOT NULL,
  trip_allowance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  gaji NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ongkosan NUMERIC(15, 2) DEFAULT 0,
  final_amount NUMERIC(15,2),
  is_amount_finalized BOOLEAN NOT NULL DEFAULT FALSE, -- Enhanced amount finalization (from current)
  
  load_location TEXT,
  load_latitude DECIMAL(10, 8),
  load_longitude DECIMAL(11, 8),
  unload_location TEXT,
  unload_latitude DECIMAL(10, 8),
  unload_longitude DECIMAL(11, 8),
  
  surat_jalan_photo_url TEXT[],

  payment_status VARCHAR(30) NOT NULL DEFAULT 'proses_tagihan' CHECK(payment_status IN ('awaiting_confirmation','lunas','deposit','proses_tagihan')),
  payment_type VARCHAR(20) CHECK(payment_type IN ('cash','transfer','deposit')),
  deposit_amount NUMERIC DEFAULT 0,
  invoice_amount NUMERIC,
  due_date DATE,
  payment_notes TEXT,
  
  status delivery_status NOT NULL DEFAULT 'assigned',
  payment_confirmation_status VARCHAR(30) DEFAULT 'pending' CHECK(payment_confirmation_status IN ('pending', 'awaiting_confirmation', 'confirmed')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  departed_to_load_location_at TIMESTAMP WITH TIME ZONE,
  arrived_at_load_location_at TIMESTAMP WITH TIME ZONE,
  departed_from_load_location_at TIMESTAMP WITH TIME ZONE,
  arrived_at_unload_location_at TIMESTAMP WITH TIME ZONE,
  departed_from_unload_location_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  payment_confirmation_at TIMESTAMP WITH TIME ZONE,
  payment_confirmed_by INTEGER REFERENCES users(id)
);

CREATE TABLE big_delivery_orders (
  id SERIAL PRIMARY KEY,
  main_delivery_order_id INTEGER NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  driver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, 
  big_do_number VARCHAR(50) UNIQUE NOT NULL,

  total_trip_allowance DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (total_trip_allowance >= 0),
  total_gaji DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (total_gaji >= 0),
  total_ongkosan DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (total_ongkosan >= 0),
  
  status big_do_status NOT NULL DEFAULT 'assigned',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  notes TEXT,
  cancellation_reason TEXT
);

CREATE TABLE big_do_tambahan (
  id SERIAL PRIMARY KEY,
  
  -- Foreign Key
  big_delivery_order_id INTEGER NOT NULL REFERENCES big_delivery_orders(id) ON DELETE CASCADE,
  
  -- Basic Info
  tambahan_number VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20),
  customer_address TEXT,
  item_name VARCHAR(255) NOT NULL,
  
  -- Quantity & Pricing
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
  unit unit_type NOT NULL DEFAULT 'ton',
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  total_amount DECIMAL(15,2) NOT NULL CHECK (total_amount >= 0),
  
  -- Locations
  pickup_location TEXT NOT NULL,
  pickup_latitude DECIMAL(10,8) CHECK (pickup_latitude BETWEEN -90 AND 90),
  pickup_longitude DECIMAL(11,8) CHECK (pickup_longitude BETWEEN -180 AND 180),
  delivery_location TEXT NOT NULL,
  delivery_latitude DECIMAL(10,8) CHECK (delivery_latitude BETWEEN -90 AND 90),
  delivery_longitude DECIMAL(11,8) CHECK (delivery_longitude BETWEEN -180 AND 180),
  
  -- Status & Documents
  status tambahan_status NOT NULL DEFAULT 'assigned',
  pickup_photo_url VARCHAR(500),
  delivery_photo_url VARCHAR(500),
  
  -- Timestamps
  picked_up_at TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Notes
  notes TEXT,
  
  -- Unique constraint for tambahan_number within Big DO
  CONSTRAINT unique_tambahan_number_per_big_do UNIQUE (big_delivery_order_id, tambahan_number)
);

CREATE TABLE big_do_status_history (
  id SERIAL PRIMARY KEY,
  big_delivery_order_id INTEGER NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  notes TEXT,
  changed_by INTEGER,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (big_delivery_order_id) REFERENCES big_delivery_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE big_do_tambahan_status_history (
  id SERIAL PRIMARY KEY,
  big_do_tambahan_id INTEGER NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  notes TEXT,
  changed_by INTEGER,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (big_do_tambahan_id) REFERENCES big_do_tambahan(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE deposit_group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES deposit_groups(id) ON DELETE CASCADE,
  quantity NUMERIC(15,2) NOT NULL DEFAULT 0, -- Enhanced quantity tracking (from current)
  delivery_order_id INTEGER NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (group_id, delivery_order_id) -- Prevent duplicate DO in same group
);

-- BAGIAN 4: KEUANGAN & BIAYA
-- =================================================================

CREATE TABLE driver_expenses (
  id SERIAL PRIMARY KEY,
  delivery_order_id INTEGER REFERENCES delivery_orders(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES users(id),
  jenis VARCHAR(50) NOT NULL,
  amount NUMERIC NOT NULL,
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE delivery_order_invoices (
  id SERIAL PRIMARY KEY,
  delivery_order_id INTEGER NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) NOT NULL UNIQUE,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_amount NUMERIC(15,2) NOT NULL,
  due_date DATE,
  pph_percentage NUMERIC(5,2) DEFAULT 0.5, -- Default 0.5%, but configurable
  pph_amount NUMERIC(15,2) DEFAULT 0,
  net_amount NUMERIC(15,2) NOT NULL, -- invoice_amount - pph_amount
  status VARCHAR(20) DEFAULT 'issued' CHECK(status IN ('issued', 'sent', 'paid', 'overdue', 'cancelled')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE office_expenses (
  id SERIAL PRIMARY KEY,
  kategori VARCHAR(50) NOT NULL,
  vehicle_id INTEGER REFERENCES vehicles(id),
  description TEXT,
  amount NUMERIC NOT NULL,
  receipt_url TEXT,
  expense_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE delivery_order_payments (
  id SERIAL PRIMARY KEY,
  delivery_order_id INTEGER NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  invoice_id INTEGER REFERENCES delivery_order_invoices(id) ON DELETE SET NULL,
  payment_reference VARCHAR(100), -- Bank reference, check number, etc.
  payment_type VARCHAR(20) NOT NULL CHECK(payment_type IN ('cash', 'transfer', 'check', 'giro')),
  payment_amount NUMERIC(15,2) NOT NULL CHECK(payment_amount > 0),
  payment_date DATE NOT NULL,
  received_by INTEGER REFERENCES users(id), -- Who processed the payment
  bank_account VARCHAR(100), -- If transfer
  notes TEXT,
  attachment_urls TEXT[], -- Receipt/proof of payment
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE cash_categories (
  id SERIAL PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL,
  category_type VARCHAR(20) NOT NULL CHECK(category_type IN ('income','expense')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE cash_transactions (
  id SERIAL PRIMARY KEY,
  transaction_type VARCHAR(20) NOT NULL CHECK(transaction_type IN ('debit','kredit', 'debit_tempo', 'kredit_tempo')),
  category_id INTEGER REFERENCES cash_categories(id),
  amount NUMERIC(15,2) NOT NULL,
  description TEXT NOT NULL,
  reference_number VARCHAR(50),
  account VARCHAR(20) NOT NULL, -- Enhanced flexibility: removed CHECK constraint (from current)
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  attachment_urls TEXT[], -- Photo attachments
  no_nota TEXT[], -- Enhanced nota tracking (from current)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE payment_terms (
  id SERIAL PRIMARY KEY,
  partner_name VARCHAR(100) NOT NULL,
  amount_due NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','overdue')),
  reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE delivery_order_adjustments (
  id SERIAL PRIMARY KEY,
  delivery_order_id INTEGER NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  adjustment_type VARCHAR(30) NOT NULL CHECK(adjustment_type IN ('price_override', 'uj_tambahan', 'penalty', 'bonus', 'incident', 'excess_quantity')),
  original_amount NUMERIC(15,2),
  adjustment_amount NUMERIC(15,2) NOT NULL,
  final_amount NUMERIC(15,2) NOT NULL,
  reason TEXT NOT NULL,
  approved_by INTEGER REFERENCES users(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE delivery_order_payment_history (
  id SERIAL PRIMARY KEY,
  delivery_order_id INTEGER NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  old_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL,
  change_reason TEXT,
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  data_type VARCHAR(20) DEFAULT 'string' CHECK(data_type IN ('string', 'number', 'boolean', 'json')),
  description TEXT,
  is_editable BOOLEAN DEFAULT true,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO system_settings (setting_key, setting_value, data_type, description) VALUES
('default_pph_percentage', '0.5', 'number', 'Default PPH percentage for invoices'),
('payment_due_days', '30', 'number', 'Default payment due days from invoice date'),
('auto_confirm_completed_do', 'false', 'boolean', 'Auto confirm DO for payment when status becomes completed');

-- BAGIAN 5: INDEKS UNTUK PERFORMA
-- =================================================================

CREATE INDEX idx_vehicles_tax_due ON vehicles(tax_due_date);
CREATE INDEX idx_vehicles_stnk_expired ON vehicles(stnk_expired_date);
CREATE INDEX idx_vehicles_driver_id ON vehicles(driver_id);
CREATE INDEX idx_vehicles_tire_count ON vehicles(tire_count);
CREATE INDEX idx_stock_items_category ON stock_items(category_id);
CREATE INDEX idx_stock_batches_item_id ON stock_batches(item_id);
CREATE INDEX idx_stock_batches_purchase_date ON stock_batches(purchase_date);
CREATE INDEX idx_stock_transactions_batch_id ON stock_transactions(batch_id);
CREATE INDEX idx_stock_items_min_stock ON stock_items(min_stock);
CREATE INDEX idx_stock_batches_quantity ON stock_batches(quantity);
CREATE INDEX idx_stock_batches_item_quantity ON stock_batches(item_id, quantity);
CREATE INDEX idx_stock_transactions_item ON stock_transactions(item_id);
CREATE INDEX idx_stock_transactions_date ON stock_transactions(transaction_date);
CREATE INDEX idx_vehicle_services_vehicle ON vehicle_services(vehicle_id);
CREATE INDEX idx_vehicle_services_date ON vehicle_services(service_date);
CREATE INDEX idx_service_items_service ON service_items(service_id);
CREATE INDEX idx_service_items_stock ON service_items(stock_item_id);
CREATE INDEX idx_vehicle_tires_vehicle_id ON vehicle_tires(vehicle_id);
CREATE INDEX idx_vehicle_tires_position ON vehicle_tires(position);
CREATE INDEX idx_vehicle_tires_instance ON vehicle_tires(tire_instance_id);
CREATE INDEX idx_tire_instances_inventory ON tire_instances(tire_inventory_id);
CREATE INDEX idx_tire_instances_status ON tire_instances(status);
CREATE INDEX idx_tire_instances_serial ON tire_instances(tire_serial_number);
CREATE INDEX idx_tire_inspections_vehicle_tire_id ON tire_inspections(vehicle_tire_id);
CREATE INDEX idx_tire_inspections_instance ON tire_inspections(tire_instance_id);
CREATE INDEX idx_tire_inspections_date ON tire_inspections(inspection_date);
CREATE INDEX idx_purchase_orders_unit ON purchase_orders(unit);
CREATE INDEX idx_delivery_orders_unit ON delivery_orders(unit);
CREATE INDEX idx_delivery_orders_status ON delivery_orders(payment_status);
CREATE INDEX idx_delivery_orders_po_id ON delivery_orders(purchase_order_id);
CREATE INDEX idx_delivery_orders_due_date ON delivery_orders(due_date);
CREATE INDEX idx_cash_transactions_date ON cash_transactions(transaction_date DESC);
CREATE INDEX idx_cash_transactions_type ON cash_transactions(transaction_type);
CREATE INDEX idx_cash_transactions_category ON cash_transactions(category_id);
CREATE INDEX idx_cash_transactions_created_at ON cash_transactions(created_at DESC);
CREATE UNIQUE INDEX idx_active_delivery_orders_per_driver_id ON delivery_orders(driver_id) WHERE status IN ('assigned', 'otw_to_load_location', 'at_load_location', 'otw_to_unload_location', 'at_unload_location', 'otw_to_base');
CREATE UNIQUE INDEX idx_active_delivery_orders_per_vehicle ON delivery_orders(vehicle_id) WHERE status IN ('assigned', 'otw_to_load_location', 'at_load_location', 'otw_to_unload_location', 'at_unload_location', 'otw_to_base');
CREATE INDEX idx_delivery_order_invoices_do_id ON delivery_order_invoices(delivery_order_id);
CREATE INDEX idx_delivery_order_invoices_status ON delivery_order_invoices(status);
CREATE INDEX idx_delivery_order_invoices_due_date ON delivery_order_invoices(due_date);
CREATE INDEX idx_delivery_order_payments_do_id ON delivery_order_payments(delivery_order_id);
CREATE INDEX idx_delivery_order_payments_date ON delivery_order_payments(payment_date);
CREATE INDEX idx_delivery_order_payments_type ON delivery_order_payments(payment_type);
CREATE INDEX idx_big_do_main_do ON big_delivery_orders(main_delivery_order_id);
CREATE INDEX idx_big_do_driver ON big_delivery_orders(driver_id);
CREATE INDEX idx_big_do_vehicle ON big_delivery_orders(vehicle_id);
CREATE INDEX idx_big_do_status ON big_delivery_orders(status);
CREATE INDEX idx_big_do_created_by ON big_delivery_orders(created_by);
CREATE INDEX idx_tambahan_big_do ON big_do_tambahan(big_delivery_order_id);
CREATE INDEX idx_tambahan_status ON big_do_tambahan(status);
CREATE INDEX idx_tambahan_customer ON big_do_tambahan(customer_name);
CREATE INDEX idx_big_do_history_big_do ON big_do_status_history(big_delivery_order_id);
CREATE INDEX idx_big_do_history_date ON big_do_status_history(changed_at);
CREATE INDEX idx_tambahan_history_tambahan ON big_do_tambahan_status_history(big_do_tambahan_id);
CREATE INDEX idx_tambahan_history_date ON big_do_tambahan_status_history(changed_at);
CREATE INDEX idx_do_payment_history_do_id ON delivery_order_payment_history(delivery_order_id);
CREATE INDEX idx_do_payment_history_date ON delivery_order_payment_history(changed_at);
CREATE INDEX idx_do_adjustments_do_id ON delivery_order_adjustments(delivery_order_id);
CREATE INDEX idx_do_adjustments_type ON delivery_order_adjustments(adjustment_type);
CREATE INDEX idx_purchase_orders_deposit_group ON purchase_orders(deposit_group_id); -- Enhanced indexing (from current)

-- BAGIAN 6: TRIGGERS & FUNCTIONS
-- =================================================================

-- Function untuk update payment status berdasarkan total payments
CREATE OR REPLACE FUNCTION update_delivery_order_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  total_paid NUMERIC(15,2);
  billed_amount NUMERIC(15,2);
  pph_amount_val NUMERIC(15,2);
  net_billed NUMERIC(15,2);
BEGIN
  -- Hitung total pembayaran untuk DO ini
  SELECT COALESCE(SUM(payment_amount), 0) INTO total_paid 
  FROM delivery_order_payments WHERE delivery_order_id = NEW.delivery_order_id;

  -- Ambil data dari DO dan invoice untuk kalkulasi net billed
  SELECT (d.actual_load_quantity * d.unit_price), COALESCE(i.pph_amount, 0) 
  INTO billed_amount, pph_amount_val
  FROM delivery_orders d
  LEFT JOIN delivery_order_invoices i ON i.delivery_order_id = d.id
  WHERE d.id = NEW.delivery_order_id
  LIMIT 1;

  net_billed := billed_amount - pph_amount_val;

  RAISE NOTICE 'Calc for DO %: paid % vs net billed % (gross: %, pph: %)', 
    NEW.delivery_order_id, total_paid, net_billed, billed_amount, pph_amount_val;

  -- Update payment_status only (do not touch payment_confirmation_status)
  IF total_paid + 0.01 >= net_billed THEN  -- Tolerance for rounding
    UPDATE delivery_orders SET payment_status = 'lunas' WHERE id = NEW.delivery_order_id;
  ELSIF total_paid > 0 THEN
    UPDATE delivery_orders SET payment_status = 'proses_tagihan' WHERE id = NEW.delivery_order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_status
  AFTER INSERT OR UPDATE ON delivery_order_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_order_payment_status();

-- Function untuk auto-set payment confirmation ketika DO completed
CREATE OR REPLACE FUNCTION auto_set_payment_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only when status changes to 'completed'
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    NEW.payment_status := 'awaiting_confirmation';
    NEW.payment_confirmation_status := 'awaiting_confirmation';
    NEW.final_amount := NEW.ongkosan; -- Set final amount to original ongkosan
    
    -- Insert to payment history
    INSERT INTO delivery_order_payment_history 
    (delivery_order_id, old_status, new_status, change_reason, changed_at)
    VALUES 
    (NEW.id, OLD.payment_status, 'awaiting_confirmation', 'DO completed - ready for payment confirmation', NOW());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_payment_confirmation
  BEFORE UPDATE ON delivery_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_payment_confirmation();

-- Prevent confirmation change after payment
CREATE OR REPLACE FUNCTION prevent_confirmation_change_after_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.payment_confirmation_status != NEW.payment_confirmation_status AND
     (SELECT COUNT(*) FROM delivery_order_payments WHERE delivery_order_id = NEW.id) > 0 THEN
    RAISE EXCEPTION 'Cannot change payment_confirmation_status after payments are recorded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_confirmation_change
BEFORE UPDATE ON delivery_orders
FOR EACH ROW EXECUTE FUNCTION prevent_confirmation_change_after_payment();

-- Auto-recalculate PPH for invoices
CREATE OR REPLACE FUNCTION recalc_do_invoice_pph()
RETURNS TRIGGER AS $$
BEGIN
  -- default kalau NULL
  IF NEW.pph_percentage IS NULL THEN
    NEW.pph_percentage := 0.5;
  END IF;

  NEW.pph_amount := ROUND(NEW.invoice_amount * NEW.pph_percentage / 100, 2);
  NEW.net_amount := NEW.invoice_amount - NEW.pph_amount;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalc_pph
BEFORE INSERT OR UPDATE ON delivery_order_invoices
FOR EACH ROW
EXECUTE FUNCTION recalc_do_invoice_pph();

-- Auto-update PO total_amount and status based on DOs
CREATE OR REPLACE FUNCTION update_po_total_amount()
RETURNS TRIGGER AS $$
DECLARE
  fulfilled_qty NUMERIC := 0;  -- Sum of actual_load_quantity for completed DOs
  pending_qty NUMERIC := 0;    -- Sum of minimal_load_quantity for pending DOs
  total_amount_sum NUMERIC := 0;  -- Sum of (qty * price) for all non-cancelled DOs
BEGIN
  -- Sum quantities for status
  SELECT 
    COALESCE(SUM(CASE WHEN d.status = 'completed' THEN d.actual_load_quantity ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN d.status != 'completed' AND d.status != 'cancelled' THEN d.minimal_load_quantity ELSE 0 END), 0)
  INTO fulfilled_qty, pending_qty
  FROM delivery_orders d 
  WHERE d.purchase_order_id = NEW.purchase_order_id;

  -- Sum monetary amounts separately for total_amount forecast
  SELECT 
    COALESCE(
      SUM(CASE 
        WHEN d.status = 'completed' THEN d.actual_load_quantity * d.unit_price 
        ELSE d.minimal_load_quantity * d.unit_price 
      END), 0
    )
  INTO total_amount_sum
  FROM delivery_orders d 
  WHERE d.purchase_order_id = NEW.purchase_order_id 
    AND d.status != 'cancelled';

  -- Update PO total_amount (monetary forecast)
  UPDATE purchase_orders po
  SET total_amount = total_amount_sum
  WHERE po.id = NEW.purchase_order_id;

  -- Update PO status based on quantities (with tiny tolerance for float rounding)
  UPDATE purchase_orders po
  SET status = 
    CASE
      WHEN fulfilled_qty + 0.01 >= po.total_quantity THEN 'completed'  -- Actual delivered meets/exceeds total
      WHEN fulfilled_qty > 0 OR pending_qty > 0 THEN 'partial'         -- Some progress or pending
      ELSE 'confirmed'                                                 -- Nothing started
    END
  WHERE po.id = NEW.purchase_order_id AND po.status != 'cancelled';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_po_total_after_do
AFTER INSERT OR UPDATE ON delivery_orders
FOR EACH ROW EXECUTE FUNCTION update_po_total_amount();
