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
((SELECT id FROM users WHERE username = 'supir_andi'), 'Andi Setiawan', '081111111111', 'Jl. Merdeka 1', '3201111111110001', '1111-1111-111111', 'B2 Umum', 'available'),
((SELECT id FROM users WHERE username = 'supir_budi'), 'Budi Santoso', '082222222222', 'Jl. Kemerdekaan 2', '3201222222220002', '2222-2222-222222', 'B2 Umum', 'available'),
((SELECT id FROM users WHERE username = 'supir_charlie'), 'Charlie Wijaya', '083333333333', 'Jl. Persatuan 3', '3201333333330003', '3333-3333-333333', 'B1', 'available'),
((SELECT id FROM users WHERE username = 'supir_dedi'), 'Dedi Gunawan', '084444444444', 'Jl. Pahlawan 4', '3201444444440004', '4444-4444-444444', 'B1', 'available'),
((SELECT id FROM users WHERE username = 'supir_eko'), 'Eko Prasetyo', '085555555555', 'Jl. Kemakmuran 5', '3201555555550005', '5555-5555-555555', 'B2 Umum', 'available'),
((SELECT id FROM users WHERE username = 'supir_yoyo'), 'Yoyo Karyo', '08101010101010', 'Jl. Ikan Sebelah no 22', '320994488009921', '5555-3344-123', 'B1', 'available');

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
((SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), 'BR-1000-003', '2024-01-10', 3200000, 15000, 7.8, 'fair', 'installed', 'Installed on B 1234 ABC RL1A'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), 'BR-1000-004', '2024-01-10', 3200000, 15000, 8.0, 'good', 'installed', 'Installed on B 1234 ABC RR1A'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), 'BR-1000-005', '2024-01-10', 3200000, 15000, 6.5, 'fair', 'installed', 'Installed on B 1234 ABC RL1B'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), 'BR-1000-006', '2024-01-10', 3200000, 15000, 6.2, 'poor', 'installed', 'Installed on B 1234 ABC RR1B'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), 'BR-1000-007', '2024-01-10', 3200000, 0, 10.0, 'new', 'in_stock', 'New tire in stock'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), 'BR-1000-008', '2024-01-10', 3200000, 0, 10.0, 'new', 'in_stock', 'New tire in stock'),

-- Dunlop 1000 R20 instances
((SELECT id FROM tire_inventory WHERE tire_brand = 'Dunlop' AND tire_size = '1000 R20'), 'DL-1000-001', '2024-01-10', 2950000, 0, 10.0, 'new', 'installed', 'Installed on B 1234 ABC SPARE1'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Dunlop' AND tire_size = '1000 R20'), 'DL-1000-002', '2024-01-10', 2950000, 0, 9.8, 'new', 'installed', 'Installed on B 1234 ABC SPARE2'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Dunlop' AND tire_size = '1000 R20'), 'DL-1000-003', '2024-01-10', 2950000, 0, 10.0, 'new', 'in_stock', 'New tire in stock'),

-- GT Radial 1000 R20 instances
((SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), 'GT-1000-001', '2024-02-05', 2100000, 25000, 5.5, 'poor', 'installed', 'Installed on B 5678 DEF FL'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), 'GT-1000-002', '2024-02-05', 2100000, 25000, 5.2, 'poor', 'installed', 'Installed on B 5678 DEF FR'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), 'GT-1000-003', '2024-02-05', 2100000, 20000, 7.0, 'fair', 'installed', 'Installed on B 5678 DEF RL1A'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), 'GT-1000-004', '2024-02-05', 2100000, 20000, 6.8, 'fair', 'installed', 'Installed on B 5678 DEF RR1A'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), 'GT-1000-005', '2024-02-05', 2100000, 18000, 8.5, 'good', 'installed', 'Installed on B 5678 DEF RL1B'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), 'GT-1000-006', '2024-02-05', 2100000, 18000, 8.2, 'good', 'installed', 'Installed on B 5678 DEF RR1B'),

