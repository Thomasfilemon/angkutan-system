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

-- Vehicles
INSERT INTO vehicles (license_plate, type, capacity, status) VALUES
('B 1234 ABC', 'Truck Engkel', 8000, 'available'),
('B 2345 BCD', 'Truck Double', 12000, 'available'),
('B 3456 CDE', 'Truck Engkel', 8000, 'maintenance');

-- Sample trips
INSERT INTO trips (driver_id, vehicle_id, drop_lat, drop_lng, ritase, tarif_per_ritase, status) VALUES
((SELECT id FROM users WHERE username = 'driver1'),
 (SELECT id FROM vehicles WHERE license_plate = 'B 1234 ABC'),
 -6.200000, 106.816666, 3, 150000, 'on_progress'),
((SELECT id FROM users WHERE username = 'driver2'),
 (SELECT id FROM vehicles WHERE license_plate = 'B 2345 BCD'),
 -6.300000, 106.916666, 2, 175000, 'selesai');

-- Sample driver expenses
INSERT INTO driver_expenses (trip_id, driver_id, jenis, amount) VALUES
(1, (SELECT id FROM users WHERE username = 'driver1'), 'BBM', 500000),
(1, (SELECT id FROM users WHERE username = 'driver1'), 'Tol', 150000),
(2, (SELECT id FROM users WHERE username = 'driver2'), 'BBM', 450000);

-- Sample office expenses
INSERT INTO office_expenses (kategori, description, amount, expense_date) VALUES
('ATK', 'Pembelian kertas A4 10 rim', 500000, CURRENT_DATE),
('Utilities', 'Pembayaran listrik kantor', 1500000, CURRENT_DATE);

-- Update sequences
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('admin_profiles_id_seq', (SELECT MAX(id) FROM admin_profiles));
SELECT setval('driver_profiles_id_seq', (SELECT MAX(id) FROM driver_profiles));
SELECT setval('vehicles_id_seq', (SELECT MAX(id) FROM vehicles));
SELECT setval('trips_id_seq', (SELECT MAX(id) FROM trips));
SELECT setval('driver_expenses_id_seq', (SELECT MAX(id) FROM driver_expenses));
SELECT setval('office_expenses_id_seq', (SELECT MAX(id) FROM office_expenses));