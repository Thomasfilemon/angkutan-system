-- =================================================================
-- SEED DATA (INITIAL DATA INSERTION)
-- =================================================================

-- 1. Pengguna & Profil
-- IMPORTANT: These password hashes are placeholders and will not work for login.
-- You MUST use a Sequelize seeder with bcrypt to create real, usable users.
INSERT INTO users (username, password_hash, role) VALUES
('owner_utama', '$2b$10$abcdefghijklmnopqrstuv', 'owner'),
('admin_satu', '$2b$10$abcdefghijklmnopqrstuv', 'admin'),
('supir_andi', '$2b$10$abcdefghijklmnopqrstuv', 'driver'),
('supir_budi', '$2b$10$abcdefghijklmnopqrstuv', 'driver'),
('supir_charlie', '$2b$10$abcdefghijklmnopqrstuv', 'driver');

INSERT INTO admin_profiles (user_id, full_name, phone, email) VALUES
((SELECT id FROM users WHERE username = 'admin_satu'), 'Admin Satu', '081234567890', 'admin1@perusahaan.com');

INSERT INTO driver_profiles (user_id, full_name, phone, address, id_card_number, sim_number, license_type) VALUES
((SELECT id FROM users WHERE username = 'supir_andi'), 'Andi Setiawan', '081111111111', 'Jl. Merdeka 1', '3201111111110001', '1111-1111-111111', 'B2 Umum'),
((SELECT id FROM users WHERE username = 'supir_budi'), 'Budi Santoso', '082222222222', 'Jl. Kemerdekaan 2', '3201222222220002', '2222-2222-222222', 'B2 Umum'),
((SELECT id FROM users WHERE username = 'supir_charlie'), 'Charlie Wijaya', '083333333333', 'Jl. Persatuan 3', '3201333333330003', '3333-3333-333333', 'B1');

-- 2. Kendaraan
INSERT INTO vehicles (license_plate, type, capacity, stnk_expired_date, tax_due_date) VALUES
('B 1234 ABC', 'Hino Dutro 130 HD', 8000, '2025-10-20', '2025-10-20'),
('B 5678 DEF', 'Mitsubishi Fuso Canter', 8250, '2026-03-15', '2025-03-15'),
('B 9012 GHI', 'Isuzu Elf NMR 71', 7500, '2024-11-30', '2024-11-30');

-- 3. Purchase Order
INSERT INTO purchase_orders (po_number, customer_name, order_date, status) VALUES
('PO/WIKA/09/2024-01', 'PT WIKA BETON', '2024-09-28', 'in_progress');

-- 4. Delivery Orders
INSERT INTO delivery_orders (purchase_order_id, driver_id, vehicle_id, do_number, customer_name, item_name, quantity, unit_price, total_amount, payment_status, due_date, load_location, unload_location) VALUES
((SELECT id FROM purchase_orders WHERE po_number = 'PO/WIKA/09/2024-01'), (SELECT id FROM users WHERE username = 'supir_andi'), (SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), 'DO-240928-01', 'PT WIKA BETON', 'Abu Batu', 34.05, 155000, 5277750, 'proses_tagihan', '2024-10-28', 'Quarry Jonggol', 'Proyek Tol Cibitung'),
((SELECT id FROM purchase_orders WHERE po_number = 'PO/WIKA/09/2024-01'), (SELECT id FROM users WHERE username = 'supir_budi'), (SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), 'DO-240928-02', 'PT WIKA BETON', 'Abu Batu', 34.72, 155000, 5381600, 'proses_tagihan', '2024-10-28', 'Quarry Jonggol', 'Proyek Tol Cibitung'),
((SELECT id FROM purchase_orders WHERE po_number = 'PO/WIKA/09/2024-01'), (SELECT id FROM users WHERE username = 'supir_charlie'), (SELECT id FROM vehicles WHERE license_plate = 'B 9012 GHI'), 'DO-240928-03', 'PT WIKA BETON', 'Split 1-2', 33.53, 155000, 5197150, 'deposit', '2024-10-28', 'Quarry Jonggol', 'Proyek Tol Cibitung');

-- 5. Biaya Supir
INSERT INTO driver_expenses (delivery_order_id, driver_id, jenis, amount, notes) VALUES
((SELECT id FROM delivery_orders WHERE do_number = 'DO-240928-01'), (SELECT id FROM users WHERE username = 'supir_andi'), 'lainnya', 1700000, 'Uang Jalan Operasional'),
((SELECT id FROM delivery_orders WHERE do_number = 'DO-240928-01'), (SELECT id FROM users WHERE username = 'supir_andi'), 'bbm', 500000, 'Pengisian Solar Awal');

-- 6. Akuntansi Ritase
INSERT INTO accounting_ritase (delivery_order_id, ritase, tarif, total) VALUES
((SELECT id FROM delivery_orders WHERE do_number = 'DO-240928-01'), 1, 2000000, 2000000);

-- 7. Inventaris & Stok
INSERT INTO stock_categories (category_name, description) VALUES
('Oli & Pelumas', 'Segala jenis oli mesin, gardan, dan hidrolik'),
('Filter', 'Filter udara, filter oli, filter solar');

INSERT INTO stock_items (category_id, item_name, item_code, unit, current_stock, min_stock, unit_price) VALUES
((SELECT id FROM stock_categories WHERE category_name = 'Oli & Pelumas'), 'Oli Mesin Meditran SX', 'OLI-001', 'Liter', 50, 20, 55000),
((SELECT id FROM stock_categories WHERE category_name = 'Filter'), 'Filter Solar Hino Dutro', 'FLT-001', 'Pcs', 15, 5, 120000);

-- 8. Biaya Kantor
INSERT INTO office_expenses (kategori, description, amount, expense_date) VALUES
('Listrik & Internet', 'Pembayaran Tagihan Listrik Kantor Bulan September', 1500000, '2024-09-25'),
('Gaji Karyawan', 'Gaji Admin September', 4000000, '2024-09-25');

-- 9. Contoh Riwayat Servis Kendaraan (BARU)
-- Menambahkan beberapa catatan servis untuk kendaraan yang ada
INSERT INTO vehicle_services (vehicle_id, service_date, description, cost, workshop_name) VALUES
-- Service records for Hino Dutro 'B 1234 ABC'
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), '2024-07-15', 'Ganti Oli Mesin dan Filter Oli', 750000, 'Bengkel Internal'),
((SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'), '2024-09-02', 'Pemeriksaan dan Perbaikan Rem', 1200000, 'Bengkel Jaya Abadi'),
-- Service record for Mitsubishi Fuso 'B 5678 DEF'
((SELECT id FROM vehicles WHERE license_plate = 'B 5678 DEF'), '2024-08-20', 'Servis Rutin - Ganti Filter Solar & Cek Kaki-kaki', 950000, 'Bengkel Internal');
