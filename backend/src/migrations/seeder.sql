-- =================================================================
-- SEED DATA LENGKAP (ANGKUTAN)
-- =================================================================

-- 1. USERS & PROFILES
INSERT INTO users (username, password_hash, role) VALUES
('admin_satu', '$2b$10$abcdefghijklmnopqrstuv', 'admin'),
('supir_andi', '$2b$10$abcdefghijklmnopqrstuv', 'driver'),
('supir_budi', '$2b$10$abcdefghijklmnopqrstuv', 'driver'),
('supir_yoyo', '$2b$10$abcdefghijklmnopqrstuv', 'driver'),
('supir_charlie', '$2b$10$abcdefghijklmnopqrstuv', 'driver'),
('supir_dedi', '$2b$10$abcdefghijklmnopqrstuv', 'driver'),
('supir_eko', '$2b$10$abcdefghijklmnopqrstuv', 'driver');

INSERT INTO admin_profiles (user_id, full_name, phone, email) VALUES
((SELECT id FROM users WHERE username = 'admin_satu'), 'Admin Satu', '081234567890', 'admin1@perusahaan.com');

INSERT INTO driver_profiles (user_id, full_name, phone, address, id_card_number, sim_number, license_type, status) VALUES
((SELECT id FROM users WHERE username = 'supir_andi'), 'Andi Setiawan', '081111111111', 'Jl. Merdeka 1', '3201111111110001', '1111-1111-111111', 'B2 Umum', 'busy'),
((SELECT id FROM users WHERE username = 'supir_budi'), 'Budi Santoso', '082222222222', 'Jl. Kemerdekaan 2', '3201222222220002', '2222-2222-222222', 'B2 Umum', 'busy'),
((SELECT id FROM users WHERE username = 'supir_charlie'), 'Charlie Wijaya', '083333333333', 'Jl. Persatuan 3', '3201333333330003', '3333-3333-333333', 'B1', 'busy'),
((SELECT id FROM users WHERE username = 'supir_dedi'), 'Dedi Gunawan', '084444444444', 'Jl. Pahlawan 4', '3201444444440004', '4444-4444-444444', 'B1', 'available'),
((SELECT id FROM users WHERE username = 'supir_eko'), 'Eko Prasetyo', '085555555555', 'Jl. Kemakmuran 5', '3201555555550005', '5555-5555-555555', 'B2 Umum', 'available');

-- 2. VEHICLES
INSERT INTO vehicles (license_plate, type, capacity, stnk_expired_date, tax_due_date, status) VALUES
('B 1234 ABC', 'Hino Dutro 130 HD', 8000, '2025-10-20', '2025-10-20', 'in_use'),
('B 5678 DEF', 'Mitsubishi Fuso Canter', 8250, '2026-03-15', '2025-03-15', 'in_use'),
('B 9012 GHI', 'Isuzu Elf NMR 71', 7500, '2024-11-30', '2024-11-30', 'in_use'),
('B 3456 JKL', 'Hino Ranger FG', 12000, '2025-12-01', '2025-12-01', 'available'),
('BE 9090 AC', 'Mitsubishi Colt Diesel', 6800, '2026-04-17', '2030-05-11', 'in_use'),
('B 7890 MNO', 'Mitsubishi Colt Diesel', 7000, '2026-01-10', '2026-01-10', 'available'),
('B 1122 PQR', 'Isuzu Giga', 15000, '2025-08-20', '2025-08-20', 'available');

-- 3. PURCHASE ORDERS
INSERT INTO purchase_orders (po_number, customer_name, load_location, load_latitude, load_longitude, unload_location, unload_latitude, unload_longitude, item_name, total_quantity, order_date, status) VALUES
('PO/WIKA/09/2024-01', 'PT WIKA BETON', 'Quarry Jonggol, Bogor', -6.4925, 106.8467, 'Proyek Tol Cibitung, Bekasi', -6.2615, 107.0012, 'Abu Batu', 200.00, '2024-09-28', 'in_progress'),
('PO/ADHI/10/2024-02', 'PT ADHI KARYA', 'Quarry Cibinong, Bogor', -6.4925, 106.8467, 'Proyek Tol Cimanggis, Depok', -6.2615, 107.0012, 'Pasir dan Batu Split', 500.00, '2024-10-05', 'in_progress');

-- 4. DELIVERY ORDERS (DO/TRIP) + UANG JALAN
INSERT INTO delivery_orders (
  purchase_order_id, driver_id, vehicle_id, do_number, customer_name, item_name, minimal_load_quantity, actual_load_quantity, unit_price, total_amount,
  payment_status, due_date, load_location, unload_location, status, departed_to_load_location_at, arrived_at_load_location_at, departed_from_load_location_at, arrived_at_unload_location_at, departed_from_unload_location_at, completed_at, trip_allowance, gaji
)
VALUES
-- DO 1: assigned (supir_andi, B 1234 ABC)
((SELECT id FROM purchase_orders WHERE po_number = 'PO/WIKA/09/2024-01'), (SELECT id FROM users WHERE username = 'supir_andi'), (SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), 
'DO-240928-01', 'PT WIKA BETON', 'Abu Batu', 34, 34.05, 155000, 5277750, 'proses_tagihan', '2024-10-28', 'Quarry Jonggol', 'Proyek Tol Cibitung', 'assigned', NULL, NULL, NULL, NULL, NULL, NULL, 1700000, 500000),

