-- Seed data for testing

-- Insert users with hashed passwords (password = username123)
INSERT INTO users (username, password_hash, role) VALUES
('owner1', '$2b$10$YourHashedPasswordHere', 'owner'),
('admin1', '$2b$10$YourHashedPasswordHere', 'admin'),
('admin2', '$2b$10$YourHashedPasswordHere', 'admin'),
('driver1', '$2b$10$YourHashedPasswordHere', 'driver'),
('driver2', '$2b$10$YourHashedPasswordHere', 'driver'),
('driver3', '$2b$10$YourHashedPasswordHere', 'driver');

-- Admin profiles
INSERT INTO admin_profiles (user_id, full_name, phone, email, address) VALUES
((SELECT id FROM users WHERE username = 'admin1'), 
 'Admin Satu', '081234567890', 'admin1@angkutan.com', 'Jl. Admin No. 1, Jakarta'),
((SELECT id FROM users WHERE username = 'admin2'), 
 'Admin Dua', '081234567891', 'admin2@angkutan.com', 'Jl. Admin No. 2, Jakarta');

-- Driver profiles
INSERT INTO driver_profiles (user_id, full_name, phone, address, id_card_number, sim_number, license_type) VALUES
((SELECT id FROM users WHERE username = 'driver1'),
 'Driver Satu', '081234567892', 'Jl. Driver No. 1, Jakarta', '3171234567890001', 'SIM123456', 'SIM B1'),
((SELECT id FROM users WHERE username = 'driver2'),
 'Driver Dua', '081234567893', 'Jl. Driver No. 2, Jakarta', '3171234567890002', 'SIM123457', 'SIM B1'),
((SELECT id FROM users WHERE username = 'driver3'),
 'Driver Tiga', '081234567894', 'Jl. Driver No. 3, Jakarta', '3171234567890003', 'SIM123458', 'SIM B1');

-- Stock Categories
INSERT INTO stock_categories (category_name, description) VALUES
('Spare Parts', 'Vehicle spare parts and components'),
('Fluids', 'Engine oil, brake fluid, coolant, etc.'),
('Filters', 'Air filters, oil filters, fuel filters'),
('Electrical', 'Batteries, bulbs, wiring components'),
('Tools', 'Maintenance and repair tools');

-- Stock Items
INSERT INTO stock_items (category_id, item_name, item_code, unit, current_stock, min_stock, max_stock, unit_price) VALUES
(1, 'Brake Pad Set', 'BP001', 'set', 15, 5, 50, 250000),
(1, 'Air Filter', 'AF001', 'pcs', 8, 3, 30, 150000),
(2, 'Engine Oil 15W-40', 'EO001', 'liter', 100, 20, 200, 75000),
(2, 'Brake Fluid DOT 4', 'BF001', 'liter', 25, 5, 50, 45000),
(3, 'Oil Filter', 'OF001', 'pcs', 12, 4, 40, 85000),
(4, 'Battery 12V 70Ah', 'BAT001', 'pcs', 6, 2, 15, 1200000),
(5, 'Socket Wrench Set', 'SWS001', 'set', 3, 1, 10, 750000);

-- Tire Inventory
INSERT INTO tire_inventory (tire_brand, tire_size, tire_type, current_stock, min_stock, unit_price) VALUES
('Bridgestone', '295/80R22.5', 'Radial', 12, 4, 3500000),
('Michelin', '11R22.5', 'Radial', 8, 3, 4200000),
('GT Radial', '295/80R22.5', 'Radial', 15, 5, 2800000),
('Continental', '315/80R22.5', 'Radial', 6, 2, 4800000);

-- Vehicles (updated with STNK & Tax info)
INSERT INTO vehicles (license_plate, type, capacity, status, stnk_number, stnk_expired_date, tax_due_date) VALUES
('B 1234 ABC', 'Truck Engkel', 8000, 'available', 'STNK001234', '2025-12-31', '2025-06-30'),
('B 2345 BCD', 'Truck Double', 12000, 'available', 'STNK002345', '2025-11-15', '2025-05-15'),
('B 3456 CDE', 'Truck Engkel', 8000, 'maintenance', 'STNK003456', '2025-10-20', '2025-04-20'),
('B 4567 DEF', 'Truck Fuso', 10000, 'available', 'STNK004567', '2026-01-10', '2025-07-10');

