-- 1. Users (existing)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner','admin','driver')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Admin Profiles (existing)
CREATE TABLE admin_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Driver Profiles (existing)
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
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Vehicles (updated with STNK & Tax)
CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  license_plate VARCHAR(20) UNIQUE NOT NULL,
  type VARCHAR(50),
  capacity INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK(status IN ('available','in_use','maintenance')),
  last_service_date DATE,
  next_service_due DATE,
  stnk_number VARCHAR(50) UNIQUE,
  stnk_expired_date DATE,
  tax_due_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Stock Categories
CREATE TABLE stock_categories (
  id SERIAL PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Stock Items
CREATE TABLE stock_items (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES stock_categories(id),
  item_name VARCHAR(100) NOT NULL,
  item_code VARCHAR(50) UNIQUE,
  unit VARCHAR(20) NOT NULL,
  current_stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  max_stock INTEGER,
  unit_price NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Stock Transactions
CREATE TABLE stock_transactions (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES stock_items(id),
  transaction_type VARCHAR(20) NOT NULL CHECK(transaction_type IN ('in','out','adjustment')),
  quantity INTEGER NOT NULL,
  reference_type VARCHAR(50), -- 'service', 'purchase', 'adjustment'
  reference_id INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Tire Inventory
CREATE TABLE tire_inventory (
  id SERIAL PRIMARY KEY,
  tire_brand VARCHAR(50) NOT NULL,
  tire_size VARCHAR(20) NOT NULL,
  tire_type VARCHAR(50),
  current_stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Vehicle Tires
CREATE TABLE vehicle_tires (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id),
  tire_id INTEGER REFERENCES tire_inventory(id),
  position VARCHAR(20) NOT NULL, -- 'front_left', 'front_right', 'rear_left', 'rear_right', 'spare'
  install_date DATE NOT NULL,
  mileage_installed INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active','removed','damaged')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 10. Tire Inspections
CREATE TABLE tire_inspections (
  id SERIAL PRIMARY KEY,
  vehicle_tire_id INTEGER REFERENCES vehicle_tires(id),
  inspection_date DATE NOT NULL,
  tread_depth NUMERIC(4,2), -- in mm
  air_pressure NUMERIC(5,2), -- in PSI
  condition VARCHAR(20) NOT NULL CHECK(condition IN ('good','fair','poor','replace')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 11. Trips (existing)
CREATE TYPE trip_status AS ENUM (
  'on_progress',
  'otw',
  'perjalanan_pulang',
  'selesai'
);

CREATE TABLE trips (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER REFERENCES users(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  drop_lat NUMERIC(9,6) NOT NULL,
  drop_lng NUMERIC(9,6) NOT NULL,
  ritase NUMERIC,
  tarif_per_ritase NUMERIC,
  total_ritase NUMERIC,
  status trip_status NOT NULL DEFAULT 'on_progress',
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  reached_at TIMESTAMP,
  returning_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- 12. Delivery Orders
CREATE TABLE delivery_orders (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER REFERENCES trips(id),
  do_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  total_amount NUMERIC NOT NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'proses_tagihan' 
    CHECK(payment_status IN ('lunas','deposit','proses_tagihan')),
  payment_type VARCHAR(20) CHECK(payment_type IN ('cash','transfer','deposit')),
  deposit_amount NUMERIC DEFAULT 0,
  invoice_amount NUMERIC,
  due_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 13. Payment Transactions
CREATE TABLE payment_transactions (
  id SERIAL PRIMARY KEY,
  do_id INTEGER REFERENCES delivery_orders(id),
  payment_type VARCHAR(20) NOT NULL CHECK(payment_type IN ('cash','transfer','deposit')),
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  reference_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 14. Cash Transactions
CREATE TABLE cash_transactions (
  id SERIAL PRIMARY KEY,
  transaction_type VARCHAR(20) NOT NULL CHECK(transaction_type IN ('income','expense')),
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL,
  reference_type VARCHAR(50), -- 'trip', 'expense', 'other'
  reference_id INTEGER,
  transaction_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 15. Vehicle Service (updated)
CREATE TABLE vehicle_service (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id),
  service_date DATE NOT NULL,
  km_recorded INTEGER,
  service_type VARCHAR(50) NOT NULL,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 16. Service Items
CREATE TABLE service_items (
  id SERIAL PRIMARY KEY,
  service_id INTEGER REFERENCES vehicle_service(id) ON DELETE CASCADE,
  item_name VARCHAR(100) NOT NULL,
  item_type VARCHAR(20) NOT NULL CHECK(item_type IN ('part','labor','other')),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  stock_item_id INTEGER REFERENCES stock_items(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 17. Driver Expenses (existing)
CREATE TABLE driver_expenses (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES users(id),
  jenis VARCHAR(50) NOT NULL,
  amount NUMERIC NOT NULL,
  receipt_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 18. Office Expenses (existing)
CREATE TABLE office_expenses (
  id SERIAL PRIMARY KEY,
  kategori VARCHAR(50) NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  receipt_url TEXT,
  expense_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 19. Accounting Ritase (existing)
CREATE TABLE accounting_ritase (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  ritase NUMERIC NOT NULL,
  tarif NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- 20. Payment Terms (existing)
CREATE TABLE payment_terms (
  id SERIAL PRIMARY KEY,
  partner_name VARCHAR(100) NOT NULL,
  amount_due NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','overdue')),
  reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_vehicles_tax_due ON vehicles(tax_due_date);
CREATE INDEX idx_vehicles_stnk_expired ON vehicles(stnk_expired_date);
CREATE INDEX idx_stock_items_low_stock ON stock_items(current_stock, min_stock);
CREATE INDEX idx_delivery_orders_status ON delivery_orders(payment_status);
CREATE INDEX idx_delivery_orders_due_date ON delivery_orders(due_date);
CREATE INDEX idx_tire_inspections_date ON tire_inspections(inspection_date);
CREATE INDEX idx_cash_transactions_date ON cash_transactions(transaction_date);
