-- backend/migrations/init.sql

-- 1. Drop type enum jika pernah dibuat (opsional)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trip_status') THEN
    DROP TYPE trip_status;
  END IF;
END$$;

-- 2. Create custom enum type untuk status trip
CREATE TYPE trip_status AS ENUM (
  'on_progress',
  'otw',
  'perjalanan_pulang',
  'selesai'
);

-- 3. Table users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner','admin','driver')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Admin Profiles
CREATE TABLE IF NOT EXISTS admin_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Driver Profiles
CREATE TABLE IF NOT EXISTS driver_profiles (
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

-- 6. Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  license_plate VARCHAR(20) UNIQUE NOT NULL,
  type VARCHAR(50),
  capacity INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK(status IN ('available','in_use','maintenance')),
  last_service_date DATE,
  next_service_due DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Trips
CREATE TABLE IF NOT EXISTS trips (
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

-- 8. Driver Expenses
CREATE TABLE IF NOT EXISTS driver_expenses (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES users(id),
  jenis VARCHAR(50) NOT NULL,
  amount NUMERIC NOT NULL,
  receipt_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Office Expenses
CREATE TABLE IF NOT EXISTS office_expenses (
  id SERIAL PRIMARY KEY,
  kategori VARCHAR(50) NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  receipt_url TEXT,
  expense_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 10. Accounting Ritase
CREATE TABLE IF NOT EXISTS accounting_ritase (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  ritase NUMERIC NOT NULL,
  tarif NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- 11. Vehicle Service
CREATE TABLE IF NOT EXISTS vehicle_service (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id),
  service_date DATE NOT NULL,
  km_recorded INTEGER,
  service_type VARCHAR(50) NOT NULL,
  cost NUMERIC NOT NULL,
  note TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 12. Payment Terms
CREATE TABLE IF NOT EXISTS payment_terms (
  id SERIAL PRIMARY KEY,
  partner_name VARCHAR(100) NOT NULL,
  amount_due NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','overdue')),
  reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP
);