-- Vehicle Tires
INSERT INTO vehicle_tires (vehicle_id, tire_id, position, install_date, mileage_installed) VALUES
(1, 1, 'front_left', '2024-01-15', 45000),
(1, 1, 'front_right', '2024-01-15', 45000),
(1, 2, 'rear_left', '2024-01-15', 45000),
(1, 2, 'rear_right', '2024-01-15', 45000),
(2, 3, 'front_left', '2024-02-20', 38000),
(2, 3, 'front_right', '2024-02-20', 38000),
(2, 4, 'rear_left', '2024-02-20', 38000),
(2, 4, 'rear_right', '2024-02-20', 38000);

-- Sample trips (assuming user IDs 4, 5, 6 are drivers)
INSERT INTO trips (driver_id, vehicle_id, drop_lat, drop_lng, ritase, tarif_per_ritase, status, started_at) VALUES
(4, 1, -6.200000, 106.816666, 3, 150000, 'on_progress', NOW() - INTERVAL '2 hours'),
(5, 2, -6.300000, 106.916666, 2, 175000, 'selesai', NOW() - INTERVAL '1 day'),
(6, 4, -6.250000, 106.850000, 4, 140000, 'otw', NOW() - INTERVAL '4 hours');

-- Delivery Orders
INSERT INTO delivery_orders (trip_id, do_number, customer_name, total_amount, payment_status, due_date) VALUES
(1, 'DO-2024-001', 'PT Maju Jaya', 450000, 'proses_tagihan', CURRENT_DATE + INTERVAL '30 days'),
(2, 'DO-2024-002', 'CV Berkah Mandiri', 350000, 'lunas', CURRENT_DATE),
(3, 'DO-2024-003', 'PT Sukses Abadi', 560000, 'deposit', CURRENT_DATE + INTERVAL '15 days');

-- Payment Transactions
INSERT INTO payment_transactions (do_id, payment_type, amount, payment_date, reference_number) VALUES
(2, 'transfer', 350000, CURRENT_DATE, 'TRF20241201001'),
(3, 'deposit', 200000, CURRENT_DATE - INTERVAL '1 day', 'DEP20241130001');

-- Cash Transactions
INSERT INTO cash_transactions (transaction_type, amount, description, reference_type, reference_id, transaction_date) VALUES
('income', 350000, 'Payment from CV Berkah Mandiri', 'trip', 2, CURRENT_DATE),
('expense', 500000, 'Vehicle maintenance B 3456 CDE', 'maintenance', 3, CURRENT_DATE - INTERVAL '1 day'),
('expense', 150000, 'Office rent payment', 'office', NULL, CURRENT_DATE - INTERVAL '2 days'),
('income', 200000, 'Deposit from PT Sukses Abadi', 'deposit', 3, CURRENT_DATE - INTERVAL '1 day');

-- Vehicle Service
INSERT INTO vehicle_service (vehicle_id, service_date, km_recorded, service_type, total_cost, note) VALUES
(3, CURRENT_DATE - INTERVAL '1 day', 85000, 'Preventive Maintenance', 2500000, 'Regular service and brake pad replacement'),
(1, CURRENT_DATE - INTERVAL '7 days', 47000, 'Oil Change', 750000, 'Engine oil and filter replacement'),
(2, CURRENT_DATE - INTERVAL '14 days', 52000, 'Tire Rotation', 200000, 'Tire rotation and alignment check');

-- Service Items
INSERT INTO service_items (service_id, item_name, item_type, quantity, unit_price, total_price, stock_item_id) VALUES
(1, 'Brake Pad Set', 'part', 2, 250000, 500000, 1),
(1, 'Engine Oil 15W-40', 'part', 12, 75000, 900000, 3),
(1, 'Oil Filter', 'part', 1, 85000, 85000, 5),
(1, 'Labor Cost', 'labor', 8, 125000, 1000000, NULL),
(2, 'Engine Oil 15W-40', 'part', 8, 75000, 600000, 3),
(2, 'Oil Filter', 'part', 1, 85000, 85000, 5),
(2, 'Labor Cost', 'labor', 1, 65000, 65000, NULL),
(3, 'Labor Cost', 'labor', 2, 100000, 200000, NULL);

-- Stock Transactions (reflecting service usage)
INSERT INTO stock_transactions (item_id, transaction_type, quantity, reference_type, reference_id, notes) VALUES
(1, 'out', 2, 'service', 1, 'Used for vehicle B 3456 CDE maintenance'),
(3, 'out', 20, 'service', NULL, 'Used for multiple vehicle services'),
(5, 'out', 2, 'service', NULL, 'Used for oil changes'),
(3, 'in', 50, 'purchase', NULL, 'Stock replenishment'),
(1, 'in', 10, 'purchase', NULL, 'New brake pad stock');

