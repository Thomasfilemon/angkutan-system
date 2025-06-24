-- =================================================================
-- SEED DATA LENGKAP (ANGKUTAN) - WITH STOCK & SERVICE MANAGEMENT
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

-- 2. STOCK CATEGORIES (MUST BE FIRST)
INSERT INTO stock_categories (category_name, description) VALUES
('Oli & Pelumas', 'Oli mesin, oli transmisi, dan pelumas lainnya'),
('Filter', 'Filter oli, filter solar, filter udara'),
('Spare Parts', 'Suku cadang kendaraan'),
('Bahan Bakar & Aditif', 'Solar, bensin, dan aditif'),
('Sistem Rem', 'Kampas rem, minyak rem, dan komponen rem lainnya');

-- 3. STOCK ITEMS (WITH PROPER INITIAL STOCK)
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

-- 4. VEHICLES WITH DRIVER ASSIGNMENTS
INSERT INTO vehicles (
  license_plate, type, capacity, driver_id, status,
  last_service_date, next_service_due,
  stnk_number, stnk_expired_date, tax_due_date
) VALUES
('B 1234 ABC', 'Hino Dutro 130 HD', '8000', (SELECT id FROM users WHERE username = 'supir_andi'), 'in_use',
  '2024-06-01', '2024-12-01',
  'STNK-1234-2025', '2025-10-20', '2025-10-20'
),
('B 5678 DEF', 'Mitsubishi Fuso Canter', '8250', (SELECT id FROM users WHERE username = 'supir_budi'), 'in_use',
  '2024-05-15', '2024-11-15',
  'STNK-5678-2026', '2026-03-15', '2025-03-15'
),
('B 9012 GHI', 'Isuzu Elf NMR 71', '7500', (SELECT id FROM users WHERE username = 'supir_charlie'), 'in_use',
  '2024-04-10', '2024-10-10',
  'STNK-9012-2024', '2024-11-30', '2024-11-30'
),
('B 3456 JKL', 'Hino Ranger FG', '12000', (SELECT id FROM users WHERE username = 'supir_dedi'), 'available',
  '2024-03-20', '2024-09-20',
  'STNK-3456-2025', '2025-12-01', '2025-12-01'
),
('BE 9090 AC', 'Mitsubishi Colt Diesel', '6800', (SELECT id FROM users WHERE username = 'supir_yoyo'), 'in_use',
  '2024-02-28', '2024-08-28',
  'STNK-9090-2026', '2026-04-17', '2030-05-11'
),
('B 7890 MNO', 'Mitsubishi Colt Diesel', '7000', (SELECT id FROM users WHERE username = 'supir_eko'), 'in_use',
  '2024-01-05', '2024-07-05',
  'STNK-7890-2026', '2026-01-10', '2026-01-10'
),
('B 1122 PQR', 'Isuzu Giga', '15000', NULL, 'available',
  '2024-06-15', '2024-12-15',
  'STNK-1122-2025', '2025-08-20', '2025-08-20'
);

-- 5. PURCHASE ORDERS (UPDATED STRUCTURE)
INSERT INTO purchase_orders (po_number, customer_name, item_name, total_quantity, unit_price, total_amount, load_location, unload_location, order_date, status) VALUES
('PO/WIKA/09/2024-01', 'PT WIKA BETON', 'Abu Batu', 200.00, 155000, 31000000, 'Quarry Jonggol, Bogor', 'Proyek Tol Cibitung, Bekasi', '2024-09-28', 'partial'),
('PO/ADHI/10/2024-02', 'PT ADHI KARYA', 'Pasir dan Batu Split', 500.00, 160000, 80000000, 'Quarry Cibinong, Bogor', 'Proyek Tol Cimanggis, Depok', '2024-10-05', 'partial'),
('PO/WIJAYA/11/2024-03', 'PT WIJAYA KARYA', 'Batu Split 1-2', 300.00, 165000, 49500000, NULL, NULL, '2024-11-01', 'confirmed');

-- 6. DELIVERY ORDERS WITH ONGKOSAN
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

-- 7. DRIVER EXPENSES
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

-- 8. VEHICLE SERVICES (UPDATED WITH NEW STRUCTURE)
INSERT INTO vehicle_services (vehicle_id, service_number, service_date, service_type, description, workshop_name, labor_cost, parts_cost, status, notes) VALUES
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), 'SRV-20240715-001', '2024-07-15', 'with_parts', 'Ganti Oli Mesin dan Filter Oli', 'Bengkel Internal', 200000, 645000, 'completed', 'Servis rutin bulanan'),
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), 'SRV-20240820-001', '2024-08-20', 'with_parts', 'Servis Rutin - Ganti Filter Solar & Cek Kaki-kaki', 'Bengkel Internal', 300000, 645000, 'completed', 'Servis berkala'),
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), 'SRV-20240901-001', '2024-09-01', 'with_parts', 'Ganti Ban Depan', 'Bengkel Ban Jaya', 400000, 2800000, 'completed', 'Penggantian ban karena aus'),
((SELECT id FROM vehicles WHERE license_plate = 'B 7890 MNO'), 'SRV-20240910-001', '2024-09-10', 'regular', 'Tune Up Mesin', 'Bengkel Internal', 1200000, 0, 'completed', 'Tune up mesin tanpa ganti parts'),
((SELECT id FROM vehicles WHERE license_plate = 'BE 9090 AC'), 'SRV-20241201-001', '2024-12-01', 'with_parts', 'Ganti Kampas Rem dan Minyak Rem', 'Bengkel Internal', 350000, 975000, 'completed', 'Perbaikan sistem rem');

-- 9. SERVICE ITEMS (FIXED - PROPER STOCK REFERENCES)
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

-- 10. STOCK TRANSACTIONS (TRACKING STOCK MOVEMENTS)
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

-- 11. ACCOUNTING RITASE
INSERT INTO accounting_ritase (delivery_order_id, ritase, tarif, total) VALUES
((SELECT id FROM delivery_orders WHERE do_number = 'DO-240928-01'), 1, 2000000, 2000000),
((SELECT id FROM delivery_orders WHERE do_number = 'DO-241005-02'), 1, 2100000, 2100000);

-- 12. OFFICE EXPENSES
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

-- 14. PAYMENT TRANSACTIONS
INSERT INTO payment_transactions (do_id, payment_type, amount, payment_date, reference_number, notes) VALUES
((SELECT id FROM delivery_orders WHERE do_number = 'DO-241005-02'), 'transfer', 6114600, '2024-11-06', 'TRF-20241106-001', 'Pembayaran lunas DO-241005-02');

-- 15. CASH TRANSACTIONS
INSERT INTO cash_transactions (transaction_type, amount, description, reference_type, reference_id, transaction_date) VALUES
('income', 6114600, 'Pembayaran DO-241005-02', 'delivery_order', (SELECT id FROM delivery_orders WHERE do_number = 'DO-241005-02'), '2024-11-06'),
('expense', 1500000, 'Pembayaran tagihan listrik kantor', 'office_expense', NULL, '2024-09-25'),
('expense', 4000000, 'Gaji admin September', 'office_expense', NULL, '2024-09-25');

-- 16. PAYMENT TERMS
INSERT INTO payment_terms (partner_name, amount_due, due_date, status) VALUES
('PT WIKA BETON', 15856500, '2024-10-28', 'pending'),
('PT ADHI KARYA', 12090300, '2024-11-05', 'pending');
