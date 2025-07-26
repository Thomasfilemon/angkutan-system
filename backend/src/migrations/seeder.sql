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

-- 1. Create stock categories FIRST
INSERT INTO stock_categories (category_name, description) VALUES
('Oli & Pelumas', 'Oli mesin, oli transmisi, dan pelumas lainnya'),
('Filter', 'Filter oli, filter solar, filter udara'),
('Spare Parts', 'Suku cadang kendaraan'),
('Bahan Bakar & Aditif', 'Solar, bensin, dan aditif'),
('Sistem Rem', 'Kampas rem, minyak rem, dan komponen rem lainnya'),
('Ban & Velg', 'Ban, velg, dan aksesoris roda');

-- 2. Create stock items SECOND (without current_stock - calculated from batches)
INSERT INTO stock_items (category_id, item_code, item_name, supplier, unit, min_stock, average_unit_price, total_value, notes) VALUES
-- Oli & Pelumas
((SELECT id FROM stock_categories WHERE category_name = 'Oli & Pelumas'), 'OLI-001', 'Oli Mesin Meditran SX SAE 15W-40', 'PT Pertamina Lubricants', 'Liter', 20, 0, 0, 'Oli mesin untuk truck diesel'),
((SELECT id FROM stock_categories WHERE category_name = 'Oli & Pelumas'), 'OLI-002', 'Oli Transmisi ATF Dexron III', 'PT Shell Indonesia', 'Liter', 10, 0, 0, 'Oli transmisi otomatis'),
-- Filter
((SELECT id FROM stock_categories WHERE category_name = 'Filter'), 'FLT-001', 'Filter Solar Hino Dutro', 'Hino Motors', 'Pcs', 5, 0, 0, 'Filter solar original Hino'),
((SELECT id FROM stock_categories WHERE category_name = 'Filter'), 'FLT-002', 'Filter Oli Mitsubishi Fuso', 'Mitsubishi Motors', 'Pcs', 5, 0, 0, 'Filter oli original Mitsubishi'),
-- Spare Parts
((SELECT id FROM stock_categories WHERE category_name = 'Spare Parts'), 'SPR-001', 'Busi Iridium NGK', 'NGK Spark Plugs', 'Pcs', 8, 0, 0, 'Busi iridium untuk mesin bensin'),
((SELECT id FROM stock_categories WHERE category_name = 'Spare Parts'), 'SPR-002', 'V-Belt Fan Belt', 'Gates Corporation', 'Pcs', 3, 0, 0, 'V-belt untuk kipas radiator'),
-- Bahan Bakar & Aditif
((SELECT id FROM stock_categories WHERE category_name = 'Bahan Bakar & Aditif'), 'FUL-002', 'Aditif Solar STP', 'STP Corporation', 'Botol', 10, 0, 0, 'Aditif untuk solar'),
-- Sistem Rem
((SELECT id FROM stock_categories WHERE category_name = 'Sistem Rem'), 'BRK-001', 'Kampas Rem Depan Hino', 'Hino Motors', 'Set', 5, 0, 0, 'Kampas rem original Hino'),
((SELECT id FROM stock_categories WHERE category_name = 'Sistem Rem'), 'BRK-002', 'Minyak Rem DOT 4', 'Shell Indonesia', 'Botol', 8, 0, 0, 'Minyak rem DOT 4');

-- 3. Create FIFO batches THIRD (now stock_items exist)
INSERT INTO stock_batches (item_id, batch_number, quantity, original_quantity, unit_price, purchase_date, supplier, notes) VALUES
-- OLI-001: Multiple batches with different prices and dates
((SELECT id FROM stock_items WHERE item_code = 'OLI-001'), 'OLI-001-20240101-001', 50.00, 50.00, 52000, '2024-01-01', 'PT Pertamina Lubricants', 'Batch pertama - harga lama'),
((SELECT id FROM stock_items WHERE item_code = 'OLI-001'), 'OLI-001-20240201-001', 60.00, 60.00, 55000, '2024-02-01', 'PT Pertamina Lubricants', 'Batch kedua - harga naik'),
((SELECT id FROM stock_items WHERE item_code = 'OLI-001'), 'OLI-001-20240301-001', 22.00, 30.00, 58000, '2024-03-01', 'PT Pertamina Lubricants', 'Batch ketiga - harga naik lagi, sudah dipakai 8 liter'),

-- OLI-002: Single batch
((SELECT id FROM stock_items WHERE item_code = 'OLI-002'), 'OLI-002-20240115-001', 25.00, 25.00, 75000, '2024-01-15', 'PT Shell Indonesia', 'Batch pertama oli transmisi'),

-- FLT-001: Multiple batches showing price changes
((SELECT id FROM stock_items WHERE item_code = 'FLT-001'), 'FLT-001-20240110-001', 8.00, 15.00, 115000, '2024-01-10', 'Hino Motors', 'Batch pertama - 7 sudah dipakai'),
((SELECT id FROM stock_items WHERE item_code = 'FLT-001'), 'FLT-001-20240220-001', 11.00, 12.00, 125000, '2024-02-20', 'Hino Motors', 'Batch kedua - harga naik, 1 sudah dipakai'),

