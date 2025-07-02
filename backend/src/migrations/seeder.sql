-- =================================================================
-- SEED DATA LENGKAP (ANGKUTAN) - WITH INDIVIDUAL TIRE TRACKING
-- =================================================================

-- 1. USERS & PROFILES
INSERT INTO users (username, password_hash, role) VALUES
('admin_satu', 'awak1234', 'admin'),
('supir_andi', 'awak1234', 'driver'),
('supir_budi', 'awak1234', 'driver'),
('supir_yoyo', 'awak1234', 'driver'),
('supir_charlie', 'awak1234', 'driver'),
('supir_dedi', 'awak1234', 'driver'),
('supir_eko', 'awak1234', 'driver');

INSERT INTO admin_profiles (user_id, full_name, phone, email) VALUES
((SELECT id FROM users WHERE username = 'admin_satu'), 'Admin Satu', '081234567890', 'admin1@perusahaan.com');

INSERT INTO driver_profiles (user_id, full_name, phone, address, id_card_number, sim_number, license_type, status) VALUES
((SELECT id FROM users WHERE username = 'supir_andi'), 'Andi Setiawan', '081111111111', 'Jl. Merdeka 1', '3201111111110001', '1111-1111-111111', 'B2 Umum', 'busy'),
((SELECT id FROM users WHERE username = 'supir_budi'), 'Budi Santoso', '082222222222', 'Jl. Kemerdekaan 2', '3201222222220002', '2222-2222-222222', 'B2 Umum', 'busy'),
((SELECT id FROM users WHERE username = 'supir_charlie'), 'Charlie Wijaya', '083333333333', 'Jl. Persatuan 3', '3201333333330003', '3333-3333-333333', 'B1', 'busy'),
((SELECT id FROM users WHERE username = 'supir_dedi'), 'Dedi Gunawan', '084444444444', 'Jl. Pahlawan 4', '3201444444440004', '4444-4444-444444', 'B1', 'available'),
((SELECT id FROM users WHERE username = 'supir_eko'), 'Eko Prasetyo', '085555555555', 'Jl. Kemakmuran 5', '3201555555550005', '5555-5555-555555', 'B2 Umum', 'busy'),
((SELECT id FROM users WHERE username = 'supir_yoyo'), 'Yoyo Karyo', '08101010101010', 'Jl. Ikan Sebelah no 22', '320994488009921', '5555-3344-123', 'B1', 'busy');

-- 2. STOCK CATEGORIES
INSERT INTO stock_categories (category_name, description) VALUES
('Oli & Pelumas', 'Oli mesin, oli transmisi, dan pelumas lainnya'),
('Filter', 'Filter oli, filter solar, filter udara'),
('Spare Parts', 'Suku cadang kendaraan'),
('Bahan Bakar & Aditif', 'Solar, bensin, dan aditif'),
('Sistem Rem', 'Kampas rem, minyak rem, dan komponen rem lainnya'),
('Ban & Velg', 'Ban, velg, dan aksesoris roda');

-- 3. STOCK ITEMS
INSERT INTO stock_items (category_id, item_code, item_name, supplier, unit, current_stock, min_stock, unit_price, notes) VALUES
-- Oli & Pelumas
((SELECT id FROM stock_categories WHERE category_name = 'Oli & Pelumas'), 'OLI-001', 'Oli Mesin Meditran SX SAE 15W-40', 'PT Pertamina Lubricants', 'Liter', 132.00, 20, 55000, 'Oli mesin untuk truck diesel'),
((SELECT id FROM stock_categories WHERE category_name = 'Oli & Pelumas'), 'OLI-002', 'Oli Transmisi ATF Dexron III', 'PT Shell Indonesia', 'Liter', 25.00, 10, 75000, 'Oli transmisi otomatis'),

-- Filter
((SELECT id FROM stock_categories WHERE category_name = 'Filter'), 'FLT-001', 'Filter Solar Hino Dutro', 'Hino Motors', 'Pcs', 19.00, 5, 120000, 'Filter solar original Hino'),
((SELECT id FROM stock_categories WHERE category_name = 'Filter'), 'FLT-002', 'Filter Oli Mitsubishi Fuso', 'Mitsubishi Motors', 'Pcs', 14.00, 5, 95000, 'Filter oli original Mitsubishi'),
((SELECT id FROM stock_categories WHERE category_name = 'Filter'), 'FLT-003', 'Filter Udara Universal', 'Mann Filter', 'Pcs', 12.00, 3, 150000, 'Filter udara untuk berbagai jenis truck'),

-- Bahan Bakar & Aditif
((SELECT id FROM stock_categories WHERE category_name = 'Bahan Bakar & Aditif'), 'FUL-001', 'Solar Dex B30', 'Pertamina', 'Liter', 500.00, 100, 15000, 'Solar subsidi B30'),
((SELECT id FROM stock_categories WHERE category_name = 'Bahan Bakar & Aditif'), 'FUL-002', 'Aditif Solar STP', 'STP Corporation', 'Botol', 14.00, 5, 85000, 'Aditif pembersih sistem bahan bakar'),

-- Sistem Rem
((SELECT id FROM stock_categories WHERE category_name = 'Sistem Rem'), 'BRK-001', 'Kampas Rem Depan Hino', 'Hino Motors', 'Set', 5.00, 2, 850000, 'Kampas rem depan original Hino'),
((SELECT id FROM stock_categories WHERE category_name = 'Sistem Rem'), 'BRK-002', 'Minyak Rem DOT 4', 'Castrol', 'Botol', 9.00, 3, 125000, 'Minyak rem DOT 4 premium'),

-- Spare Parts
((SELECT id FROM stock_categories WHERE category_name = 'Spare Parts'), 'SPR-001', 'Busi Iridium NGK', 'NGK Spark Plugs', 'Pcs', 20.00, 8, 45000, 'Busi iridium untuk mesin bensin'),
((SELECT id FROM stock_categories WHERE category_name = 'Spare Parts'), 'SPR-002', 'V-Belt Fan Belt', 'Gates Corporation', 'Pcs', 8.00, 3, 180000, 'V-belt untuk kipas radiator');

-- 4. TIRE INVENTORY
INSERT INTO tire_inventory (tire_brand, tire_size, tire_type, current_stock, min_stock, unit_price) VALUES
('Bridgestone', '1000 R20', 'Radial', 12, 4, 3200000),
('Dunlop', '1000 R20', 'Radial', 8, 4, 2950000),
('Michelin', '295/80 R22.5', 'Radial', 6, 2, 4500000),
('GT Radial', '1000 R20', 'Bias', 10, 3, 2100000),
('Continental', '315/80 R22.5', 'Radial', 4, 2, 5200000);