-- Michelin 295/80 R22.5 instances
((SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), 'MI-295-001', '2024-02-25', 4500000, 12000, 9.2, 'good', 'installed', 'Installed on B 3456 JKL FL'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), 'MI-295-002', '2024-02-25', 4500000, 12000, 9.0, 'good', 'installed', 'Installed on B 3456 JKL FR'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), 'MI-295-003', '2024-02-25', 4500000, 12000, 8.8, 'good', 'installed', 'Installed on B 3456 JKL RL1A'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), 'MI-295-004', '2024-02-25', 4500000, 12000, 8.5, 'good', 'installed', 'Installed on B 3456 JKL RR1A'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), 'MI-295-005', '2024-02-25', 4500000, 12000, 8.2, 'good', 'installed', 'Installed on B 3456 JKL RL1B'),
((SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), 'MI-295-006', '2024-02-25', 4500000, 12000, 8.0, 'fair', 'installed', 'Installed on B 3456 JKL RR1B'),

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
('B 1234 ABC', 'Hino Dutro 130 HD', '8000', 6, 2, (SELECT id FROM users WHERE username = 'supir_andi'), 'available',
  '2024-06-01', '2024-12-01',
  'STNK-1234-2025', '2025-10-20', '2025-10-20'
),
('B 5678 DEF', 'Mitsubishi Fuso Canter', '8250', 6, 2, (SELECT id FROM users WHERE username = 'supir_budi'), 'available',
  '2024-05-15', '2024-11-15',
  'STNK-5678-2026', '2026-03-15', '2025-03-15'
),
('B 9012 GHI', 'Isuzu Elf NMR 71', '7500', 6, 1, (SELECT id FROM users WHERE username = 'supir_charlie'), 'available',
  '2024-04-10', '2024-10-10',
  'STNK-9012-2024', '2024-11-30', '2024-11-30'
),
('B 3456 JKL', 'Hino Ranger FG', '12000', 10, 2, (SELECT id FROM users WHERE username = 'supir_dedi'), 'available',
  '2024-03-20', '2024-09-20',
  'STNK-3456-2025', '2025-12-01', '2025-12-01'
),
('BE 9090 AC', 'Mitsubishi Colt Diesel', '6800', 6, 2, (SELECT id FROM users WHERE username = 'supir_yoyo'), 'available',
  '2024-02-28', '2024-08-28',
  'STNK-9090-2026', '2026-04-17', '2030-05-11'
),
('B 7890 MNO', 'Mitsubishi Colt Diesel', '7000', 6, 2, (SELECT id FROM users WHERE username = 'supir_eko'), 'available',
  '2024-01-05', '2024-07-05',
  'STNK-7890-2026', '2026-01-10', '2026-01-10'
),
('B 1122 PQR', 'Isuzu Giga', '15000', 10, 2, NULL, 'available',
  '2024-06-15', '2024-12-15',
  'STNK-1122-2025', '2025-08-20', '2025-08-20'
);

-- 7. VEHICLE TIRES (UPDATED WITH A/B DESIGNATION)
INSERT INTO vehicle_tires (vehicle_id, tire_inventory_id, tire_instance_id, position, install_date, current_pressure, recommended_pressure, tread_depth, temperature, condition, status) VALUES
-- B 1234 ABC (Hino Dutro - 6+2 tires with A/B designation)
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-001'), 'FL', '2024-01-15', 32.5, 35.0, 8.5, 28.0, 'good', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-002'), 'FR', '2024-01-15', 33.0, 35.0, 8.2, 29.0, 'good', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-003'), 'RL1A', '2024-01-15', 34.0, 35.0, 7.8, 30.0, 'fair', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-005'), 'RL1B', '2024-01-15', 32.0, 35.0, 6.5, 31.0, 'fair', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-004'), 'RR1A', '2024-01-15', 33.5, 35.0, 8.0, 29.5, 'good', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-006'), 'RR1B', '2024-01-15', 31.5, 35.0, 6.2, 32.0, 'poor', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Dunlop' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'DL-1000-001'), 'SPARE1', '2024-01-15', 35.0, 35.0, 10.0, 25.0, 'good', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Dunlop' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'DL-1000-002'), 'SPARE2', '2024-01-15', 35.0, 35.0, 9.8, 25.0, 'good', 'active'),

-- B 5678 DEF (Mitsubishi Fuso - 6+2 tires with A/B designation)
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), (SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'GT-1000-001'), 'FL', '2024-02-10', 30.0, 35.0, 5.5, 35.0, 'poor', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), (SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'GT-1000-002'), 'FR', '2024-02-10', 29.5, 35.0, 5.2, 36.0, 'poor', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), (SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'GT-1000-003'), 'RL1A', '2024-02-10', 33.0, 35.0, 7.0, 32.0, 'fair', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), (SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'GT-1000-005'), 'RL1B', '2024-02-10', 34.0, 35.0, 8.5, 30.0, 'good', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), (SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'GT-1000-004'), 'RR1A', '2024-02-10', 32.5, 35.0, 6.8, 33.0, 'fair', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), (SELECT id FROM tire_inventory WHERE tire_brand = 'GT Radial' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'GT-1000-006'), 'RR1B', '2024-02-10', 33.8, 35.0, 8.2, 31.0, 'good', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-007'), 'SPARE1', '2024-02-10', 35.0, 35.0, 10.0, 25.0, 'good', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Bridgestone' AND tire_size = '1000 R20'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-008'), 'SPARE2', '2024-02-10', 35.0, 35.0, 9.9, 25.0, 'good', 'active'),