-- FLT-002: Single batch
((SELECT id FROM stock_items WHERE item_code = 'FLT-002'), 'FLT-002-20240105-001', 14.00, 14.00, 95000, '2024-01-05', 'Mitsubishi Motors', 'Batch pertama filter oli'),

-- SPR-001: Multiple batches
((SELECT id FROM stock_items WHERE item_code = 'SPR-001'), 'SPR-001-20240120-001', 12.00, 20.00, 42000, '2024-01-20', 'NGK Spark Plugs', 'Batch pertama - 8 sudah dipakai'),
((SELECT id FROM stock_items WHERE item_code = 'SPR-001'), 'SPR-001-20240315-001', 8.00, 10.00, 48000, '2024-03-15', 'NGK Spark Plugs', 'Batch kedua - harga naik, 2 sudah dipakai'),

-- SPR-002: Single batch
((SELECT id FROM stock_items WHERE item_code = 'SPR-002'), 'SPR-002-20240125-001', 8.00, 8.00, 180000, '2024-01-25', 'Gates Corporation', 'Batch pertama V-belt'),

-- FUL-002: Single batch
((SELECT id FROM stock_items WHERE item_code = 'FUL-002'), 'FUL-002-20240201-001', 15.00, 15.00, 85000, '2024-02-01', 'STP Corporation', 'Batch pertama aditif solar'),

-- BRK-001: Single batch
((SELECT id FROM stock_items WHERE item_code = 'BRK-001'), 'BRK-001-20240215-001', 6.00, 6.00, 850000, '2024-02-15', 'Hino Motors', 'Batch pertama kampas rem'),

-- BRK-002: Single batch
((SELECT id FROM stock_items WHERE item_code = 'BRK-002'), 'BRK-002-20240220-001', 12.00, 12.00, 125000, '2024-02-20', 'Shell Indonesia', 'Batch pertama minyak rem');

-- 4. Update stock_items with calculated values FOURTH
UPDATE stock_items SET 
    average_unit_price = (
        SELECT COALESCE(SUM(quantity * unit_price) / NULLIF(SUM(quantity), 0), 0)
        FROM stock_batches 
        WHERE stock_batches.item_id = stock_items.id
    ),
    total_value = (
        SELECT COALESCE(SUM(quantity * unit_price), 0)
        FROM stock_batches 
        WHERE stock_batches.item_id = stock_items.id
    );

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


-- 13. STOCK TRANSACTIONS
-- 5. Create stock transactions LAST (now everything exists) - CORRECTED FORMAT
INSERT INTO stock_transactions (item_id, batch_id, transaction_type, quantity, unit_price, total_amount, reference_type, reference_id, notes, transaction_date) VALUES
-- OLI-001 transactions
((SELECT id FROM stock_items WHERE item_code = 'OLI-001'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'OLI-001-20240101-001'), 
 'in', 50.00, 52000, 2600000, 'initial_stock', NULL, 'Pembelian batch pertama', '2024-01-01'),

((SELECT id FROM stock_items WHERE item_code = 'OLI-001'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'OLI-001-20240201-001'), 
 'in', 60.00, 55000, 3300000, 'initial_stock', NULL, 'Pembelian batch kedua', '2024-02-01'),

((SELECT id FROM stock_items WHERE item_code = 'OLI-001'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'OLI-001-20240301-001'), 
 'in', 30.00, 58000, 1740000, 'initial_stock', NULL, 'Pembelian batch ketiga', '2024-03-01'),

-- Usage from oldest batch first (FIFO)
((SELECT id FROM stock_items WHERE item_code = 'OLI-001'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'OLI-001-20240301-001'), 
 'out', 8.00, 58000, 464000, 'service', NULL, 'Digunakan untuk service kendaraan', '2024-03-15'),

-- FLT-001 transactions
((SELECT id FROM stock_items WHERE item_code = 'FLT-001'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'FLT-001-20240110-001'), 
 'in', 15.00, 115000, 1725000, 'initial_stock', NULL, 'Pembelian batch pertama', '2024-01-10'),

((SELECT id FROM stock_items WHERE item_code = 'FLT-001'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'FLT-001-20240110-001'), 
 'out', 7.00, 115000, 805000, 'service', NULL, 'Digunakan untuk service - FIFO dari batch terlama', '2024-01-25'),

((SELECT id FROM stock_items WHERE item_code = 'FLT-001'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'FLT-001-20240220-001'), 
 'in', 12.00, 125000, 1500000, 'initial_stock', NULL, 'Pembelian batch kedua', '2024-02-20'),

((SELECT id FROM stock_items WHERE item_code = 'FLT-001'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'FLT-001-20240220-001'), 
 'out', 1.00, 125000, 125000, 'service', NULL, 'Digunakan untuk service', '2024-02-25'),

