
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
  item_name VARCHAR(100) NOT NULL,
  item_code VARCHAR(50) UNIQUE,
  unit VARCHAR(20) NOT NULL,
  current_stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  max_stock INTEGER,
  unit_price NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE tire_inventory (
  id SERIAL PRIMARY KEY,
  tire_brand VARCHAR(50) NOT NULL,
  tire_size VARCHAR(20) NOT NULL,
  tire_type VARCHAR(50),
  current_stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- BAGIAN 3: OPERASIONAL INTI (PO & DO) -- INI ADALAH PERUBAHAN UTAMA
-- =================================================================

-- TABEL BARU: Purchase Orders sebagai induk dari beberapa pengiriman
CREATE TABLE purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  order_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TIPE BARU: Status untuk setiap Delivery Order (Ritase)
CREATE TYPE delivery_status AS ENUM (
    'assigned',
    'otw_to_destination',
    'at_destination',
    'otw_to_base',
    'completed',
    'cancelled'
);

-- MODIFIKASI: Delivery Orders sekarang menjadi anak dari Purchase Orders
CREATE TABLE delivery_orders (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
  driver_id INTEGER REFERENCES users(id),
  vehicle_id INTEGER REFERENCES vehicles(id),
  do_number VARCHAR(50) UNIQUE NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  item_name VARCHAR(100),
  quantity NUMERIC,s
  unit_price NUMERIC,
  total_amount NUMERIC NOT NULL,
  load_location TEXT,
  unload_location TEXT,
  surat_jalan_url VARCHAR(255),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'proses_tagihan' 
    CHECK(payment_status IN ('lunas','deposit','proses_tagihan')),
  payment_type VARCHAR(20) CHECK(payment_type IN ('cash','transfer','deposit')),
  deposit_amount NUMERIC DEFAULT 0,
  invoice_amount NUMERIC,
  due_date DATE,
  status delivery_status NOT NULL DEFAULT 'assigned',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  reached_destination_at TIMESTAMP WITH TIME ZONE,
  started_return_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- BAGIAN 4: KEUANGAN & BIAYA (DISESUAIKAN DENGAN DO)
-- =================================================================

-- MODIFIKASI: Driver Expenses sekarang terhubung ke Delivery Order
CREATE TABLE driver_expenses (
  id SERIAL PRIMARY KEY,
  delivery_order_id INTEGER REFERENCES delivery_orders(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES users(id),
  jenis VARCHAR(50) NOT NULL,
  amount NUMERIC NOT NULL,
  notes TEXT, -- <-- ADD THIS LINE
  receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MODIFIKASI: Accounting Ritase sekarang terhubung ke Delivery Order
CREATE TABLE accounting_ritase (
  id SERIAL PRIMARY KEY,
  delivery_order_id INTEGER REFERENCES delivery_orders(id) ON DELETE CASCADE,
  ritase NUMERIC NOT NULL,
  tarif NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
  reference_type VARCHAR(50), -- 'delivery_order', 'office_expense', 'other'
  reference_id INTEGER,
  transaction_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- BAGIAN 5: PEMELIHARAAN & LOGGING
-- =================================================================

CREATE TABLE vehicle_services (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  description TEXT NOT NULL,
  cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
  workshop_name VARCHAR(255),
  CONSTRAINT fk_vehicle
    FOREIGN KEY(vehicle_id) 
    REFERENCES vehicles(id)
    ON DELETE CASCADE
);

CREATE TABLE service_items (
  id SERIAL PRIMARY KEY,
  service_id INTEGER REFERENCES vehicle_services(id) ON DELETE CASCADE,
  item_name VARCHAR(100) NOT NULL,
  item_type VARCHAR(20) NOT NULL CHECK(item_type IN ('part','labor','other')),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  stock_item_id INTEGER REFERENCES stock_items(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE stock_transactions (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES stock_items(id),
  transaction_type VARCHAR(20) NOT NULL CHECK(transaction_type IN ('in','out','adjustment')),
  quantity INTEGER NOT NULL,
  reference_type VARCHAR(50), -- 'service', 'purchase', 'adjustment'
  reference_id INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE vehicle_tires (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id),
  tire_id INTEGER REFERENCES tire_inventory(id),
  position VARCHAR(20) NOT NULL,
  install_date DATE NOT NULL,
  mileage_installed INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active','removed','damaged')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE tire_inspections (
  id SERIAL PRIMARY KEY,
  vehicle_tire_id INTEGER REFERENCES vehicle_tires(id),
  inspection_date DATE NOT NULL,
  tread_depth NUMERIC(4,2),
  air_pressure NUMERIC(5,2),
  condition VARCHAR(20) NOT NULL CHECK(condition IN ('good','fair','poor','replace')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- BAGIAN 6: INDEKS UNTUK PERFORMA
-- =================================================================

CREATE INDEX idx_vehicles_tax_due ON vehicles(tax_due_date);
CREATE INDEX idx_vehicles_stnk_expired ON vehicles(stnk_expired_date);
CREATE INDEX idx_stock_items_low_stock ON stock_items(current_stock, min_stock);
CREATE INDEX idx_delivery_orders_po_id ON delivery_orders(purchase_order_id);
CREATE INDEX idx_delivery_orders_driver_id ON delivery_orders(driver_id);
CREATE INDEX idx_delivery_orders_status ON delivery_orders(payment_status);
CREATE INDEX idx_delivery_orders_due_date ON delivery_orders(due_date);
CREATE INDEX idx_tire_inspections_date ON tire_inspections(inspection_date);
CREATE INDEX idx_cash_transactions_date ON cash_transactions(transaction_date);