-- DO 2: otw_to_destination (supir_budi, B 5678 DEF)
((SELECT id FROM purchase_orders WHERE po_number = 'PO/WIKA/09/2024-01'), (SELECT id FROM users WHERE username = 'supir_budi'), (SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), 
'DO-240928-02', 'PT WIKA BETON', 'Abu Batu', 34, 34.72, 155000, 5381600, 'proses_tagihan', '2024-10-28', 'Quarry Jonggol', 'Proyek Tol Cibitung', 'otw_to_load_location', '2024-06-16 08:00:00', NULL, NULL, NULL, NULL, NULL, 1800000, 500000),

-- DO 3: at_destination (supir_charlie, B 9012 GHI)
((SELECT id FROM purchase_orders WHERE po_number = 'PO/WIKA/09/2024-01'), (SELECT id FROM users WHERE username = 'supir_charlie'), (SELECT id FROM vehicles WHERE license_plate = 'B 9012 GHI'), 
'DO-240928-03', 'PT WIKA BETON', 'Split 1-2', 33, 33.53, 155000, 5197150, 'deposit', '2024-10-28', 'Quarry Jonggol', 'Proyek Tol Cibitung', 'at_unload_location', '2024-06-16 07:00:00', '2024-06-16 10:00:00', '2024-06-16 12:00:00', '2024-06-16 16:00:00', NULL, NULL, 1750000, 500000),

-- DO 4: otw_to_base (supir_yoyo, BE 9090 AC)
((SELECT id FROM purchase_orders WHERE po_number = 'PO/ADHI/10/2024-02'), (SELECT id FROM users WHERE username = 'supir_yoyo'), (SELECT id FROM vehicles WHERE license_plate = 'BE 9090 AC'), 
'DO-241005-01', 'PT ADHI KARYA', 'Pasir', 40.00, 40.15, 160000, 6400000, 'proses_tagihan', '2024-11-05', 'Quarry Cibinong', 'Proyek Tol Cimanggis', 'otw_to_base', '2024-06-15 09:00:00', '2024-06-15 12:00:00', '2024-06-15 13:00:00', '2024-06-15 17:00:00', '2024-06-15 18:00:00', NULL, 2000000, 500000),

-- DO 5: completed (supir_dedi, B 3456 JKL)
((SELECT id FROM purchase_orders WHERE po_number = 'PO/ADHI/10/2024-02'), (SELECT id FROM users WHERE username = 'supir_dedi'), (SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), 
'DO-241005-02', 'PT ADHI KARYA', 'Batu Split', 38.00, 38.70, 158000, 6004000, 'lunas', '2024-11-06', 'Quarry Cibinong', 'Proyek Tol Cimanggis', 'completed', '2024-06-14 08:00:00', '2024-06-14 11:00:00', '2024-06-14 12:00:00', '2024-06-14 15:00:00', '2024-06-14 18:30:00', '2024-06-14 20:00:00', 2100000, 500000),

-- DO 6: assigned (supir_eko, B 7890 MNO)
((SELECT id FROM purchase_orders WHERE po_number = 'PO/ADHI/10/2024-02'), (SELECT id FROM users WHERE username = 'supir_eko'), (SELECT id FROM vehicles WHERE license_plate = 'B 7890 MNO'), 
'DO-241005-03', 'PT ADHI KARYA', 'Sirtu', 36.00, 36.10, 157000, 5652000, 'proses_tagihan', '2024-11-07', 'Quarry Cibinong', 'Proyek Tol Cimanggis', 'assigned', NULL, NULL, NULL, NULL, NULL, NULL, 1900000, 500000);

-- 5. DRIVER EXPENSES (PENGELUARAN DRIVER)
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

-- 6. VEHICLE SERVICES
INSERT INTO vehicle_services (vehicle_id, service_date, description, cost, workshop_name) VALUES
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), '2024-07-15', 'Ganti Oli Mesin dan Filter Oli', 750000, 'Bengkel Internal'),
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), '2024-08-20', 'Servis Rutin - Ganti Filter Solar & Cek Kaki-kaki', 950000, 'Bengkel Internal'),
((SELECT id FROM vehicles WHERE license_plate = 'B 3456 JKL'), '2024-09-01', 'Ganti Ban Depan', 3200000, 'Bengkel Ban Jaya'),
((SELECT id FROM vehicles WHERE license_plate = 'B 7890 MNO'), '2024-09-10', 'Tune Up Mesin', 1200000, 'Bengkel Internal');

-- 7. AKUNTANSI RITASE
INSERT INTO accounting_ritase (delivery_order_id, ritase, tarif, total) VALUES
((SELECT id FROM delivery_orders WHERE do_number = 'DO-240928-01'), 1, 2000000, 2000000),
((SELECT id FROM delivery_orders WHERE do_number = 'DO-241005-02'), 1, 2100000, 2100000);

-- 8. INVENTARIS & STOK
INSERT INTO stock_categories (category_name, description) VALUES
('Oli & Pelumas', 'Segala jenis oli mesin, gardan, dan hidrolik'),
('Filter', 'Filter udara, filter oli, filter solar');

INSERT INTO stock_items (category_id, item_name, item_code, unit, current_stock, min_stock, unit_price) VALUES
((SELECT id FROM stock_categories WHERE category_name = 'Oli & Pelumas'), 'Oli Mesin Meditran SX', 'OLI-001', 'Liter', 50, 20, 55000),
((SELECT id FROM stock_categories WHERE category_name = 'Filter'), 'Filter Solar Hino Dutro', 'FLT-001', 'Pcs', 15, 5, 120000);

-- 9. BIAYA KANTOR
INSERT INTO office_expenses (kategori, description, amount, expense_date) VALUES
('Listrik & Internet', 'Pembayaran Tagihan Listrik Kantor Bulan September', 1500000, '2024-09-25'),
('Gaji Karyawan', 'Gaji Admin September', 4000000, '2024-09-25');