-- FLT-002 transactions
((SELECT id FROM stock_items WHERE item_code = 'FLT-002'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'FLT-002-20240105-001'), 
 'in', 14.00, 95000, 1330000, 'initial_stock', NULL, 'Pembelian batch pertama', '2024-01-05'),

-- SPR-001 transactions
((SELECT id FROM stock_items WHERE item_code = 'SPR-001'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'SPR-001-20240120-001'), 
 'in', 20.00, 42000, 840000, 'initial_stock', NULL, 'Pembelian batch pertama', '2024-01-20'),

((SELECT id FROM stock_items WHERE item_code = 'SPR-001'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'SPR-001-20240120-001'), 
 'out', 8.00, 42000, 336000, 'service', NULL, 'Digunakan untuk service - FIFO', '2024-02-10'),

((SELECT id FROM stock_items WHERE item_code = 'SPR-001'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'SPR-001-20240315-001'), 
 'in', 10.00, 48000, 480000, 'initial_stock', NULL, 'Pembelian batch kedua', '2024-03-15'),

((SELECT id FROM stock_items WHERE item_code = 'SPR-001'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'SPR-001-20240315-001'), 
 'out', 2.00, 48000, 96000, 'service', NULL, 'Digunakan untuk service', '2024-03-20'),

-- SPR-002 transactions
((SELECT id FROM stock_items WHERE item_code = 'SPR-002'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'SPR-002-20240125-001'), 
 'in', 8.00, 180000, 1440000, 'initial_stock', NULL, 'Pembelian batch pertama', '2024-01-25'),

-- FUL-002 transactions
((SELECT id FROM stock_items WHERE item_code = 'FUL-002'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'FUL-002-20240201-001'), 
 'in', 15.00, 85000, 1275000, 'initial_stock', NULL, 'Pembelian batch pertama', '2024-02-01'),

-- BRK-001 transactions
((SELECT id FROM stock_items WHERE item_code = 'BRK-001'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'BRK-001-20240215-001'), 
 'in', 6.00, 850000, 5100000, 'initial_stock', NULL, 'Pembelian batch pertama', '2024-02-15'),

-- BRK-002 transactions
((SELECT id FROM stock_items WHERE item_code = 'BRK-002'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'BRK-002-20240220-001'), 
 'in', 12.00, 125000, 1500000, 'initial_stock', NULL, 'Pembelian batch pertama', '2024-02-20'),

-- Service-related stock movements (with proper batch references)
((SELECT id FROM stock_items WHERE item_code = 'OLI-001'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'OLI-001-20240101-001'), 
 'out', 10.00, 52000, 520000, 'service', 
 (SELECT id FROM vehicle_services WHERE service_number = 'SRV-20240715-001'), 
 'Digunakan untuk servis B 1234 ABC', '2024-07-15'),

((SELECT id FROM stock_items WHERE item_code = 'FLT-002'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'FLT-002-20240105-001'), 
 'out', 1.00, 95000, 95000, 'service', 
 (SELECT id FROM vehicle_services WHERE service_number = 'SRV-20240715-001'), 
 'Digunakan untuk servis B 1234 ABC', '2024-07-15'),

((SELECT id FROM stock_items WHERE item_code = 'FLT-001'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'FLT-001-20240110-001'), 
 'out', 1.00, 115000, 115000, 'service', 
 (SELECT id FROM vehicle_services WHERE service_number = 'SRV-20240820-001'), 
 'Digunakan untuk servis B 5678 DEF', '2024-08-20'),

((SELECT id FROM stock_items WHERE item_code = 'OLI-001'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'OLI-001-20240201-001'), 
 'out', 8.00, 55000, 440000, 'service', 
 (SELECT id FROM vehicle_services WHERE service_number = 'SRV-20240820-001'), 
 'Digunakan untuk servis B 5678 DEF', '2024-08-20'),

((SELECT id FROM stock_items WHERE item_code = 'FUL-002'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'FUL-002-20240201-001'), 
 'out', 1.00, 85000, 85000, 'service', 
 (SELECT id FROM vehicle_services WHERE service_number = 'SRV-20240820-001'), 
 'Digunakan untuk servis B 5678 DEF', '2024-08-20'),

((SELECT id FROM stock_items WHERE item_code = 'BRK-001'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'BRK-001-20240215-001'), 
 'out', 1.00, 850000, 850000, 'service', 
 (SELECT id FROM vehicle_services WHERE service_number = 'SRV-20241201-001'), 
 'Digunakan untuk servis BE 9090 AC', '2024-12-01'),

((SELECT id FROM stock_items WHERE item_code = 'BRK-002'), 
 (SELECT id FROM stock_batches WHERE batch_number = 'BRK-002-20240220-001'), 
 'out', 1.00, 125000, 125000, 'service', 
 (SELECT id FROM vehicle_services WHERE service_number = 'SRV-20241201-001'), 
 'Digunakan untuk servis BE 9090 AC', '2024-12-01');
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