-- Driver Expenses
INSERT INTO driver_expenses (trip_id, driver_id, jenis, amount, created_at) VALUES
(1, 4, 'BBM', 500000, NOW() - INTERVAL '2 hours'),
(1, 4, 'Tol', 150000, NOW() - INTERVAL '2 hours'),
(2, 5, 'BBM', 450000, NOW() - INTERVAL '1 day'),
(2, 5, 'Parkir', 25000, NOW() - INTERVAL '1 day'),
(3, 6, 'BBM', 600000, NOW() - INTERVAL '4 hours');

-- Office Expenses
INSERT INTO office_expenses (kategori, description, amount, expense_date) VALUES
('ATK', 'Pembelian kertas A4 10 rim', 500000, CURRENT_DATE),
('Utilities', 'Pembayaran listrik kantor', 1500000, CURRENT_DATE),
('Communication', 'Pulsa dan internet kantor', 300000, CURRENT_DATE - INTERVAL '1 day'),
('Maintenance', 'Service AC kantor', 750000, CURRENT_DATE - INTERVAL '3 days');

-- Accounting Ritase
INSERT INTO accounting_ritase (trip_id, ritase, tarif, total) VALUES
(1, 3, 150000, 450000),
(2, 2, 175000, 350000),
(3, 4, 140000, 560000);

-- Payment Terms
INSERT INTO payment_terms (partner_name, amount_due, due_date, status) VALUES
('PT Maju Jaya', 450000, CURRENT_DATE + INTERVAL '30 days', 'pending'),
('CV Berkah Mandiri', 350000, CURRENT_DATE, 'paid'),
('PT Sukses Abadi', 360000, CURRENT_DATE + INTERVAL '15 days', 'pending'),
('PT Global Logistics', 280000, CURRENT_DATE - INTERVAL '5 days', 'overdue');

-- Tire Inspections
INSERT INTO tire_inspections (vehicle_tire_id, inspection_date, tread_depth, air_pressure, condition, notes) VALUES
(1, CURRENT_DATE - INTERVAL '7 days', 8.5, 110.0, 'good', 'Normal wear pattern'),
(2, CURRENT_DATE - INTERVAL '7 days', 8.2, 108.0, 'good', 'Normal wear pattern'),
(3, CURRENT_DATE - INTERVAL '7 days', 7.8, 112.0, 'fair', 'Slight uneven wear'),
(4, CURRENT_DATE - INTERVAL '7 days', 7.9, 111.0, 'fair', 'Slight uneven wear'),
(5, CURRENT_DATE - INTERVAL '14 days', 9.2, 115.0, 'good', 'Recently installed'),
(6, CURRENT_DATE - INTERVAL '14 days', 9.1, 114.0, 'good', 'Recently installed');

-- Update sequences to prevent conflicts
SELECT setval('stock_categories_id_seq', (SELECT MAX(id) FROM stock_categories));
SELECT setval('stock_items_id_seq', (SELECT MAX(id) FROM stock_items));
SELECT setval('tire_inventory_id_seq', (SELECT MAX(id) FROM tire_inventory));
SELECT setval('vehicles_id_seq', (SELECT MAX(id) FROM vehicles));
SELECT setval('vehicle_tires_id_seq', (SELECT MAX(id) FROM vehicle_tires));
SELECT setval('trips_id_seq', (SELECT MAX(id) FROM trips));
SELECT setval('delivery_orders_id_seq', (SELECT MAX(id) FROM delivery_orders));
SELECT setval('payment_transactions_id_seq', (SELECT MAX(id) FROM payment_transactions));
SELECT setval('cash_transactions_id_seq', (SELECT MAX(id) FROM cash_transactions));
SELECT setval('vehicle_service_id_seq', (SELECT MAX(id) FROM vehicle_service));
SELECT setval('service_items_id_seq', (SELECT MAX(id) FROM service_items));
SELECT setval('stock_transactions_id_seq', (SELECT MAX(id) FROM stock_transactions));
SELECT setval('driver_expenses_id_seq', (SELECT MAX(id) FROM driver_expenses));
SELECT setval('office_expenses_id_seq', (SELECT MAX(id) FROM office_expenses));
SELECT setval('accounting_ritase_id_seq', (SELECT MAX(id) FROM accounting_ritase));
SELECT setval('payment_terms_id_seq', (SELECT MAX(id) FROM payment_terms));
SELECT setval('tire_inspections_id_seq', (SELECT MAX(id) FROM tire_inspections));