-- 5. TIRE INSTANCES (Individual Tire Tracking)
INSERT INTO tire_instances (tire_inventory_id, tire_serial_number, purchase_date, purchase_price, total_mileage, current_tread_depth, condition, status, notes) VALUES
-- Bridgestone 1000 R20 instances
((SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), 'BR-1000-001', '2024-01-10', 3200000, 15000, 8.5, 'good', 'installed', 'Installed on B 1234 ABC FL'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), 'BR-1000-002', '2024-01-10', 3200000, 15000, 8.2, 'good', 'installed', 'Installed on B 1234 ABC FR'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), 'BR-1000-003', '2024-01-10', 3200000, 15000, 7.8, 'fair', 'installed', 'Installed on B 1234 ABC RL1'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), 'BR-1000-004', '2024-01-10', 3200000, 15000, 8.0, 'good', 'installed', 'Installed on B 1234 ABC RR1'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), 'BR-1000-005', '2024-01-10', 3200000, 15000, 6.5, 'fair', 'installed', 'Installed on B 1234 ABC RL2'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), 'BR-1000-006', '2024-01-10', 3200000, 15000, 6.2, 'poor', 'installed', 'Installed on B 1234 ABC RR2'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), 'BR-1000-007', '2024-01-10', 3200000, 0, 10.0, 'new', 'in_stock', 'New tire in stock'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), 'BR-1000-008', '2024-01-10', 3200000, 0, 10.0, 'new', 'in_stock', 'New tire in stock'),

-- Dunlop 1000 R20 instances
((SELECT id FROM tire_inventory WHERE tire_brand = 'Dunlop' AND tire_size = '1000 R20'), 'DL-1000-001', '2024-01-10', 2950000, 0, 10.0, 'new', 'installed', 'Installed on B 1234 ABC SPARE1'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Dunlop' AND tire_size = '1000 R20'), 'DL-1000-002', '2024-01-10', 2950000, 0, 9.8, 'new', 'installed', 'Installed on B 1234 ABC SPARE2'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Dunlop' AND tire_size = '1000 R20'), 'DL-1000-003', '2024-01-10', 2950000, 0, 10.0, 'new', 'in_stock', 'New tire in stock'),

-- GT Radial 1000 R20 instances
((SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), 'GT-1000-001', '2024-02-05', 2100000, 25000, 5.5, 'poor', 'installed', 'Installed on B 5678 DEF FL'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), 'GT-1000-002', '2024-02-05', 2100000, 25000, 5.2, 'poor', 'installed', 'Installed on B 5678 DEF FR'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), 'GT-1000-003', '2024-02-05', 2100000, 20000, 7.0, 'fair', 'installed', 'Installed on B 5678 DEF RL1'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), 'GT-1000-004', '2024-02-05', 2100000, 20000, 6.8, 'fair', 'installed', 'Installed on B 5678 DEF RR1'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), 'GT-1000-005', '2024-02-05', 2100000, 18000, 8.5, 'good', 'installed', 'Installed on B 5678 DEF RL2'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), 'GT-1000-006', '2024-02-05', 2100000, 18000, 8.2, 'good', 'installed', 'Installed on B 5678 DEF RR2'),

-- Michelin 295/80 R22.5 instances
((SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), 'MI-295-001', '2024-02-25', 4500000, 12000, 9.2, 'good', 'installed', 'Installed on B 3456 JKL FL'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), 'MI-295-002', '2024-02-25', 4500000, 12000, 9.0, 'good', 'installed', 'Installed on B 3456 JKL FR'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), 'MI-295-003', '2024-02-25', 4500000, 12000, 8.8, 'good', 'installed', 'Installed on B 3456 JKL RL1'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), 'MI-295-004', '2024-02-25', 4500000, 12000, 8.5, 'good', 'installed', 'Installed on B 3456 JKL RR1'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), 'MI-295-005', '2024-02-25', 4500000, 12000, 8.2, 'good', 'installed', 'Installed on B 3456 JKL RL2'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), 'MI-295-006', '2024-02-25', 4500000, 12000, 8.0, 'fair', 'installed', 'Installed on B 3456 JKL RR2'),

-- Continental 315/80 R22.5 instances
((SELECT id FROM tire_inventory WHERE tire_brand = 'Continental' AND tire_size = '315/80 R22.5'), 'CT-315-001', '2024-02-25', 5200000, 0, 10.0, 'new', 'installed', 'Installed on B 3456 JKL SPARE1'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Continental' AND tire_size = '315/80 R22.5'), 'CT-315-002', '2024-02-25', 5200000, 0, 10.0, 'new', 'installed', 'Installed on B 3456 JKL SPARE2'),

-- Additional stock instances
((SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), 'BR-1000-009', '2024-03-01', 3200000, 0, 10.0, 'new', 'in_stock', 'New tire in stock'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), 'BR-1000-010', '2024-03-01', 3200000, 0, 10.0, 'new', 'in_stock', 'New tire in stock'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), 'GT-1000-007', '2024-03-01', 2100000, 0, 10.0, 'new', 'in_stock', 'New tire in stock'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), 'GT-1000-008', '2024-03-01', 2100000, 0, 10.0, 'new', 'in_stock', 'New tire in stock');

-- 6. VEHICLES WITH TIRE CONFIGURATION
INSERT INTO vehicles (
  license_plate, type, capacity, tire_count, spare_tire_count, driver_id, status,
  last_service_date, next_service_due,
  stnk_number, stnk_expired_date, tax_due_date
) VALUES
('B 1234 ABC', 'Hino Dutro 130 HD', '8000', 6, 2, (SELECT id FROM users WHERE username = 'supir_andi'), 'in_use',
  '2024-06-01', '2024-12-01',
  'STNK-1234-2025', '2025-10-20', '2025-10-20'
),
('B 5678 DEF', 'Mitsubishi Fuso Canter', '8250', 6, 2, (SELECT id FROM users WHERE username = 'supir_budi'), 'in_use',
  '2024-05-15', '2024-11-15',
  'STNK-5678-2026', '2026-03-15', '2025-03-15'
),
('B 9012 GHI', 'Isuzu Elf NMR 71', '7500', 6, 1, (SELECT id FROM users WHERE username = 'supir_charlie'), 'in_use',
  '2024-04-10', '2024-10-10',
  'STNK-9012-2024', '2024-11-30', '2024-11-30'
),
('B 3456 JKL', 'Hino Ranger FG', '12000', 10, 2, (SELECT id FROM users WHERE username = 'supir_dedi'), 'available',
  '2024-03-20', '2024-09-20',
  'STNK-3456-2025', '2025-12-01', '2025-12-01'
),
('BE 9090 AC', 'Mitsubishi Colt Diesel', '6800', 6, 2, (SELECT id FROM users WHERE username = 'supir_yoyo'), 'in_use',
  '2024-02-28', '2024-08-28',
  'STNK-9090-2026', '2026-04-17', '2030-05-11'
),
('B 7890 MNO', 'Mitsubishi Colt Diesel', '7000', 6, 2, (SELECT id FROM users WHERE username = 'supir_eko'), 'in_use',
  '2024-01-05', '2024-07-05',
  'STNK-7890-2026', '2026-01-10', '2026-01-10'
),
('B 1122 PQR', 'Isuzu Giga', '15000', 10, 2, NULL, 'available',
  '2024-06-15', '2024-12-15',
  'STNK-1122-2025', '2025-08-20', '2025-08-20'
);