-- JAYA TESTING SEEDER (MODIFIED TO MATCH SCHEMA)
-- Contract: 120 kubik Pasir Urug @ Rp 185,000/kubik (totals dynamic via triggers)
-- Dates: June 2025
-- =====================================================

BEGIN;

-- 1️⃣ CREATE PURCHASE ORDER (Fixed: No unit_price; total_amount starts at 0, trigger will update)
INSERT INTO purchase_orders (
  po_number, 
  customer_name, 
  item_name, 
  total_quantity, 
  unit, 
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
  0.00, -- Start at 0; trigger will sum from DOs
  'Quarry Sukabumi, Jawa Barat',
  'Proyek Perumahan Serpong, Tangerang Selatan',
  '2025-06-01',
  'confirmed', -- Start as confirmed; triggers to completed if all DOs fulfill
  'Pasir urug untuk proyek perumahan fase 2'
)
ON CONFLICT (po_number) DO NOTHING;

-- 🚛 DELIVERY ORDER 1 (Completed: 10 Juni 2025) (Fixed: payment_status default, added final_amount)
INSERT INTO delivery_orders (
  purchase_order_id, 
  driver_id, 
  vehicle_id, 
  do_name,
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
  final_amount,
  surat_jalan_photo_url,
  payment_confirmation_status,
  created_at
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO/JAYA/06/2025-04'),
  (SELECT id FROM users WHERE username = 'supir_dedi'),
  (SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'),
  'PT KONSTRUKSI - DO-250610-01',
  'DO-250610-01',
  'PT JAYA KONSTRUKSI',
  'Pasir Urug',
  55.00, -- Target: 55 m³
  56.25, -- Actual: 56.25 m³ (slight excess)
  'kubik',
  185000, -- Rp 185,000 per m³
  10406250, -- 56.25 m³ × Rp 185,000/m³ = Rp 10,406,250
  'awaiting_confirmation',
  '2025-07-10',
  'Quarry Sukabumi, Jawa Barat',
  -6.9175, 
  106.9270, -- Sukabumi coordinates
  'Proyek Perumahan Serpong, Tangerang Selatan',
  -6.2615, 
  106.6900, -- Serpong coordinates
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
  10406250, -- Final amount matches total
  '{uploads/surat_jalan/DO-250610-01-surat-jalan.jpg}',
  'awaiting_confirmation', -- Mimic trigger for completed
  '2025-06-09 15:00:00+07' -- DO dibuat sehari sebelumnya
)
ON CONFLICT (do_number) DO NOTHING;

-- 🚛 DELIVERY ORDER 2 (Completed: 30 Juni 2025) (Fixed similarly)
INSERT INTO delivery_orders (
  purchase_order_id, 
  driver_id, 
  vehicle_id, 
  do_name,
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
  final_amount,
  surat_jalan_photo_url,
  payment_confirmation_status,
  created_at
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO/JAYA/06/2025-04'),
  (SELECT id FROM users WHERE username = 'supir_dedi'),
  (SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'),
  'PT KONSTRUKSI - DO-250630-02',
  'DO-250630-02',
  'PT JAYA KONSTRUKSI',
  'Pasir Urug',
  65.00, -- Target: 65 m³ (sisa dari PO)
  64.80, -- Actual: 64.80 m³ (slight shortage)
  'kubik',
  185000, -- Rp 185,000 per m³
  11988000, -- 64.80 m³ × Rp 185,000/m³ = Rp 11,988,000
  'awaiting_confirmation',
  '2025-07-30',
  'Quarry Sukabumi, Jawa Barat',
  -6.9175, 
  106.9270, -- Sukabumi coordinates
  'Proyek Perumahan Serpong, Tangerang Selatan',
  -6.2615, 
  106.6900, -- Serpong coordinates
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
  11988000, -- Final amount matches total
  '{uploads/surat_jalan/DO-250630-02-surat-jalan.jpg}',
  'awaiting_confirmation', -- Mimic trigger
  '2025-06-29 16:00:00+07' -- DO dibuat sehari sebelumnya
)
ON CONFLICT (do_number) DO NOTHING;

-- 💰 DRIVER EXPENSES untuk kedua DO (Unchanged, but added ON CONFLICT)
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
 'parkir', 25000, 'Parkir di lokasi proyek')
ON CONFLICT DO NOTHING;

-- 🧾 SAMPLE INVOICE DATA (Fixed: Dates, calcs consistent)
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
 10406250,
 '2025-07-11',
 0.50,
 52031.25,
 10354218.75, -- Fixed rounding to match DECIMAL(15,2)
 'paid',
 'Invoice untuk pengiriman pasir urug batch 1',
 (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1)
),

-- Invoice untuk DO-250630-02
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250630-02'),
 'INV/2025/06/030',
 '2025-07-01',
 11988000,
 '2025-07-31',
 0.50,
 59940,
 11928060,
 'paid',
 'Invoice untuk pengiriman pasir urug batch 2',
 (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1)
)
ON CONFLICT (invoice_number) DO NOTHING;

