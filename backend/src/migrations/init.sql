-- backend/src/migrations/init.sql
-- BAGIAN 1: PENGGUNA & PROFIL
-- =================================================================

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner','admin','driver')),
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

CREATE TABLE driver_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address TEXT NOT NULL,
  id_card_number VARCHAR(50) UNIQUE NOT NULL,
  sim_number VARCHAR(50) UNIQUE,
  license_type VARCHAR(10),
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK(status IN ('available','busy')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- BAGIAN 2: MANAJEMEN ASET & INVENTARIS
-- =================================================================

-- UPDATED VEHICLES TABLE WITH TIRE CONFIGURATION
CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  license_plate VARCHAR(20) UNIQUE NOT NULL,
  type VARCHAR(50),
  capacity VARCHAR(10),
  tire_count INTEGER NOT NULL DEFAULT 6,
  spare_tire_count INTEGER NOT NULL DEFAULT 2,
  driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK(status IN ('available','in_use','maintenance')),
  last_service_date DATE,
  next_service_due DATE,
  stnk_number VARCHAR(50) UNIQUE,
  stnk_expired_date DATE,
  tax_due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TIRE MANAGEMENT TABLES (UPDATED WITH INDIVIDUAL TIRE TRACKING)
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

-- NEW: Individual tire instances for complete tracking
CREATE TABLE tire_instances (
  id SERIAL PRIMARY KEY,
  tire_inventory_id INTEGER REFERENCES tire_inventory(id),
  tire_serial_number VARCHAR(50) UNIQUE,
  purchase_date DATE DEFAULT CURRENT_DATE,
  purchase_price NUMERIC(15,2),
  total_mileage INTEGER DEFAULT 0,
  current_tread_depth NUMERIC(4,2) DEFAULT 10.0,
  condition VARCHAR(20) DEFAULT 'new' CHECK(condition IN ('new','good','fair','poor','damaged','disposed')),
  status VARCHAR(20) DEFAULT 'in_stock' CHECK(status IN ('in_stock','installed','removed','disposed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- UPDATED: Vehicle tires now reference individual tire instances
CREATE TABLE vehicle_tires (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  tire_inventory_id INTEGER REFERENCES tire_inventory(id), -- For backward compatibility
  tire_instance_id INTEGER REFERENCES tire_instances(id), -- NEW: Reference to specific tire
  position VARCHAR(20) NOT NULL,
  install_date DATE NOT NULL DEFAULT CURRENT_DATE,
  remove_date DATE,
  mileage_installed INTEGER DEFAULT 0,
  mileage_removed INTEGER,
  current_pressure NUMERIC(5,2) DEFAULT 0,
  recommended_pressure NUMERIC(5,2) DEFAULT 35,
  tread_depth NUMERIC(4,2) DEFAULT 10.0,
  temperature NUMERIC(4,1) DEFAULT 25.0,
  condition VARCHAR(20) NOT NULL DEFAULT 'good' CHECK(condition IN ('good','fair','poor','replace')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active','removed','damaged')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE tire_inspections (
  id SERIAL PRIMARY KEY,
  vehicle_tire_id INTEGER REFERENCES vehicle_tires(id) ON DELETE CASCADE,
  tire_instance_id INTEGER REFERENCES tire_instances(id), -- NEW: Direct reference to tire instance
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tread_depth NUMERIC(4,2),
  air_pressure NUMERIC(5,2),
  temperature NUMERIC(4,1),
  condition VARCHAR(20) NOT NULL CHECK(condition IN ('good','fair','poor','replace')),
  notes TEXT,
  inspector_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STOCK MANAGEMENT TABLES
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
  current_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(15,2) DEFAULT 0,
  total_value NUMERIC(15,2) GENERATED ALWAYS AS (current_stock * unit_price) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE stock_transactions (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES stock_items(id) ON DELETE CASCADE,
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

-- VEHICLE SERVICES TABLE
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

CREATE TABLE purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  total_quantity NUMERIC(10, 2) NOT NULL,
  unit_price NUMERIC(15, 2),
  total_amount NUMERIC(15, 2),
  load_location TEXT,
  unload_location TEXT,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
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

CREATE TABLE delivery_orders (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
  driver_id INTEGER REFERENCES users(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  
  do_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  item_name VARCHAR(100),
  
  minimal_load_quantity NUMERIC(10, 2) DEFAULT 0,
  actual_load_quantity NUMERIC(10, 2),

  unit_price NUMERIC,
  total_amount NUMERIC NOT NULL,
  trip_allowance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  gaji NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ongkosan NUMERIC(15, 2) DEFAULT 0,
  
  load_location TEXT,
  load_latitude DECIMAL(10, 8),
  load_longitude DECIMAL(11, 8),
  unload_location TEXT,
  unload_latitude DECIMAL(10, 8),
  unload_longitude DECIMAL(11, 8),
  
  surat_jalan_photo_url VARCHAR(255),

  payment_status VARCHAR(20) NOT NULL DEFAULT 'proses_tagihan' 
    CHECK(payment_status IN ('lunas','deposit','proses_tagihan')),
  payment_type VARCHAR(20) CHECK(payment_type IN ('cash','transfer','deposit')),
  deposit_amount NUMERIC DEFAULT 0,
  invoice_amount NUMERIC,
  due_date DATE,

  status delivery_status NOT NULL DEFAULT 'assigned',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  departed_to_load_location_at TIMESTAMP WITH TIME ZONE,
  arrived_at_load_location_at TIMESTAMP WITH TIME ZONE,
  departed_from_load_location_at TIMESTAMP WITH TIME ZONE,
  arrived_at_unload_location_at TIMESTAMP WITH TIME ZONE,
  departed_from_unload_location_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
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

CREATE TABLE accounting_ritase (
  id SERIAL PRIMARY KEY,
  delivery_order_id INTEGER REFERENCES delivery_orders(id) ON DELETE CASCADE,
  ritase NUMERIC NOT NULL,
  tarif NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE office_expenses (
  id SERIAL PRIMARY KEY,
  kategori VARCHAR(50) NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  receipt_url TEXT,
  expense_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE payment_transactions (
  id SERIAL PRIMARY KEY,
  do_id INTEGER REFERENCES delivery_orders(id),
  payment_type VARCHAR(20) NOT NULL CHECK(payment_type IN ('cash','transfer','deposit')),
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  reference_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE cash_transactions (
  id SERIAL PRIMARY KEY,
  transaction_type VARCHAR(20) NOT NULL CHECK(transaction_type IN ('income','expense')),
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL,
  reference_type VARCHAR(50),
  reference_id INTEGER,
  transaction_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- BAGIAN 5: INDEKS UNTUK PERFORMA
-- =================================================================

CREATE INDEX idx_vehicles_tax_due ON vehicles(tax_due_date);
CREATE INDEX idx_vehicles_stnk_expired ON vehicles(stnk_expired_date);
CREATE INDEX idx_vehicles_driver_id ON vehicles(driver_id);
CREATE INDEX idx_vehicles_tire_count ON vehicles(tire_count);
CREATE INDEX idx_stock_items_category ON stock_items(category_id);
CREATE INDEX idx_stock_items_low_stock ON stock_items(current_stock, min_stock);
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
CREATE INDEX idx_cash_transactions_date ON cash_transactions(transaction_date);
CREATE INDEX idx_delivery_orders_status ON delivery_orders(payment_status);
CREATE INDEX idx_delivery_orders_po_id ON delivery_orders(purchase_order_id);
CREATE INDEX idx_delivery_orders_due_date ON delivery_orders(due_date);
CREATE UNIQUE INDEX idx_active_delivery_orders_per_driver_id ON delivery_orders(driver_id) WHERE status IN ('assigned', 'otw_to_load_location', 'at_load_location', 'otw_to_unload_location', 'at_unload_location', 'otw_to_base');
CREATE UNIQUE INDEX idx_active_delivery_orders_per_vehicle ON delivery_orders(vehicle_id) WHERE status IN ('assigned', 'otw_to_load_location', 'at_load_location', 'otw_to_unload_location', 'at_unload_location', 'otw_to_base');