-- 7. VEHICLE TIRES (WITH TIRE INSTANCE REFERENCES)
INSERT INTO vehicle_tires (vehicle_id, tire_inventory_id, tire_instance_id, position, install_date, current_pressure, recommended_pressure, tread_depth, temperature, condition) VALUES
-- B 1234 ABC (Hino Dutro - 6+2 tires)
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-001'), 'FL', '2024-01-15', 32.5, 35.0, 8.5, 28.0, 'good'),
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-002'), 'FR', '2024-01-15', 33.0, 35.0, 8.2, 29.0, 'good'),
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-003'), 'RL1', '2024-01-15', 34.0, 35.0, 7.8, 30.0, 'fair'),
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-004'), 'RR1', '2024-01-15', 33.5, 35.0, 8.0, 29.5, 'good'),
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-005'), 'RL2', '2024-01-15', 32.0, 35.0, 6.5, 31.0, 'fair'),
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-006'), 'RR2', '2024-01-15', 31.5, 35.0, 6.2, 32.0, 'poor'),
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Dunlop' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'DL-1000-001'), 'SPARE1', '2024-01-15', 35.0, 35.0, 10.0, 25.0, 'good'),
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Dunlop' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'DL-1000-002'), 'SPARE2', '2024-01-15', 35.0, 35.0, 9.8, 25.0, 'good'),

-- B 5678 DEF (Mitsubishi Fuso - 6+2 tires)
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), (SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'GT-1000-001'), 'FL', '2024-02-10', 30.0, 35.0, 5.5, 35.0, 'poor'),
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), (SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'GT-1000-002'), 'FR', '2024-02-10', 29.5, 35.0, 5.2, 36.0, 'poor'),
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), (SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'GT-1000-003'), 'RL1', '2024-02-10', 33.0, 35.0, 7.0, 32.0, 'fair'),
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), (SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'GT-1000-004'), 'RR1', '2024-02-10', 32.5, 35.0, 6.8, 33.0, 'fair'),
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), (SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'GT-1000-005'), 'RL2', '2024-02-10', 34.0, 35.0, 8.5, 30.0, 'good'),
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), (SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'GT-1000-006'), 'RR2', '2024-02-10', 33.8, 35.0, 8.2, 31.0, 'good'),
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-007'), 'SPARE1', '2024-02-10', 35.0, 35.0, 10.0, 25.0, 'good'),
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-008'), 'SPARE2', '2024-02-10', 35.0, 35.0, 9.9, 25.0, 'good'),

-- B 3456 JKL (Hino Ranger - 10+2 tires)
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'MI-295-001'), 'FL', '2024-03-01', 36.0, 38.0, 9.2, 27.0, 'good'),
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'MI-295-002'), 'FR', '2024-03-01', 37.0, 38.0, 9.0, 28.0, 'good'),
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'MI-295-003'), 'RL1', '2024-03-01', 35.5, 38.0, 8.8, 29.0, 'good'),
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'MI-295-004'), 'RR1', '2024-03-01', 36.5, 38.0, 8.5, 30.0, 'good'),
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'MI-295-005'), 'RL2', '2024-03-01', 37.5, 38.0, 8.2, 31.0, 'good'),
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'MI-295-006'), 'RR2', '2024-03-01', 36.8, 38.0, 8.0, 32.0, 'fair'),
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Continental' AND tire_size = '315/80 R22.5'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'CT-315-001'), 'SPARE1', '2024-03-01', 38.0, 38.0, 10.0, 25.0, 'good'),
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Continental' AND tire_size = '315/80 R22.5'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'CT-315-002'), 'SPARE2', '2024-03-01', 38.0, 38.0, 10.0, 25.0, 'good');