-- 💸 SAMPLE PAYMENT DATA (Fixed: Net amounts rounded, added received_by)
INSERT INTO delivery_order_payments (
  delivery_order_id,
  invoice_id,
  payment_reference,
  payment_type,
  payment_amount,
  payment_date,
  notes,
  received_by
) VALUES
-- Payment untuk DO-250610-01
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250610-01'),
 (SELECT id FROM delivery_order_invoices WHERE invoice_number = 'INV/2025/06/010'),
 'TRF-20250615-001',
 'transfer',
 10354218.75,
 '2025-06-15',
 'Pembayaran lunas DO-250610-01 via transfer BCA',
 (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1)
),

-- Payment untuk DO-250630-02
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250630-02'),
 (SELECT id FROM delivery_order_invoices WHERE invoice_number = 'INV/2025/06/030'),
 'TRF-20250705-002',
 'transfer',
 11928060,
 '2025-07-05',
 'Pembayaran lunas DO-250630-02 via transfer BCA',
 (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1)
)
ON CONFLICT DO NOTHING;

-- 📊 PAYMENT HISTORY untuk tracking status changes (Fixed: old_status to 'awaiting_confirmation' per your info)
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
 'awaiting_confirmation',
 'lunas',
 'Payment completed via transfer TRF-20250615-001',
 (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1),
 '2025-06-15 14:30:00+07'),

-- History untuk DO-250630-02
((SELECT id FROM delivery_orders WHERE do_number = 'DO-250630-02'),
 'awaiting_confirmation',
 'lunas',
 'Payment completed via transfer TRF-20250705-002',
 (SELECT id FROM users WHERE username = 'admin_satu' LIMIT 1),
 '2025-07-05 16:45:00+07')
ON CONFLICT DO NOTHING;

COMMIT;

-- =====================================================
-- PAYMENT TESTING SEEDER (MODIFIED TO MATCH SCHEMA)
-- Contract: 1700 ton @ Rp 200/kg = Rp 340,000,000 (but totals dynamic via triggers)
-- Date: July 10, 2025
-- =====================================================

BEGIN;

-- 1️⃣ CREATE PURCHASE ORDER (Fixed: No unit_price; total_amount starts at 0, trigger will update after DOs)
INSERT INTO purchase_orders (
  po_number, customer_name, item_name, total_quantity, unit, total_amount,
  load_location, unload_location, order_date, status, notes, created_at
) VALUES (
  'PO/TESTING/07/2025-001',
  'PT MAJU SEJAHTERA TESTING',
  'Pasir Silika',
  '1700.00',
  'ton',
  '0.00',
  'Quarry Cilegon, Banten',
  'Pabrik Kaca Tangerang, Banten', 
  '2025-07-01',
  'confirmed', -- Let trigger handle
  'Testing data untuk sistem payment - BIG CONTRACT 1700 ton!',
  '2025-07-01 08:00:00+07'
)
ON CONFLICT (po_number) DO NOTHING;

-- 2️⃣ DELIVERY ORDERS WITH REALISTIC QUANTITIES