-- B 3456 JKL (Hino Ranger - 10+2 tires with A/B designation)
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'MI-295-001'), 'FL', '2024-03-01', 36.0, 38.0, 9.2, 27.0, 'good', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'MI-295-002'), 'FR', '2024-03-01', 37.0, 38.0, 9.0, 28.0, 'good', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'MI-295-003'), 'RL1A', '2024-03-01', 35.5, 38.0, 8.8, 29.0, 'good', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'MI-295-005'), 'RL1B', '2024-03-01', 36.5, 38.0, 8.5, 30.0, 'good', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'MI-295-004'), 'RR1A', '2024-03-01', 37.5, 38.0, 8.2, 31.0, 'good', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Michelin' AND tire_size = '295/80 R22.5'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'MI-295-006'), 'RR1B', '2024-03-01', 36.8, 38.0, 8.0, 32.0, 'fair', 'active'),
-- NOTE: A 10-tire vehicle (Hino Ranger FG) should have 2 rear axles. The original seeder was missing the second axle. This should be added for correctness if needed.
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Continental' AND tire_size = '315/80 R22.5'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'CT-315-001'), 'SPARE1', '2024-03-01', 38.0, 38.0, 10.0, 25.0, 'good', 'active'),
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), (SELECT id FROM tire_inventory WHERE tire_brand = 'Continental' AND tire_size = '315/80 R22.5'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'CT-315-002'), 'SPARE2', '2024-03-01', 38.0, 38.0, 10.0, 25.0, 'good', 'active');