-- 8. TIRE INSPECTIONS (WITH TIRE INSTANCE REFERENCES)
INSERT INTO tire_inspections (vehicle_tire_id, tire_instance_id, inspection_date, tread_depth, air_pressure, temperature, condition, notes, inspector_name) VALUES
((SELECT id FROM vehicle_tires WHERE vehicle_id = (SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC') AND position = 'FL'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-001'), '2024-06-20', 8.5, 32.5, 28.0, 'good', 'Kondisi ban masih baik', 'Teknisi Ahmad'),
((SELECT id FROM vehicle_tires WHERE vehicle_id = (SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC') AND position = 'RR2'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-006'), '2024-06-20', 6.2, 31.5, 32.0, 'poor', 'Ban perlu diganti segera', 'Teknisi Ahmad'),
((SELECT id FROM vehicle_tires WHERE vehicle_id = (SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF') AND position = 'FL'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'GT-1000-001'), '2024-06-22', 5.5, 30.0, 35.0, 'poor', 'Tekanan rendah, tapak tipis', 'Teknisi Budi'),
((SELECT id FROM vehicle_tires WHERE vehicle_id = (SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF') AND position = 'FR'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'GT-1000-002'), '2024-06-22', 5.2, 29.5, 36.0, 'poor', 'Perlu penggantian segera', 'Teknisi Budi'),
((SELECT id FROM vehicle_tires WHERE vehicle_id = (SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL') AND position = 'FL'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'MI-295-001'), '2024-06-24', 9.2, 36.0, 27.0, 'good', 'Ban dalam kondisi baik', 'Teknisi Charlie'),
((SELECT id FROM vehicle_tires WHERE vehicle_id = (SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL') AND position = 'RR2'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'MI-295-006'), '2024-06-24', 8.0, 36.8, 32.0, 'fair', 'Perlu monitoring', 'Teknisi Charlie');


-- 8. PURCHASE ORDERS
INSERT INTO purchase_orders (po_number, customer_name, item_name, total_quantity, unit_price, total_amount, load_location, unload_location, order_date, status) VALUES
('PO/WIKA/09/2024-01', 'PT WIKA BETON', 'Abu Batu', 200.00, 155000, 31000000, 'Quarry Jonggol, Bogor', 'Proyek Tol Cibitung, Bekasi', '2024-09-28', 'partial'),
('PO/ADHI/10/2024-02', 'PT ADHI KARYA', 'Pasir dan Batu Split', 500.00, 160000, 80000000, 'Quarry Cibinong, Bogor', 'Proyek Tol Cimanggis, Depok', '2024-10-05', 'partial'),
('PO/WIJAYA/11/2024-03', 'PT WIJAYA KARYA', 'Batu Split 1-2', 300.00, 165000, 49500000, NULL, NULL, '2024-11-01', 'confirmed');

-- 9. DELIVERY ORDERS
INSERT INTO delivery_orders (
  purchase_order_id, driver_id, vehicle_id, do_number, customer_name, item_name, minimal_load_quantity, actual_load_quantity, unit_price, total_amount,
  payment_status, due_date, load_location, load_latitude, load_longitude, unload_location, unload_latitude, unload_longitude, status, 
  departed_to_load_location_at, arrived_at_load_location_at, departed_from_load_location_at, arrived_at_unload_location_at, departed_from_unload_location_at, completed_at, 
  trip_allowance, gaji, ongkosan
)
VALUES
-- DO 1: assigned (supir_andi, B 1234 ABC)
((SELECT id FROM purchase_orders WHERE po_number = 'PO/WIKA/09/2024-01'), 
 (SELECT id FROM users WHERE username = 'supir_andi'), 
 (SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), 
 'DO-240928-01', 'PT WIKA BETON', 'Abu Batu', 34, 34.05, 155000, 5277750, 
 'proses_tagihan', '2024-10-28', 
 'Quarry Jonggol, Bogor', -6.4925, 106.8467, 'Proyek Tol Cibitung, Bekasi', -6.2615, 107.0012,
 'assigned', NULL, NULL, NULL, NULL, NULL, NULL, 
 1700000, 500000, 3077750),

-- DO 2: otw_to_load_location (supir_budi, B 5678 DEF)
((SELECT id FROM purchase_orders WHERE po_number = 'PO/WIKA/09/2024-01'), 
 (SELECT id FROM users WHERE username = 'supir_budi'), 
 (SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), 
 'DO-240928-02', 'PT WIKA BETON', 'Abu Batu', 34, 34.72, 155000, 5381600, 
 'proses_tagihan', '2024-10-28', 
 'Quarry Jonggol, Bogor', -6.4925, 106.8467, 'Proyek Tol Cibitung, Bekasi', -6.2615, 107.0012,
 'otw_to_load_location', '2024-06-16 08:00:00', NULL, NULL, NULL, NULL, NULL, 
 1800000, 500000, 3081600),

-- DO 3: at_unload_location (supir_charlie, B 9012 GHI)
((SELECT id FROM purchase_orders WHERE po_number = 'PO/WIKA/09/2024-01'), 
 (SELECT id FROM users WHERE username = 'supir_charlie'), 
 (SELECT id FROM vehicles WHERE license_plate = 'B 9012 GHI'), 
 'DO-240928-03', 'PT WIKA BETON', 'Split 1-2', 33, 33.53, 155000, 5197150, 
 'deposit', '2024-10-28', 
 'Quarry Jonggol, Bogor', -6.4925, 106.8467, 'Proyek Tol Cibitung, Bekasi', -6.2615, 107.0012,
 'at_unload_location', '2024-06-16 07:00:00', '2024-06-16 10:00:00', '2024-06-16 12:00:00', '2024-06-16 16:00:00', NULL, NULL, 
 1750000, 500000, 2947150),

-- DO 4: otw_to_base (supir_yoyo, BE 9090 AC)
((SELECT id FROM purchase_orders WHERE po_number = 'PO/ADHI/10/2024-02'), 
 (SELECT id FROM users WHERE username = 'supir_yoyo'), 
 (SELECT id FROM vehicles WHERE license_plate = 'BE 9090 AC'), 
 'DO-241005-01', 'PT ADHI KARYA', 'Pasir', 40.00, 40.15, 160000, 6424000, 
 'proses_tagihan', '2024-11-05', 
 'Quarry Cibinong, Bogor', -6.4925, 106.8467, 'Proyek Tol Cimanggis, Depok', -6.2615, 107.0012,
 'otw_to_base', '2024-06-15 09:00:00', '2024-06-15 12:00:00', '2024-06-15 13:00:00', '2024-06-15 17:00:00', '2024-06-15 18:00:00', NULL, 
 2000000, 500000, 3924000),

-- DO 5: completed (supir_dedi, B 3456 JKL)
((SELECT id FROM purchase_orders WHERE po_number = 'PO/ADHI/10/2024-02'), 
 (SELECT id FROM users WHERE username = 'supir_dedi'), 
 (SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), 
 'DO-241005-02', 'PT ADHI KARYA', 'Batu Split', 38.00, 38.70, 158000, 6114600, 
 'lunas', '2024-11-06', 
 'Quarry Cibinong, Bogor', -6.4925, 106.8467, 'Proyek Tol Cimanggis, Depok', -6.2615, 107.0012,
 'completed', '2024-06-14 08:00:00', '2024-06-14 11:00:00', '2024-06-14 12:00:00', '2024-06-14 15:00:00', '2024-06-14 18:30:00', '2024-06-14 20:00:00', 
 2100000, 500000, 3514600),

-- DO 6: assigned (supir_eko, B 7890 MNO)
((SELECT id FROM purchase_orders WHERE po_number = 'PO/ADHI/10/2024-02'), 
 (SELECT id FROM users WHERE username = 'supir_eko'), 
 (SELECT id FROM vehicles WHERE license_plate = 'B 7890 MNO'), 
 'DO-241005-03', 'PT ADHI KARYA', 'Sirtu', 36.00, 36.10, 157000, 5665700, 
 'proses_tagihan', '2024-11-07', 
 'Quarry Cibinong, Bogor', -6.4925, 106.8467, 'Proyek Tol Cimanggis, Depok', -6.2615, 107.0012,
 'assigned', NULL, NULL, NULL, NULL, NULL, NULL, 
 1900000, 500000, 3265700);

-- 10. DRIVER EXPENSES
INSERT INTO driver_expenses (delivery_order_id, driver_id, jenis, amount, notes) VALUES
((SELECT id FROM delivery_orders WHERE do_number = 'DO-240928-01'), (SELECT id FROM users WHERE username = 'supir_andi'), 'bbm', 500000, 'Pengisian Solar Awal'),
((SELECT id FROM delivery_orders WHERE do_number = 'DO-240928-01'), (SELECT id FROM users WHERE username = 'supir_andi'), 'makan', 100000, 'Makan di Rest Area'),
((SELECT id FROM delivery_orders WHERE do_number = 'DO-240928-02'), (SELECT id FROM users WHERE username = 'supir_budi'), 'bbm', 600000, 'Pengisian Solar'),
((SELECT id FROM delivery_orders WHERE do_number = 'DO-240928-02'), (SELECT id FROM users WHERE username = 'supir_budi'), 'makan', 120000, 'Makan di Warung'),
((SELECT id FROM delivery_orders WHERE do_number = 'DO-240928-03'), (SELECT id FROM users WHERE username = 'supir_charlie'), 'bbm', 550000, 'Pengisian Solar'),
((SELECT id FROM delivery_orders WHERE do_number = 'DO-240928-03'), (SELECT id FROM users WHERE username = 'supir_charlie'), 'makan', 90000, 'Makan di Rest Area'),
((SELECT id FROM delivery_orders WHERE do_number = 'DO-241005-01'), (SELECT id FROM users WHERE username = 'supir_yoyo'), 'bbm', 700000, 'Pengisian Solar'),
((SELECT id FROM delivery_orders WHERE do_number = 'DO-241005-01'), (SELECT id FROM users WHERE username = 'supir_yoyo'), 'makan', 110000, 'Makan di Warung'),
((SELECT id FROM delivery_orders WHERE do_number = 'DO-241005-02'), (SELECT id FROM users WHERE username = 'supir_dedi'), 'bbm', 800000, 'Pengisian Solar'),
((SELECT id FROM delivery_orders WHERE do_number = 'DO-241005-02'), (SELECT id FROM users WHERE username = 'supir_dedi'), 'makan', 95000, 'Makan di Warung'),
((SELECT id FROM delivery_orders WHERE do_number = 'DO-241005-03'), (SELECT id FROM users WHERE username = 'supir_eko'), 'bbm', 600000, 'Pengisian Solar'),
((SELECT id FROM delivery_orders WHERE do_number = 'DO-241005-03'), (SELECT id FROM users WHERE username = 'supir_eko'), 'makan', 105000, 'Makan di Rest Area');

-- 11. VEHICLE SERVICES
INSERT INTO vehicle_services (vehicle_id, service_number, service_date, service_type, description, workshop_name, labor_cost, parts_cost, status, notes) VALUES
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), 'SRV-20240715-001', '2024-07-15', 'with_parts', 'Ganti Oli Mesin dan Filter Oli', 'Bengkel Internal', 200000, 645000, 'completed', 'Servis rutin bulanan'),
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), 'SRV-20240820-001', '2024-08-20', 'with_parts', 'Servis Rutin - Ganti Filter Solar & Cek Kaki-kaki', 'Bengkel Internal', 300000, 645000, 'completed', 'Servis berkala'),
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), 'SRV-20240901-001', '2024-09-01', 'with_parts', 'Ganti Ban Depan', 'Bengkel Ban Jaya', 400000, 2800000, 'completed', 'Penggantian ban karena aus'),
((SELECT id FROM vehicles WHERE license_plate = 'B 7890 MNO'), 'SRV-20240910-001', '2024-09-10', 'regular', 'Tune Up Mesin', 'Bengkel Internal', 1200000, 0, 'completed', 'Tune up mesin tanpa ganti parts'),
((SELECT id FROM vehicles WHERE license_plate = 'BE 9090 AC'), 'SRV-20241201-001', '2024-12-01', 'with_parts', 'Ganti Kampas Rem dan Minyak Rem', 'Bengkel Internal', 350000, 975000, 'completed', 'Perbaikan sistem rem');

-- 12. SERVICE ITEMS
INSERT INTO service_items (service_id, stock_item_id, item_name, quantity, unit_price, from_stock) VALUES
-- Service 1: Ganti Oli Mesin dan Filter Oli (B 1234 ABC)
((SELECT id FROM vehicle_services WHERE service_number = 'SRV-20240715-001'), 
 (SELECT id FROM stock_items WHERE item_code = 'OLI-001'), 'Oli Mesin Meditran SX SAE 15W-40', 10.00, 55000, true),
((SELECT id FROM vehicle_services WHERE service_number = 'SRV-20240715-001'), 
 (SELECT id FROM stock_items WHERE item_code = 'FLT-002'), 'Filter Oli Mitsubishi Fuso', 1.00, 95000, true),

-- Service 2: Servis Rutin Filter Solar (B 5678 DEF)
((SELECT id FROM vehicle_services WHERE service_number = 'SRV-20240820-001'), 
 (SELECT id FROM stock_items WHERE item_code = 'FLT-001'), 'Filter Solar Hino Dutro', 1.00, 120000, true),
((SELECT id FROM vehicle_services WHERE service_number = 'SRV-20240820-001'), 
 (SELECT id FROM stock_items WHERE item_code = 'OLI-001'), 'Oli Mesin Meditran SX SAE 15W-40', 8.00, 55000, true),
((SELECT id FROM vehicle_services WHERE service_number = 'SRV-20240820-001'), 
 (SELECT id FROM stock_items WHERE item_code = 'FUL-002'), 'Aditif Solar STP', 1.00, 85000, true),

-- Service 3: Ganti Ban Depan (B 3456 JKL) - External purchase
((SELECT id FROM vehicle_services WHERE service_number = 'SRV-20240901-001'), 
 NULL, 'Ban Truck 1000 R20 Bridgestone (External)', 2.00, 1400000, false),

-- Service 5: Ganti Kampas Rem (BE 9090 AC)
((SELECT id FROM vehicle_services WHERE service_number = 'SRV-20241201-001'), 
 (SELECT id FROM stock_items WHERE item_code = 'BRK-001'), 'Kampas Rem Depan Hino', 1.00, 850000, true),
((SELECT id FROM vehicle_services WHERE service_number = 'SRV-20241201-001'), 
 (SELECT id FROM stock_items WHERE item_code = 'BRK-002'), 'Minyak Rem DOT 4', 1.00, 125000, true);

-- 13. STOCK TRANSACTIONS
INSERT INTO stock_transactions (item_id, transaction_type, quantity, unit_price, total_amount, reference_type, reference_id, notes, transaction_date) VALUES
-- Initial stock entries
((SELECT id FROM stock_items WHERE item_code = 'OLI-001'), 'in', 150.00, 55000, 8250000, 'restock', NULL, 'Pembelian awal stok oli mesin', '2024-06-01'),
((SELECT id FROM stock_items WHERE item_code = 'OLI-002'), 'in', 25.00, 75000, 1875000, 'restock', NULL, 'Pembelian awal oli transmisi', '2024-06-01'),
((SELECT id FROM stock_items WHERE item_code = 'FLT-001'), 'in', 20.00, 120000, 2400000, 'restock', NULL, 'Pembelian awal filter solar', '2024-06-01'),
((SELECT id FROM stock_items WHERE item_code = 'FLT-002'), 'in', 15.00, 95000, 1425000, 'restock', NULL, 'Pembelian awal filter oli', '2024-06-01'),
((SELECT id FROM stock_items WHERE item_code = 'FLT-003'), 'in', 12.00, 150000, 1800000, 'restock', NULL, 'Pembelian awal filter udara', '2024-06-01'),
((SELECT id FROM stock_items WHERE item_code = 'FUL-001'), 'in', 500.00, 15000, 7500000, 'restock', NULL, 'Pembelian awal solar', '2024-06-01'),
((SELECT id FROM stock_items WHERE item_code = 'FUL-002'), 'in', 15.00, 85000, 1275000, 'restock', NULL, 'Pembelian awal aditif solar', '2024-06-01'),
((SELECT id FROM stock_items WHERE item_code = 'BRK-001'), 'in', 6.00, 850000, 5100000, 'restock', NULL, 'Pembelian kampas rem', '2024-06-01'),
((SELECT id FROM stock_items WHERE item_code = 'BRK-002'), 'in', 10.00, 125000, 1250000, 'restock', NULL, 'Pembelian minyak rem', '2024-06-01'),
((SELECT id FROM stock_items WHERE item_code = 'SPR-001'), 'in', 20.00, 45000, 900000, 'restock', NULL, 'Pembelian busi', '2024-06-01'),
((SELECT id FROM stock_items WHERE item_code = 'SPR-002'), 'in', 8.00, 180000, 1440000, 'restock', NULL, 'Pembelian v-belt', '2024-06-01'),

-- Service-related stock movements
((SELECT id FROM stock_items WHERE item_code = 'OLI-001'), 'out', 10.00, 55000, 550000, 'service', (SELECT id FROM vehicle_services WHERE service_number = 'SRV-20240715-001'), 'Digunakan untuk servis B 1234 ABC', '2024-07-15'),
((SELECT id FROM stock_items WHERE item_code = 'FLT-002'), 'out', 1.00, 95000, 95000, 'service', (SELECT id FROM vehicle_services WHERE service_number = 'SRV-20240715-001'), 'Digunakan untuk servis B 1234 ABC', '2024-07-15'),
((SELECT id FROM stock_items WHERE item_code = 'FLT-001'), 'out', 1.00, 120000, 120000, 'service', (SELECT id FROM vehicle_services WHERE service_number = 'SRV-20240820-001'), 'Digunakan untuk servis B 5678 DEF', '2024-08-20'),
((SELECT id FROM stock_items WHERE item_code = 'OLI-001'), 'out', 8.00, 55000, 440000, 'service', (SELECT id FROM vehicle_services WHERE service_number = 'SRV-20240820-001'), 'Digunakan untuk servis B 5678 DEF', '2024-08-20'),
((SELECT id FROM stock_items WHERE item_code = 'FUL-002'), 'out', 1.00, 85000, 85000, 'service', (SELECT id FROM vehicle_services WHERE service_number = 'SRV-20240820-001'), 'Digunakan untuk servis B 5678 DEF', '2024-08-20'),
((SELECT id FROM stock_items WHERE item_code = 'BRK-001'), 'out', 1.00, 850000, 850000, 'service', (SELECT id FROM vehicle_services WHERE service_number = 'SRV-20241201-001'), 'Digunakan untuk servis BE 9090 AC', '2024-12-01'),
((SELECT id FROM stock_items WHERE item_code = 'BRK-002'), 'out', 1.00, 125000, 125000, 'service', (SELECT id FROM vehicle_services WHERE service_number = 'SRV-20241201-001'), 'Digunakan untuk servis BE 9090 AC', '2024-12-01');

-- 14. ACCOUNTING RITASE
INSERT INTO accounting_ritase (delivery_order_id, ritase, tarif, total) VALUES
((SELECT id FROM delivery_orders WHERE do_number = 'DO-240928-01'), 1, 2000000, 2000000),
((SELECT id FROM delivery_orders WHERE do_number = 'DO-241005-02'), 1, 2100000, 2100000);

-- 15. OFFICE EXPENSES
INSERT INTO office_expenses (kategori, description, amount, expense_date) VALUES
('Listrik & Internet', 'Pembayaran Tagihan Listrik Kantor Bulan September', 1500000, '2024-09-25'),
('Gaji Karyawan', 'Gaji Admin September', 4000000, '2024-09-25'),
('Operasional Kantor', 'Pembelian ATK dan Supplies Kantor', 750000, '2024-10-01'),
('Maintenance', 'Biaya maintenance AC kantor', 450000, '2024-10-15');

-- 13. TIRE INVENTORY
INSERT INTO tire_inventory (tire_brand, tire_size, tire_type, current_stock, min_stock, unit_price) VALUES
('Bridgestone', '1000 R20', 'Radial', 12, 4, 3200000),
('Dunlop', '1000 R20', 'Radial', 8, 4, 2950000),
('Michelin', '295/80 R22.5', 'Radial', 6, 2, 4500000),
('GT Radial', '1000 R20', 'Bias', 10, 3, 2100000);

-- ✅ 14. DELIVERY ORDER PAYMENTS (Updated table name and structure)
INSERT INTO delivery_order_payments (
  delivery_order_id, 
  payment_reference, 
  payment_type, 
  payment_amount, 
  payment_date, 
  notes,
  created_by
) VALUES
(
  (SELECT id FROM delivery_orders WHERE do_number = 'DO-241005-02'), 
  'TRF-20241106-001',
  'transfer', 
  6114600, 
  '2024-11-06', 
  'Pembayaran lunas DO-241005-02',
  (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1)
);

-- ✅ DELIVERY ORDER INVOICES (New table for invoice management)
INSERT INTO delivery_order_invoices (
  delivery_order_id,
  invoice_number,
  invoice_date,
  invoice_amount,
  due_date,
  pph_percentage,
  pph_amount,
  net_amount,
  status,
  notes,
  created_by
) VALUES
(
  (SELECT id FROM delivery_orders WHERE do_number = 'DO-241005-02'),
  'INV/2024/11/001',
  '2024-11-05',
  6192000,  -- Original amount before PPH
  '2024-12-05',
  0.5,      -- 0.5% PPH
  30960,    -- PPH amount (6192000 * 0.5%)
  6222960,  -- Net amount after PPH
  'paid',
  'Invoice untuk DO-241005-02',
  (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1)
);

-- ✅ UPDATE DELIVERY ORDERS untuk payment workflow
UPDATE delivery_orders 
SET 
  payment_status = 'lunas',
  payment_confirmation_status = 'confirmed',
  final_amount = unit_price * actual_load_quantity,  -- Assuming final amount is based on unit price and actual load quantity
  payment_confirmation_at = NOW(),
  payment_confirmed_by = (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1)
WHERE do_number = 'DO-241005-02';

-- ✅ SAMPLE PRICE ADJUSTMENT (untuk kasus kecelakaan)
INSERT INTO delivery_order_adjustments (
  delivery_order_id,
  adjustment_type,
  original_amount,
  adjustment_amount,
  final_amount,
  reason,
  approved_by,
  created_by
) VALUES
(
  (SELECT id FROM delivery_orders WHERE do_number = 'DO-241005-01'),
  'incident',
  5500000,  -- Original ongkosan
  0,        -- Adjusted to 0 due to accident
  0,        -- Final amount
  'Kecelakaan - tumpah di jalan, tidak ada pembayaran',
  (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1),
  (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1)
);

-- Update DO yang kena adjustment
UPDATE delivery_orders 
SET 
  payment_status = 'lunas',  -- Considered paid (0 amount)
  payment_confirmation_status = 'confirmed',
  final_amount = 0,
  payment_notes = 'Kecelakaan - tidak ada tagihan'
WHERE do_number = 'DO-241005-01';


--17. Cash_categories
INSERT INTO cash_categories (category_name, category_type, description) VALUES
('Setoran Modal', 'income', 'Modal awal atau tambahan modal'),
('Pendapatan Operasional', 'income', 'Pendapatan dari operasional harian'),
('Pendapatan Lain-lain', 'income', 'Pendapatan di luar operasional utama'),
('Biaya Kantor', 'expense', 'Pengeluaran untuk operasional kantor'),
('Gaji Staf', 'expense', 'Pembayaran gaji karyawan'),
('Pembelian Aset', 'expense', 'Pembelian kendaraan, peralatan, dll'),
('Biaya Operasional', 'expense', 'Biaya BBM, maintenance, dll'),
('Pengeluaran Lain-lain', 'expense', 'Pengeluaran di luar kategori utama');

-- ✅ 16. DELIVERY ORDER PAYMENT HISTORY (untuk audit trail)
INSERT INTO delivery_order_payment_history (
  delivery_order_id,
  old_status,
  new_status,
  change_reason,
  changed_by,
  changed_at
) VALUES
(
  (SELECT id FROM delivery_orders WHERE do_number = 'DO-241005-02'),
  'proses_tagihan',
  'lunas',
  'Payment completed via transfer',
  (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1),
  NOW()
);

-- ===============================================
-- 🎯 NEW SEEDER: PO + 2 Completed DOs (June 2025)
-- Unit: kubik (volume-based pricing)
-- Driver: Dedi (supir_dedi)
-- ===============================================

-- 🏗️ NEW PURCHASE ORDER (Unit: kubik)
INSERT INTO purchase_orders (
  po_number, 
  customer_name, 
  item_name, 
  total_quantity, 
  unit, 
  unit_price, 
  total_amount, 
  load_location, 
  unload_location, 
  order_date, 
  status,
  notes
) VALUES (
  'PO/JAYA/06/2025-04', 
  'PT JAYA KONSTRUKSI', 
  'Pasir Urug', 
  120.00, 
  'kubik', 
  185000, -- Rp 185,000 per m³
  22200000, -- 120 m³ × Rp 185,000/m³ = Rp 22,200,000
  'Quarry Sukabumi, Jawa Barat',
  'Proyek Perumahan Serpong, Tangerang Selatan',
  '2025-06-01',
  'completed', -- Status completed karena semua DO selesai
  'Pasir urug untuk proyek perumahan fase 2'
);

-- 🚛 DELIVERY ORDER 1 (Completed: 10 Juni 2025)
INSERT INTO delivery_orders (
  purchase_order_id, 
  driver_id, 
  vehicle_id, 
  do_number, 
  customer_name, 
  item_name, 
  minimal_load_quantity, 
  actual_load_quantity, 
  unit,
  unit_price, 
  total_amount,
  payment_status, 
  due_date, 
  load_location, 
  load_latitude, 
  load_longitude, 
  unload_location, 
  unload_latitude, 
  unload_longitude, 
  status, 
  departed_to_load_location_at, 
  arrived_at_load_location_at, 
  departed_from_load_location_at, 
  arrived_at_unload_location_at, 
  departed_from_unload_location_at, 
  completed_at, 
  trip_allowance, 
  gaji, 
  ongkosan,
  surat_jalan_photo_url,
  payment_confirmation_status,
  created_at
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO/JAYA/06/2025-04'),
  (SELECT id FROM users WHERE username = 'supir_dedi'),
  (SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'),
  'DO-250610-01',
  'PT JAYA KONSTRUKSI',
  'Pasir Urug',
  55.00, -- Target: 55 m³
  56.25, -- Actual: 56.25 m³ (slight excess)
  'kubik',
  185000, -- Rp 185,000 per m³
  10406250, -- 56.25 m³ × Rp 185,000/m³ = Rp 10,406,250
  'lunas',
  '2025-07-10',
  'Quarry Sukabumi, Jawa Barat',
  -6.9175, 106.9270, -- Sukabumi coordinates
  'Proyek Perumahan Serpong, Tangerang Selatan',
  -6.2615, 106.6900, -- Serpong coordinates
  'completed',
  '2025-06-10 06:00:00+07', -- Berangkat pagi
  '2025-06-10 09:30:00+07', -- Sampai lokasi muat
  '2025-06-10 11:00:00+07', -- Selesai muat
  '2025-06-10 14:30:00+07', -- Sampai lokasi bongkar
  '2025-06-10 16:00:00+07', -- Selesai bongkar
  '2025-06-10 18:00:00+07', -- Selesai trip
  2200000, -- Uang jalan Rp 2,200,000
  600000,  -- Gaji Rp 600,000
  7606250, -- Ongkosan: 10,406,250 - 2,200,000 - 600,000 = 7,606,250
  '{uploads/surat_jalan/DO-250610-01-surat-jalan.jpg}',
  'confirmed',
  '2025-06-09 15:00:00+07' -- DO dibuat sehari sebelumnya
),

-- 🚛 DELIVERY ORDER 2 (Completed: 30 Juni 2025)
(
  (SELECT id FROM purchase_orders WHERE po_number = 'PO/JAYA/06/2025-04'),
  (SELECT id FROM users WHERE username = 'supir_dedi'),
  (SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'),
  'DO-250630-02',
  'PT JAYA KONSTRUKSI',
  'Pasir Urug',
  65.00, -- Target: 65 m³ (sisa dari PO)
  64.80, -- Actual: 64.80 m³ (slight shortage)
  'kubik',
  185000, -- Rp 185,000 per m³
  11988000, -- 64.80 m³ × Rp 185,000/m³ = Rp 11,988,000
  'lunas',
  '2025-07-30',
  'Quarry Sukabumi, Jawa Barat',
  -6.9175, 106.9270, -- Sukabumi coordinates
  'Proyek Perumahan Serpong, Tangerang Selatan',
  -6.2615, 106.6900, -- Serpong coordinates
  'completed',
  '2025-06-30 05:30:00+07', -- Berangkat lebih pagi
  '2025-06-30 09:00:00+07', -- Sampai lokasi muat
  '2025-06-30 10:30:00+07', -- Selesai muat
  '2025-06-30 14:00:00+07', -- Sampai lokasi bongkar
  '2025-06-30 15:30:00+07', -- Selesai bongkar
  '2025-06-30 17:30:00+07', -- Selesai trip
  2300000, -- Uang jalan Rp 2,300,000 (sedikit lebih mahal)
  650000,  -- Gaji Rp 650,000
  9038000, -- Ongkosan: 11,988,000 - 2,300,000 - 650,000 = 9,038,000
  '{uploads/surat_jalan/DO-250630-02-surat-jalan.jpg}',
  'confirmed',
  '2025-06-29 16:00:00+07' -- DO dibuat sehari sebelumnya
);

-- 💰 DRIVER EXPENSES untuk kedua DO
INSERT INTO driver_expenses (delivery_order_id, driver_id, jenis, amount, notes) VALUES
-- Expenses untuk DO-250610-01
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250610-01'), 
 (SELECT id FROM users WHERE username = 'supir_dedi'), 
 'bbm', 850000, 'Solar + Pertamax untuk perjalanan Sukabumi-Serpong'),

((SELECT id FROM delivery_orders WHERE do_number = 'DO-250610-01'), 
 (SELECT id FROM users WHERE username = 'supir_dedi'), 
 'makan', 125000, 'Makan siang + minum di rest area'),

((SELECT id FROM delivery_orders WHERE do_number = 'DO-250610-01'), 
 (SELECT id FROM users WHERE username = 'supir_dedi'), 
 'tol', 75000, 'Tol Jagorawi + Serpong'),

-- Expenses untuk DO-250630-02
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250630-02'), 
 (SELECT id FROM users WHERE username = 'supir_dedi'), 
 'bbm', 900000, 'Solar + Pertamax untuk perjalanan kedua'),

((SELECT id FROM delivery_orders WHERE do_number = 'DO-250630-02'), 
 (SELECT id FROM users WHERE username = 'supir_dedi'), 
 'makan', 140000, 'Makan siang + snack di perjalanan'),

((SELECT id FROM delivery_orders WHERE do_number = 'DO-250630-02'), 
 (SELECT id FROM users WHERE username = 'supir_dedi'), 
 'tol', 80000, 'Tol Jagorawi + Serpong (tarif naik)'),

((SELECT id FROM delivery_orders WHERE do_number = 'DO-250630-02'), 
 (SELECT id FROM users WHERE username = 'supir_dedi'), 
 'parkir', 25000, 'Parkir di lokasi proyek');

-- 🧾 SAMPLE INVOICE DATA (opsional, untuk testing payment system)
INSERT INTO delivery_order_invoices (
  delivery_order_id,
  invoice_number,
  invoice_date,
  invoice_amount,
  due_date,
  pph_percentage,
  pph_amount,
  net_amount,
  status,
  notes,
  created_by
) VALUES
-- Invoice untuk DO-250610-01
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250610-01'),
 'INV/2025/06/010',
 '2025-06-11',
 10406250, -- Gross amount
 '2025-07-11',
 0.50, -- PPh 0.5%
 52031.25, -- PPh amount: 10,406,250 × 0.5%
 10458281.25, -- Net: 10,406,250 + 52,031.25
 'paid',
 'Invoice untuk pengiriman pasir urug batch 1',
 (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1)
 ),

-- Invoice untuk DO-250630-02
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250630-02'),
 'INV/2025/06/030',
 '2025-07-01',
 11988000, -- Gross amount
 '2025-07-31',
 0.50, -- PPh 0.5%
 59940, -- PPh amount: 11,988,000 × 0.5%
 12047940, -- Net: 11,988,000 + 59,940
 'paid',
 'Invoice untuk pengiriman pasir urug batch 2',
 (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1)
 );

-- 💸 SAMPLE PAYMENT DATA
INSERT INTO delivery_order_payments (
  delivery_order_id,
  invoice_id,
  payment_reference,
  payment_type,
  payment_amount,
  payment_date,
  notes
) VALUES
-- Payment untuk DO-250610-01
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250610-01'),
 (SELECT id FROM delivery_order_invoices WHERE invoice_number = 'INV/2025/06/010'),
 'TRF-20250615-001',
 'transfer',
 10458281.25,
 '2025-06-15',
 'Pembayaran lunas DO-250610-01 via transfer BCA'),

-- Payment untuk DO-250630-02
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250630-02'),
 (SELECT id FROM delivery_order_invoices WHERE invoice_number = 'INV/2025/06/030'),
 'TRF-20250705-002',
 'transfer',
 12047940,
 '2025-07-05',
 'Pembayaran lunas DO-250630-02 via transfer BCA');

-- 📊 PAYMENT HISTORY untuk tracking status changes
INSERT INTO delivery_order_payment_history (
  delivery_order_id,
  old_status,
  new_status,
  change_reason,
  changed_by,
  changed_at
) VALUES
-- History untuk DO-250610-01
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250610-01'),
 'proses_tagihan',
 'lunas',
 'Payment completed via transfer TRF-20250615-001',
 (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1),
 '2025-06-15 14:30:00+07'),

-- History untuk DO-250630-02
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250630-02'),
 'proses_tagihan',
 'lunas',
 'Payment completed via transfer TRF-20250705-002',
 (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1),
 '2025-07-05 16:45:00+07');