-- DO #1: COMPLETED - Ready for Invoice (Andi) - 300 ton (Fixed: Added payment_confirmation_status to mimic trigger)
INSERT INTO delivery_orders (
  purchase_order_id, driver_id, vehicle_id, do_name, do_number, customer_name, item_name,
  minimal_load_quantity, actual_load_quantity, unit, unit_price, total_amount,
  trip_allowance, gaji, ongkosan, final_amount,
  load_location, unload_location, 
  payment_status, status, payment_confirmation_status,
  created_at, departed_to_load_location_at, arrived_at_load_location_at,
  departed_from_load_location_at, arrived_at_unload_location_at, 
  departed_from_unload_location_at, completed_at
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO/TESTING/07/2025-001'),
  (SELECT id FROM users WHERE username = 'supir_andi'),
  (SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'),
  'PT MAJU SEJAHTERA - DO-20250702-ANDI-001',
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
  'awaiting_confirmation',
  'completed',
  'awaiting_confirmation', -- Mimic auto_set_payment_confirmation trigger
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
  purchase_order_id, driver_id, vehicle_id, do_name, do_number, customer_name, item_name,
  minimal_load_quantity, actual_load_quantity, unit, unit_price, total_amount,
  trip_allowance, gaji, ongkosan, final_amount,
  load_location, unload_location,
  payment_status, status,
  created_at, departed_to_load_location_at, arrived_at_load_location_at,
  departed_from_load_location_at, arrived_at_unload_location_at,
  departed_from_unload_location_at, completed_at, payment_confirmation_status
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO/TESTING/07/2025-001'),
  (SELECT id FROM users WHERE username = 'supir_budi'),
  (SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'),
  'PT MAJU SEJAHTERA - DO-20250703-BUDI-002',
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
  '2025-07-03 18:30:00+07',
  'confirmed'
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
  purchase_order_id, driver_id, vehicle_id, do_name, do_number, customer_name, item_name,
  minimal_load_quantity, actual_load_quantity, unit, unit_price, total_amount,
  trip_allowance, gaji, ongkosan, final_amount,
  load_location, unload_location,
  payment_status, status,
  created_at, departed_to_load_location_at, arrived_at_load_location_at,
  departed_from_load_location_at, arrived_at_unload_location_at,
  departed_from_unload_location_at, completed_at, payment_confirmation_status
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO/TESTING/07/2025-001'),
  (SELECT id FROM users WHERE username = 'supir_charlie'),
  (SELECT id FROM vehicles WHERE license_plate = 'B 9012 GHI'),
  'PT MAJU SEJAHTERA - DO-20250704-CHARLIE-003',
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
  '2025-07-04 19:00:00+07',
  'confirmed'
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

-- DO #4: COMPLETED - Ready for Invoice (Dedi) - 200 ton (Fixed: Added payment_confirmation_status to mimic trigger)
INSERT INTO delivery_orders (
  purchase_order_id, driver_id, vehicle_id, do_name, do_number, customer_name, item_name,
  minimal_load_quantity, actual_load_quantity, unit, unit_price, total_amount,
  trip_allowance, gaji, ongkosan, final_amount,
  load_location, unload_location,
  payment_status, status, payment_confirmation_status,
  created_at, departed_to_load_location_at, arrived_at_load_location_at,
  departed_from_load_location_at, arrived_at_unload_location_at,
  departed_from_unload_location_at, completed_at
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO/TESTING/07/2025-001'),
  (SELECT id FROM users WHERE username = 'supir_dedi'),
  (SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'),
  'PT MAJU SEJAHTERA - DO-20250705-DEDI-004',
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
  'awaiting_confirmation',
  'completed',
  'awaiting_confirmation', -- Mimic auto_set_payment_confirmation trigger
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
  purchase_order_id, driver_id, vehicle_id, do_name, do_number, customer_name, item_name,
  minimal_load_quantity, actual_load_quantity, unit, unit_price, total_amount,
  trip_allowance, gaji, ongkosan, final_amount,
  load_location, unload_location,
  payment_status, status,
  created_at, departed_to_load_location_at, arrived_at_load_location_at,
  departed_from_load_location_at, arrived_at_unload_location_at,
  departed_from_unload_location_at, completed_at, payment_confirmation_status, payment_confirmation_at, payment_confirmed_by
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO/TESTING/07/2025-001'),
  (SELECT id FROM users WHERE username = 'supir_yoyo'),
  (SELECT id FROM vehicles WHERE license_plate = 'BE 9090 AC'),
  'PT MAJU SEJAHTERA - DO-20250706-YOYO-005',
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
  'proses_tagihan', -- ✅ Partial payment received
  'completed',
  '2025-07-06 06:15:00+07',
  '2025-07-06 06:45:00+07',
  '2025-07-06 08:00:00+07',
  '2025-07-06 09:45:00+07',
  '2025-07-06 18:30:00+07',
  '2025-07-06 19:00:00+07',
  '2025-07-06 19:30:00+07',
  'confirmed',
  '2025-07-06 20:00:00+07', -- Payment confirmation time
  1 -- Payment confirmed by user ID 1 (admin)
);

-- DO #6: ONGOING - At Unload Location (Eko) - 350 ton ✅ This makes Eko BUSY (Updated: payment_status to 'awaiting_confirmation' per schema change and intent)
INSERT INTO delivery_orders (
  purchase_order_id, driver_id, vehicle_id, do_name, do_number, customer_name, item_name,
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
  'PT MAJU SEJAHTERA - DO-20250709-EKO-006',
  'DO-20250709-EKO-006',
  'PT MAJU SEJAHTERA TESTING',
  'Pasir Silika',
  '350.00', -- 350 ton
  NULL, -- belom selesai muat barang
  'ton',
  '200000.00',
  '70000000.00', -- 350 ton x Rp 200k (estimated)
  '4000000.00',
  '1400000.00',
  '64600000.00',
  '70000000.00',
  'Quarry Cilegon, Banten',
  'Pabrik Kaca Tangerang, Banten',
  'awaiting_confirmation', -- ✅ Pending completion for billing
  'at_load_location', -- at load location
  '2025-07-09 05:45:00+07',
  '2025-07-09 06:15:00+07',
  '2025-07-09 07:30:00+07'
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

BEGIN;

-- 1️⃣ CREATE PURCHASE ORDER WITH MULTIPLE ITEMS (aligned with controller: auto-style po_number, validated fields)
-- Mimics controller: po_number like 'PO-YYYYMM-XXXX', unit validated, total_quantity >0.01, item_name comma-separated
-- Total: 2500 tons aggregate; items: Pasir Silika, Batu Split, Semen
INSERT INTO purchase_orders (
  po_number, customer_name, item_name, total_quantity, unit, total_amount,
  load_location, unload_location, order_date, status, notes, created_at
) VALUES (
  'PO-202508-003',  -- Mimics controller format (YYYYMM-XXX); adjust if you have existing counts
  'PT BANGUN INFRA TESTING',
  'Pasir Silika, Batu Split, Semen',  -- Comma-separated, as validated in DO controller
  '2500.00',  -- >0.01, as per validation
  'ton',  -- Valid unit
  '0.00',  -- Starts at 0, trigger updates
  'Quarry Serang, Banten',
  'Proyek Jalan Tol Tangerang, Banten',
  '2025-08-01',
  'confirmed',
  'Testing PO with multiple items - BIG CONTRACT 2500 ton! Items: Pasir Silika (main), Batu Split, Semen.',
  '2025-08-01 09:00:00+07'
)
ON CONFLICT (po_number) DO NOTHING;

-- 2️⃣ DELIVERY ORDERS (Mimics controller: do_number like 'DO-YYYYMMDD-XXX', item_name from PO list, calcs for total_amount/ongkosan)
-- Quantities: Ensure sum < total_quantity (e.g., fulfilled ~1800 + pending 400 <2500) for 'partial' status
-- Note: In real creation, controller would validate remaining qty via tempDO.validateQuantityAgainstPO()—manually check post-seed that summed minimal/actual <= PO total

-- DO #1: COMPLETED - Pasir Silika, 800 ton (supir_andi)
INSERT INTO delivery_orders (
  purchase_order_id, driver_id, vehicle_id, do_name, do_number, customer_name, item_name,
  minimal_load_quantity, actual_load_quantity, unit, unit_price, total_amount,
  trip_allowance, gaji, ongkosan, final_amount,
  load_location, unload_location,
  payment_status, status, payment_confirmation_status,
  created_at, departed_to_load_location_at, arrived_at_load_location_at,
  departed_from_load_location_at, arrived_at_unload_location_at,
  departed_from_unload_location_at, completed_at
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO-202508-003'),
  (SELECT id FROM users WHERE username = 'supir_andi'),
  (SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'),
  'PT BANGUN INFRA - DO-20250802-ANDI-001',
  'DO-20250802-001',  -- Mimics controller format (DO-YYYYMMDD-XXX)
  'PT BANGUN INFRA TESTING',
  'Pasir Silika',  -- Valid from PO items (controller would check)
  '800.00',
  '805.20',
  'ton',
  '180000.00',
  '144936000.00',  -- Calc: 805.2 * 180k (matches calculateTotalAmount)
  '4500000.00',
  '1500000.00',
  '138936000.00',  -- Calc: total - allowance - gaji (matches calculateOngkosan)
  '144936000.00',
  'Quarry Serang, Banten',
  'Proyek Jalan Tol Tangerang, Banten',
  'awaiting_confirmation',
  'completed',
  'awaiting_confirmation',
  '2025-08-02 07:00:00+07',
  '2025-08-02 07:30:00+07',
  '2025-08-02 09:00:00+07',
  '2025-08-02 10:30:00+07',
  '2025-08-02 17:00:00+07',
  '2025-08-02 17:30:00+07',
  '2025-08-02 18:00:00+07'
);

-- DO #2: COMPLETED - Batu Split, 500 ton (supir_budi) - With invoice/partial payment; different item
INSERT INTO delivery_orders (
  purchase_order_id, driver_id, vehicle_id, do_name, do_number, customer_name, item_name,
  minimal_load_quantity, actual_load_quantity, unit, unit_price, total_amount,
  trip_allowance, gaji, ongkosan, final_amount,
  load_location, unload_location,
  payment_status, status, payment_confirmation_status,
  created_at, departed_to_load_location_at, arrived_at_load_location_at,
  departed_from_load_location_at, arrived_at_unload_location_at,
  departed_from_unload_location_at, completed_at
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO-202508-003'),
  (SELECT id FROM users WHERE username = 'supir_budi'),
  (SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'),
  'PT BANGUN INFRA - DO-20250803-BUDI-002',
  'DO-20250803-002',
  'PT BANGUN INFRA TESTING',
  'Batu Split',
  '500.00',
  '498.75',
  'ton',
  '220000.00',
  '109725000.00',  -- Calc: 498.75 * 220k
  '3200000.00',
  '1200000.00',
  '105325000.00',  -- Calc: total - allowance - gaji
  '109725000.00',
  'Quarry Serang, Banten',
  'Proyek Jalan Tol Tangerang, Banten',
  'proses_tagihan',
  'completed',
  'confirmed',
  '2025-08-03 06:30:00+07',
  '2025-08-03 07:00:00+07',
  '2025-08-03 08:30:00+07',
  '2025-08-03 10:00:00+07',
  '2025-08-03 16:30:00+07',
  '2025-08-03 17:00:00+07',
  '2025-08-03 17:30:00+07'
);

-- Invoice for DO #2
INSERT INTO delivery_order_invoices (
  delivery_order_id, invoice_number, invoice_date, invoice_amount, due_date,
  pph_percentage, pph_amount, net_amount, status, notes, created_by, created_at
) VALUES (
  (SELECT id FROM delivery_orders WHERE do_number = 'DO-20250803-002'),
  'INV/TEST/2025/08/002',
  '2025-08-04',
  '109725000.00',
  '2025-09-03',
  '0.50',
  '548625.00',
  '109176375.00',
  'issued',
  'Testing invoice for Batu Split - partial payment expected',
  1,
  '2025-08-04 10:00:00+07'
);

-- Partial payment for DO #2
INSERT INTO delivery_order_payments (
  delivery_order_id, invoice_id, payment_reference, payment_type, payment_amount,
  payment_date, received_by, bank_account, notes, created_by, created_at
) VALUES (
  (SELECT id FROM delivery_orders WHERE do_number = 'DO-20250803-002'),
  (SELECT id FROM delivery_order_invoices WHERE invoice_number = 'INV/TEST/2025/08/002'),
  'TRF-TEST-20250805-001',
  'transfer',
  '50000000.00',  -- Partial ~45%
  '2025-08-05',
  1,
  'BCA 1234567890',
  'Partial payment for Batu Split DO',
  1,
  '2025-08-05 14:00:00+07'
);

-- DO #3: COMPLETED - Semen, 500 ton (supir_charlie)
INSERT INTO delivery_orders (
  purchase_order_id, driver_id, vehicle_id, do_name, do_number, customer_name, item_name,
  minimal_load_quantity, actual_load_quantity, unit, unit_price, total_amount,
  trip_allowance, gaji, ongkosan, final_amount,
  load_location, unload_location,
  payment_status, status, payment_confirmation_status,
  created_at, departed_to_load_location_at, arrived_at_load_location_at,
  departed_from_load_location_at, arrived_at_unload_location_at,
  departed_from_unload_location_at, completed_at
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO-202508-003'),
  (SELECT id FROM users WHERE username = 'supir_charlie'),
  (SELECT id FROM vehicles WHERE license_plate = 'B 9012 GHI'),
  'PT BANGUN INFRA - DO-20250804-CHARLIE-003',
  'DO-20250804-003',
  'PT BANGUN INFRA TESTING',
  'Semen',  -- Third item from PO list
  '500.00',
  '502.10',
  'ton',
  '250000.00',  -- Premium price
  '125525000.00',  -- Calc: 502.1 * 250k
  '3500000.00',
  '1300000.00',
  '120725000.00',  -- Calc: total - allowance - gaji
  '125525000.00',
  'Quarry Serang, Banten',
  'Proyek Jalan Tol Tangerang, Banten',
  'awaiting_confirmation',
  'completed',
  'awaiting_confirmation',
  '2025-08-04 06:00:00+07',
  '2025-08-04 06:45:00+07',
  '2025-08-04 08:15:00+07',
  '2025-08-04 09:45:00+07',
  '2025-08-04 16:45:00+07',
  '2025-08-04 17:15:00+07',
  '2025-08-04 17:45:00+07'
);

-- DO #4: ONGOING - Pasir Silika, 400 ton (supir_dedi) - Makes driver/vehicle busy
INSERT INTO delivery_orders (
  purchase_order_id, driver_id, vehicle_id, do_name, do_number, customer_name, item_name,
  minimal_load_quantity, actual_load_quantity, unit, unit_price, total_amount,
  trip_allowance, gaji, ongkosan, final_amount,
  load_location, unload_location,
  payment_status, status,
  created_at, departed_to_load_location_at, arrived_at_load_location_at
) VALUES (
  (SELECT id FROM purchase_orders WHERE po_number = 'PO-202508-003'),
  (SELECT id FROM users WHERE username = 'supir_dedi'),
  (SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'),
  'PT BANGUN INFRA - DO-20250805-DEDI-004',
  'DO-20250805-004',
  'PT BANGUN INFRA TESTING',
  'Pasir Silika',
  '400.00',
  NULL,  -- Belum muat baranag
  'ton',
  '180000.00',
  '72000000.00',  -- Estimated calc: 400 * 180k
  '3000000.00',
  '1100000.00',
  '67900000.00',  -- Estimated calc: total - allowance - gaji
  '72000000.00',
  'Quarry Serang, Banten',
  'Proyek Jalan Tol Tangerang, Banten',
  'awaiting_confirmation',
  'at_load_location',  -- Ongoing, at load location
  '2025-08-05 05:30:00+07', -- created
  '2025-08-05 06:00:00+07', -- departed to load location
  '2025-08-05 07:30:00+07' -- arrived at load location
);

-- 3️⃣ UPDATE DRIVER & VEHICLE STATUS FOR ONGOING DO (now supir_dedi)
UPDATE driver_profiles
SET status = 'busy'
WHERE user_id = (SELECT id FROM users WHERE username = 'supir_dedi');
UPDATE vehicles SET status = 'in_use' WHERE license_plate = 'B 3456 JKL';

COMMIT;