-- 8. TIRE INSPECTIONS (WITH TIRE INSTANCE REFERENCES)
-- Note: Reference is now to tire_instance_id in the table, which is correct.
INSERT INTO tire_inspections (vehicle_tire_id, tire_instance_id, inspection_date, tread_depth, air_pressure, temperature, condition, notes, inspector_name) VALUES
((SELECT id FROM vehicle_tires WHERE vehicle_id = (SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC') AND position = 'FL'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-001'), '2024-06-20', 8.5, 32.5, 28.0, 'good', 'Kondisi ban masih baik', 'Teknisi Ahmad'),
((SELECT id FROM vehicle_tires WHERE vehicle_id = (SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC') AND position = 'RR1B'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'BR-1000-006'), '2024-06-20', 6.2, 31.5, 32.0, 'poor', 'Ban perlu diganti segera', 'Teknisi Ahmad'),
((SELECT id FROM vehicle_tires WHERE vehicle_id = (SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF') AND position = 'FL'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'GT-1000-001'), '2024-06-22', 5.5, 30.0, 35.0, 'poor', 'Tekanan rendah, tapak tipis', 'Teknisi Budi'),
((SELECT id FROM vehicle_tires WHERE vehicle_id = (SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF') AND position = 'FR'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'GT-1000-002'), '2024-06-22', 5.2, 29.5, 36.0, 'poor', 'Perlu penggantian segera', 'Teknisi Budi'),
((SELECT id FROM vehicle_tires WHERE vehicle_id = (SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL') AND position = 'FL'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'MI-295-001'), '2024-06-24', 9.2, 36.0, 27.0, 'good', 'Ban dalam kondisi baik', 'Teknisi Charlie'),
((SELECT id FROM vehicle_tires WHERE vehicle_id = (SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL') AND position = 'RR1B'), (SELECT id FROM tire_instances WHERE tire_serial_number = 'MI-295-006'), '2024-06-24', 8.0, 36.8, 32.0, 'fair', 'Perlu monitoring', 'Teknisi Charlie');

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

-- 15. OFFICE EXPENSES
INSERT INTO office_expenses (kategori, description, amount, expense_date) VALUES
('Listrik & Internet', 'Pembayaran Tagihan Listrik Kantor Bulan September', 1500000, '2024-09-25'),
('Gaji Karyawan', 'Gaji Admin September', 4000000, '2024-09-25'),
('Operasional Kantor', 'Pembelian ATK dan Supplies Kantor', 750000, '2024-10-01'),
('Maintenance', 'Biaya maintenance AC kantor', 450000, '2024-10-15');

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

-- ===============================================
-- 🎯 NEW SEEDER: PO January 2025 + 2 Completed DOs + 3 On-Going DOs (To be created)
-- Unit: ton (weight-based pricing)
-- Driver: Dedi (supir_yoyo)
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
  'PO/ADRO/07/2025-01', 
  'PT ADARO MINERAL', 
  'Batu Split', 
  1000.00, 
  'ton', 
  11000, -- Rp 11,000 per kg
  11000000000, -- 1000 ton × Rp 11,000/kg × 1000  = Rp 11,000,000,000
  'Gunung Kunyit, Bandar Lampung',
  'Proyek Pembangunan Smelter, Serang',
  '2025-01-01',
  'partial', -- Status completed karena semua DO selesai
  'Batu Split Untuk Pembangunan Smelter'
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
  (SELECT id FROM purchase_orders WHERE po_number = 'PO/ADRO/07/2025-01'),
  (SELECT id FROM users WHERE username = 'supir_yoyo'),
  (SELECT id FROM vehicles WHERE license_plate = 'BE 9090 AC'),
  'DO-250110-01',
  'PT ADARO MINERALS',
  'BATU SPLIT',
  45.00, -- Target: 45 ton
  45.25, -- Actual: 45.25 ton (slight excess)
  'ton',
  11000, -- Rp 11,000 per kg
  497750000, -- 45.25 ton × Rp 11,000/kg × 1,000 = Rp 497,750,000
  'lunas',
  '2025-03-10',
  'Quarry Sukabumi, Jawa Barat',
  -6.9175, 106.9270, -- Sukabumi coordinates
  'Proyek Perumahan Serpong, Tangerang Selatan',
  -6.2615, 106.6900, -- Serpong coordinates
  'completed',
  '2025-01-10 06:00:00+07', -- Berangkat pagi
  '2025-01-10 09:30:00+07', -- Sampai lokasi muat
  '2025-01-10 11:00:00+07', -- Selesai muat
  '2025-01-10 14:30:00+07', -- Sampai lokasi bongkar
  '2025-01-10 16:00:00+07', -- Selesai bongkar
  '2025-01-10 18:00:00+07', -- Selesai trip
  2500000, -- Uang jalan Rp 2,500,000
  700000,  -- Gaji Rp 700,000
  494550000, -- Ongkosan: 497,750,000 - 2,500,000 - 700,000 = 494,550,000
  '{uploads/surat_jalan/DO-250610-01-surat-jalan.jpg}',
  'confirmed',
  '2025-01-09 15:00:00+07' -- DO dibuat sehari sebelumnya
),

-- 🚛 DELIVERY ORDER 2 (Completed: 30 Juni 2025)
(
  (SELECT id FROM purchase_orders WHERE po_number = 'PO/ADRO/07/2025-01'),
  (SELECT id FROM users WHERE username = 'supir_yoyo'),
  (SELECT id FROM vehicles WHERE license_plate = 'BE 9090 AC'),
  'DO-250129-02',
  'PT ADARO MINERALS',
  'Batu Split',
  65.00, -- Target: 65 ton
  64.75, -- Actual: 64.75 ton (slight shortage)
  'ton',
  11000, -- Rp 11,000 per kg
  712250000, -- 64.75 ton × Rp 11,000/kg × 1,000 = Rp 712,250,000
  'lunas',
  '2025-02-10',
  'Quarry Sukabumi, Jawa Barat',
  -6.9175, 106.9270, -- Sukabumi coordinates
  'Proyek Perumahan Serpong, Tangerang Selatan',
  -6.2615, 106.6900, -- Serpong coordinates
  'completed',
  '2025-01-30 05:30:00+07', -- Berangkat lebih pagi
  '2025-01-30 09:00:00+07', -- Sampai lokasi muat
  '2025-01-30 10:30:00+07', -- Selesai muat
  '2025-01-30 14:00:00+07', -- Sampai lokasi bongkar
  '2025-01-30 15:30:00+07', -- Selesai bongkar
  '2025-01-30 17:30:00+07', -- Selesai trip
  2300000, -- Uang jalan Rp 2,300,000 (sedikit lebih mahal)
  650000,  -- Gaji Rp 650,000
  709300000, -- Ongkosan: 712,250,000 - 2,300,000 - 650,000 = 9,038,000
  '{uploads/surat_jalan/DO-250630-02-surat-jalan.jpg}',
  'confirmed',
  '2025-01-29 16:00:00+07' -- DO dibuat sehari sebelumnya
);

-- 💰 DRIVER EXPENSES untuk kedua DO
INSERT INTO driver_expenses (delivery_order_id, driver_id, jenis, amount, notes) VALUES
-- Expenses untuk DO-250110-01
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250110-01'), 
 (SELECT id FROM users WHERE username = 'supir_yoyo'), 
 'bbm', 850000, 'Solar + Pertamax untuk perjalanan'),

((SELECT id FROM delivery_orders WHERE do_number = 'DO-250110-01'), 
 (SELECT id FROM users WHERE username = 'supir_yoyo'), 
 'makan', 125000, 'Makan siang + minum di rest area'),

((SELECT id FROM delivery_orders WHERE do_number = 'DO-250110-01'), 
 (SELECT id FROM users WHERE username = 'supir_yoyo'), 
 'tol', 75000, 'Tol Jagorawi + Serpong'),

-- Expenses untuk DO-250129-02
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250129-02'), 
 (SELECT id FROM users WHERE username = 'supir_yoyo'), 
 'bbm', 900000, 'Solar + Pertamax untuk perjalanan kedua'),

((SELECT id FROM delivery_orders WHERE do_number = 'DO-250129-02'), 
 (SELECT id FROM users WHERE username = 'supir_yoyo'), 
 'makan', 140000, 'Makan siang + snack di perjalanan'),

((SELECT id FROM delivery_orders WHERE do_number = 'DO-250129-02'), 
 (SELECT id FROM users WHERE username = 'supir_dedi'), 
 'tol', 80000, 'Tol Jagorawi + Serpong (tarif naik)'),

((SELECT id FROM delivery_orders WHERE do_number = 'DO-250129-02'), 
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
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250110-01'),
 'INV/2025/01/010',
 '2025-01-11',
 497750000, -- Gross amount
 '2025-03-11',
 0.50, -- PPh 0.5%
 2488750, -- PPh amount: 497,750,000 × 0.5%
 500238750, -- Net: 497,750,000 + 2,488,750
 'paid',
 'Invoice untuk pengiriman batu split batch 1',
 (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1)
 ),

-- Invoice untuk DO-250129-02
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250129-02'),
 'INV/2025/01/029',
 '2025-01-30',
 712250000, -- Gross amount
 '2025-05-30',
 0.50, -- PPh 0.5%
 3561250, -- PPh amount: 712,250,000 × 0.5%
 715811250, -- Net: 712,250,000 + 3,561,250
 'paid',
 'Invoice untuk pengiriman batu split batch 2',
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
-- Payment untuk DO-250110-01
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250110-01'),
 (SELECT id FROM delivery_order_invoices WHERE invoice_number = 'INV/2025/01/010'),
 'TRF-20250115-001',
 'transfer',
 500238750,
 '2025-01-15',
 'Pembayaran lunas DO-250110-01 via transfer BCA'),

-- Payment untuk DO-250129-02
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250129-02'),
 (SELECT id FROM delivery_order_invoices WHERE invoice_number = 'INV/2025/01/029'),
 'TRF-20250205-002',
 'transfer',
 715811250,
 '2025-02-05',
 'Pembayaran lunas DO-250129-02 via transfer BCA');

-- 📊 PAYMENT HISTORY untuk tracking status changes
INSERT INTO delivery_order_payment_history (
  delivery_order_id,
  old_status,
  new_status,
  change_reason,
  changed_by,
  changed_at
) VALUES
-- History untuk DO-250110-01
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250110-01'),
 'proses_tagihan',
 'lunas',
 'Payment completed via transfer TRF-20250115-001',
 (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1),
 '2025-01-15 11:30:00+07'),

-- History untuk DO-250129-02
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250129-02'),
 'proses_tagihan',
 'lunas',
 'Payment completed via transfer TRF-20250205-002',
 (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1),
 '2025-02-05 13:44:00+07');

 -- =====================================================
-- 🎯 COMPREHENSIVE PAYMENT TESTING SEEDER
-- Contract: 1700 ton @ Rp 200/kg = Rp 340,000,000
-- Date: July 10, 2025
-- =====================================================

BEGIN;

-- 1️⃣ CREATE PURCHASE ORDER (CORRECTED)
INSERT INTO purchase_orders (
  po_number, customer_name, item_name, total_quantity, unit, unit_price, total_amount,
  load_location, unload_location, order_date, status, notes, created_at
) VALUES (
  'PO/TESTING/07/2025-001',
  'PT MAJU SEJAHTERA TESTING',
  'Pasir Silika',
  '1700.00', -- 1700 ton
  'ton',
  '200000.00', -- Rp 200 per kg = Rp 200,000 per ton
  '340000000.00', -- 1700 ton x Rp 200,000 = Rp 340M
  'Quarry Cilegon, Banten',
  'Pabrik Kaca Tangerang, Banten', 
  '2025-07-01',
  'partial',
  'Testing data untuk sistem payment - BIG CONTRACT 1700 ton!',
  '2025-07-01 08:00:00+07'
);

-- 2️⃣ DELIVERY ORDERS WITH REALISTIC QUANTITIES

-- DO #1: COMPLETED - Ready for Invoice (Andi) - 300 ton
INSERT INTO delivery_orders (
  purchase_order_id, driver_id, vehicle_id, do_number, customer_name, item_name,
  minimal_load_quantity, actual_load_quantity, unit, unit_price, total_amount,
  trip_allowance, gaji, ongkosan, final_amount,
  load_location, unload_location, 
  payment_status, status, 
  created_at, departed_to_load_location_at, arrived_at_load_location_at,
  departed_from_load_location_at, arrived_at_unload_location_at, 
  departed_from_unload_location_at, completed_at
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO/TESTING/07/2025-001'),
  (SELECT id FROM users WHERE username = 'supir_andi'),
  (SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'),
  'DO-20250702-ANDI-001',
  'PT MAJU SEJAHTERA TESTING',
  'Pasir Silika',
  '300.00', -- 300 ton
  '305.50', -- actual: 305.5 ton (overload)
  'ton',
  '200000.00', -- Rp 200k per ton
  '61100000.00', -- 305.5 ton x Rp 200k = Rp 61.1M
  '3500000.00', -- Trip allowance 3.5M
  '1200000.00', -- Driver salary 1.2M
  '56400000.00', -- Net after costs
  '61100000.00',
  'Quarry Cilegon, Banten',
  'Pabrik Kaca Tangerang, Banten',
  'proses_tagihan', -- ✅ Ready for invoice
  'completed',
  '2025-07-02 06:00:00+07',
  '2025-07-02 06:30:00+07',
  '2025-07-02 08:00:00+07',
  '2025-07-02 09:30:00+07',
  '2025-07-02 16:00:00+07',
  '2025-07-02 16:30:00+07',
  '2025-07-02 17:00:00+07'
);

-- DO #2: COMPLETED with FULL PAYMENT CYCLE (Budi) - 280 ton
INSERT INTO delivery_orders (
  purchase_order_id, driver_id, vehicle_id, do_number, customer_name, item_name,
  minimal_load_quantity, actual_load_quantity, unit, unit_price, total_amount,
  trip_allowance, gaji, ongkosan, final_amount,
  load_location, unload_location,
  payment_status, status,
  created_at, departed_to_load_location_at, arrived_at_load_location_at,
  departed_from_load_location_at, arrived_at_unload_location_at,
  departed_from_unload_location_at, completed_at
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO/TESTING/07/2025-001'),
  (SELECT id FROM users WHERE username = 'supir_budi'),
  (SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'),
  'DO-20250703-BUDI-002',
  'PT MAJU SEJAHTERA TESTING',
  'Pasir Silika',
  '280.00', -- 280 ton
  '278.25', -- actual: 278.25 ton (slightly under)
  'ton',
  '200000.00',
  '55650000.00', -- 278.25 ton x Rp 200k = Rp 55.65M
  '3300000.00',
  '1150000.00',
  '51200000.00',
  '55650000.00',
  'Quarry Cilegon, Banten',
  'Pabrik Kaca Tangerang, Banten',
  'lunas', -- ✅ Fully paid
  'completed',
  '2025-07-03 06:00:00+07',
  '2025-07-03 06:45:00+07',
  '2025-07-03 08:15:00+07',
  '2025-07-03 10:00:00+07',
  '2025-07-03 17:30:00+07',
  '2025-07-03 18:00:00+07',
  '2025-07-03 18:30:00+07'
);

-- Invoice for DO #2
INSERT INTO delivery_order_invoices (
  delivery_order_id, invoice_number, invoice_date, invoice_amount, due_date,
  pph_percentage, pph_amount, net_amount, status, notes, created_by, created_at
) VALUES (
  (SELECT id FROM delivery_orders WHERE do_number = 'DO-20250703-BUDI-002'),
  'INV/TEST/2025/07/002',
  '2025-07-04',
  '55650000.00',
  '2025-08-03', -- 30 days
  '0.50',
  '278250.00', -- 0.5% of 55.65M
  '55371750.00', -- invoice_amount - pph_amount
  'paid',
  'Testing invoice - paid in full untuk 278.25 ton',
  1,
  '2025-07-04 10:00:00+07'
);

-- Payment for DO #2
INSERT INTO delivery_order_payments (
  delivery_order_id, invoice_id, payment_reference, payment_type, payment_amount,
  payment_date, received_by, bank_account, notes, created_by, created_at
) VALUES (
  (SELECT id FROM delivery_orders WHERE do_number = 'DO-20250703-BUDI-002'),
  (SELECT id FROM delivery_order_invoices WHERE invoice_number = 'INV/TEST/2025/07/002'),
  'TRF-TEST-20250705-001',
  'transfer',
  '55371750.00', -- full net amount
  '2025-07-05',
  1,
  'BCA 1234567890',
  'Testing payment - transfer lunas 55.37M',
  1,
  '2025-07-05 14:00:00+07'
);

-- DO #3: HAS INVOICE but UNPAID (Charlie) - 250 ton
INSERT INTO delivery_orders (
  purchase_order_id, driver_id, vehicle_id, do_number, customer_name, item_name,
  minimal_load_quantity, actual_load_quantity, unit, unit_price, total_amount,
  trip_allowance, gaji, ongkosan, final_amount,
  load_location, unload_location,
  payment_status, status,
  created_at, departed_to_load_location_at, arrived_at_load_location_at,
  departed_from_load_location_at, arrived_at_unload_location_at,
  departed_from_unload_location_at, completed_at
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO/TESTING/07/2025-001'),
  (SELECT id FROM users WHERE username = 'supir_charlie'),
  (SELECT id FROM vehicles WHERE license_plate = 'B 9012 GHI'),
  'DO-20250704-CHARLIE-003',
  'PT MAJU SEJAHTERA TESTING',
  'Pasir Silika',
  '250.00', -- 250 ton
  '252.75', -- actual: 252.75 ton
  'ton',
  '200000.00',
  '50550000.00', -- 252.75 ton x Rp 200k = Rp 50.55M
  '3000000.00',
  '1100000.00',
  '46450000.00',
  '50550000.00',
  'Quarry Cilegon, Banten',
  'Pabrik Kaca Tangerang, Banten',
  'proses_tagihan', -- ✅ Has invoice but unpaid
  'completed',
  '2025-07-04 06:30:00+07',
  '2025-07-04 07:00:00+07',
  '2025-07-04 08:30:00+07',
  '2025-07-04 10:15:00+07',
  '2025-07-04 18:00:00+07',
  '2025-07-04 18:30:00+07',
  '2025-07-04 19:00:00+07'
);

-- Invoice for DO #3 (UNPAID)
INSERT INTO delivery_order_invoices (
  delivery_order_id, invoice_number, invoice_date, invoice_amount, due_date,
  pph_percentage, pph_amount, net_amount, status, notes, created_by, created_at
) VALUES (
  (SELECT id FROM delivery_orders WHERE do_number = 'DO-20250704-CHARLIE-003'),
  'INV/TEST/2025/07/003',
  '2025-07-06',
  '50550000.00',
  '2025-08-05',
  '0.50',
  '252750.00', -- 0.5% of 50.55M
  '50297250.00',
  'sent', -- ✅ Invoice sent but not paid yet
  'Testing invoice - awaiting payment 50.3M',
  1,
  '2025-07-06 09:00:00+07'
);

-- DO #4: COMPLETED - Ready for Invoice (Dedi) - 200 ton
INSERT INTO delivery_orders (
  purchase_order_id, driver_id, vehicle_id, do_number, customer_name, item_name,
  minimal_load_quantity, actual_load_quantity, unit, unit_price, total_amount,
  trip_allowance, gaji, ongkosan, final_amount,
  load_location, unload_location,
  payment_status, status,
  created_at, departed_to_load_location_at, arrived_at_load_location_at,
  departed_from_load_location_at, arrived_at_unload_location_at,
  departed_from_unload_location_at, completed_at
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO/TESTING/07/2025-001'),
  (SELECT id FROM users WHERE username = 'supir_dedi'),
  (SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'),
  'DO-20250705-DEDI-004',
  'PT MAJU SEJAHTERA TESTING',
  'Pasir Silika',
  '200.00', -- 200 ton
  '198.50', -- actual: 198.5 ton (slightly under)
  'ton',
  '200000.00',
  '39700000.00', -- 198.5 ton x Rp 200k = Rp 39.7M
  '2800000.00',
  '1000000.00',
  '35900000.00',
  '39700000.00',
  'Quarry Cilegon, Banten',
  'Pabrik Kaca Tangerang, Banten',
  'proses_tagihan', -- ✅ Ready for invoice
  'completed',
  '2025-07-05 05:30:00+07',
  '2025-07-05 06:00:00+07',
  '2025-07-05 07:45:00+07',
  '2025-07-05 09:30:00+07',
  '2025-07-05 17:15:00+07',
  '2025-07-05 17:45:00+07',
  '2025-07-05 18:15:00+07'
);

-- DO #5: COMPLETED with PARTIAL PAYMENT (Yoyo) - 320 ton
INSERT INTO delivery_orders (
  purchase_order_id, driver_id, vehicle_id, do_number, customer_name, item_name,
  minimal_load_quantity, actual_load_quantity, unit, unit_price, total_amount,
  trip_allowance, gaji, ongkosan, final_amount,
  load_location, unload_location,
  payment_status, status,
  created_at, departed_to_load_location_at, arrived_at_load_location_at,
  departed_from_load_location_at, arrived_at_unload_location_at,
  departed_from_unload_location_at, completed_at
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO/TESTING/07/2025-001'),
  (SELECT id FROM users WHERE username = 'supir_yoyo'),
  (SELECT id FROM vehicles WHERE license_plate = 'BE 9090 AC'),
  'DO-20250706-YOYO-005',
  'PT MAJU SEJAHTERA TESTING',
  'Pasir Silika',
  '320.00', -- 320 ton
  '315.80', -- actual: 315.8 ton
  'ton',
  '200000.00',
  '63160000.00', -- 315.8 ton x Rp 200k = Rp 63.16M
  '3600000.00',
  '1300000.00',
  '58260000.00',
  '63160000.00',
  'Quarry Cilegon, Banten',
  'Pabrik Kaca Tangerang, Banten',
  'deposit', -- ✅ Partial payment received
  'completed',
  '2025-07-06 06:15:00+07',
  '2025-07-06 06:45:00+07',
  '2025-07-06 08:00:00+07',
  '2025-07-06 09:45:00+07',
  '2025-07-06 18:30:00+07',
  '2025-07-06 19:00:00+07',
  '2025-07-06 19:30:00+07'
);

-- Invoice for DO #5
INSERT INTO delivery_order_invoices (
  delivery_order_id, invoice_number, invoice_date, invoice_amount, due_date,
  pph_percentage, pph_amount, net_amount, status, notes, created_by, created_at
) VALUES (
  (SELECT id FROM delivery_orders WHERE do_number = 'DO-20250706-YOYO-005'),
  'INV/TEST/2025/07/005',
  '2025-07-07',
  '63160000.00',
  '2025-08-06',
  '0.50',
  '315800.00', -- 0.5% of 63.16M
  '62844200.00',
  'issued',
  'Testing invoice - partial payment 315.8 ton',
  1,
  '2025-07-07 11:00:00+07'
);

-- Partial payment for DO #5 (50% payment)
INSERT INTO delivery_order_payments (
  delivery_order_id, invoice_id, payment_reference, payment_type, payment_amount,
  payment_date, received_by, bank_account, notes, created_by, created_at
) VALUES (
  (SELECT id FROM delivery_orders WHERE do_number = 'DO-20250706-YOYO-005'),
  (SELECT id FROM delivery_order_invoices WHERE invoice_number = 'INV/TEST/2025/07/005'),
  'TRF-TEST-20250708-002',
  'transfer',
  '30000000.00', -- partial: 30M out of 62.84M (48% payment)
  '2025-07-08',
  1,
  'BCA 1234567890',
  'Testing partial payment - masih kurang 32.84M',
  1,
  '2025-07-08 16:00:00+07'
);

-- DO #6: ONGOING - At Unload Location (Eko) - 350 ton ✅ This makes Eko BUSY
INSERT INTO delivery_orders (
  purchase_order_id, driver_id, vehicle_id, do_number, customer_name, item_name,
  minimal_load_quantity, actual_load_quantity, unit, unit_price, total_amount,
  trip_allowance, gaji, ongkosan, final_amount,
  load_location, unload_location,
  payment_status, status,
  created_at, departed_to_load_location_at, arrived_at_load_location_at,
  departed_from_load_location_at, arrived_at_unload_location_at
  -- Note: No completed_at, departed_from_unload_location_at - still ongoing
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO/TESTING/07/2025-001'),
  (SELECT id FROM users WHERE username = 'supir_eko'),
  (SELECT id FROM vehicles WHERE license_plate = 'B 7890 MNO'),
  'DO-20250709-EKO-006',
  'PT MAJU SEJAHTERA TESTING',
  'Pasir Silika',
  '350.00', -- 350 ton
  NULL, -- ongoing, belum ada actual quantity
  'ton',
  '200000.00',
  '70000000.00', -- 350 ton x Rp 200k (estimated)
  '4000000.00',
  '1400000.00',
  '64600000.00',
  '70000000.00',
  'Quarry Cilegon, Banten',
  'Pabrik Kaca Tangerang, Banten',
  'awaiting_confirmation', -- ✅ Still ongoing
  'at_unload_location', -- ✅ Currently at unload location
  '2025-07-09 05:45:00+07',
  '2025-07-09 06:15:00+07',
  '2025-07-09 07:30:00+07',
  '2025-07-09 09:15:00+07',
  '2025-07-09 11:45:00+07' -- Arrived at unload, still there
);

-- 3️⃣ UPDATE DRIVER & VEHICLE STATUS
-- Set Eko and his vehicle to BUSY (ongoing delivery)
UPDATE driver_profiles
SET status = 'busy'
WHERE user_id = (SELECT id FROM users WHERE username = 'supir_eko');
UPDATE vehicles SET status = 'in_use' WHERE license_plate = 'B 7890 MNO';

-- 4️⃣ ADD SOME SYSTEM SETTINGS (if not exist)
INSERT INTO system_settings (setting_key, setting_value, data_type, description) VALUES
('default_pph_percentage', '0.5', 'number', 'Default PPH percentage for invoices')
ON CONFLICT (setting_key) DO NOTHING;

COMMIT;

-- =====================================================
-- 🎯 TESTING DATA SUMMARY (CORRECTED)
-- =====================================================
-- PO: PO/TESTING/07/2025-001 (1700 ton @ Rp 200k/ton = Rp 340M)
--
-- DO States:
-- ✅ DO-20250702-ANDI-001    (305.5 ton) - Ready for invoice (Rp 61.1M)
-- ✅ DO-20250703-BUDI-002    (278.25 ton) - Fully paid (Rp 55.65M)
-- ✅ DO-20250704-CHARLIE-003 (252.75 ton) - Has invoice, unpaid (Rp 50.55M)
-- ✅ DO-20250705-DEDI-004    (198.5 ton) - Ready for invoice (Rp 39.7M)
-- ✅ DO-20250706-YOYO-005    (315.8 ton) - Partial payment (30M/62.84M)
-- ✅ DO-20250709-EKO-006     (350 ton) - ONGOING (Eko = BUSY)
--
-- Total actual delivered: 1,350.8 ton (target: 1700 ton) = 79.5% complete
-- Total estimated final: 1,700.8 ton = 100.05% ✓
-- Total contract value: ~Rp 340M
-- Total invoiced: Rp 230.14M
-- Total paid: Rp 85.37M
-- Outstanding: Rp 144.77M
-- =====================================================
