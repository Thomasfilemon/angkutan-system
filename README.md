# angkutan-system
Monorepo for Angkutan App (React Native) &amp; future Web Dashboard (React.js/Node.js)

---

## 1. Gambaran Arsitektur Tinggi

Purwarupa arsitektur kita kira-kira begini:

```
┌─────────────────┐           ┌─────────────────┐
│   Client Web    │◀──────────│     API Layer   │─────────┐
│ (React.js + TS) │   HTTPS   │ (Node.js/Express)│         │
└─────────────────┘           └─────────────────┘         │
      │                                                         │
      ▼                                                         ▼
┌─────────────────┐                ┌─────────────────────────┐
│ Firebase Auth & │                │   Relational Database  │
│   FCM (Auth)    │◀──┐            │   PostgreSQL/MySQL     │
└─────────────────┘   │            └─────────────────────────┘
       ▲               │                    ▲
       │               │                    │
┌─────────────────┐   │                    │
│ React Native    │───┘                    │
│   Mobile App    │                        │
└─────────────────┘                        │
                                          │
                                 ┌────────────────────┐
                                 │  Cron Jobs/Backups │
                                 └────────────────────┘
```

* **Client Web** (React.js + Tailwind) untuk Owner/Admin yang buka halaman dashboard.
* **React Native App** (Expo/CLI) untuk Admin *dan* Driver di Android (APK terpisah).
* **API Layer** (Node.js + Express/Koa), jadi satu pintu masuk semua request CRUD/SPA/WebSocket kalau perlu.
* **DB** satu-satunya (PostgreSQL), tempat nyimpen users, profiles, trips, expenses, accounting, dsb.
* **Firebase Auth & FCM**: Auth simpel dan push-notif gratis (selama volume masih wajar).
* **Cron Jobs** (node-cron atau cron Linux) buat tugas periodik: backup DB, kirim reminder pembayaran, kirim notifikasi service kendaraan, dll.

---

## 2. Domain Model & Entities

Lo perlu bikin ERD (Entity-Relationship Diagram) mental dulu. Berikut ringkasannya:

1. **User & Profiles**

   * **users** `(id, username, password_hash, role, created_at)`
   * **admin\_profiles** `(id, user_id[Fk], full_name, phone, email, address, created_at)`
   * **driver\_profiles** `(id, user_id[Fk], full_name, phone, address, id_card_number, sim_number, license_type, status, created_at)`

2. **Vehicles**

   * **vehicles** `(id, license_plate, type, capacity, status, last_service_date, next_service_due, created_at)`

3. **Trips (Pengangkutan Barang)**

   * **trips** `(id, driver_id[Fk users], vehicle_id[Fk vehicles], origin_lat?, origin_lng?, drop_lat, drop_lng, ritase, tarif_per_ritase, total_ritase, status, created_at, started_at, reached_at, returning_at, completed_at)`

4. **Driver Expenses (BBM, Tol, dll)**

   * **driver\_expenses** `(id, trip_id[Fk trips], driver_id[Fk users], jenis, amount, receipt_url, created_at)`

5. **Office Expenses (Pengeluaran Kantor)**

   * **office\_expenses** `(id, kategori, description, amount, receipt_url, expense_date, created_at)`

6. **Accounting Ritase**

   * **accounting\_ritase** `(id, trip_id[Fk trips], ritase, tarif, total, recorded_at)`

7. **Vehicle Service / Maintenance**

   * **vehicle\_service** `(id, vehicle_id[Fk vehicles], service_date, km_recorded, service_type, cost, note, receipt_url, created_at)`

8. **Payment Terms (Tempo)**

   * **payment\_terms** `(id, partner_name, amount_due, due_date, status, reminder_sent, created_at, paid_at)`

9. **(Opsional) Analytics Cache**

   * **analytics\_cache** `(date, total_trips, total_ritase_income, total_office_expenses, total_vehicle_service_cost, total_driver_expenses)`

Semua sudah saling berelasi via **foreign keys**, agar **JOIN** di fitur analitik dan laporan gampang dilakuin.

---

## 3. Detail API Endpoints (CRUD + Khusus)

Berikut daftar endpoint API yang lo butuhin paling minimal (versi pseudo-route):

### 3.1. Autentikasi & Profil

* `POST /api/auth/register`

  * Buat akun `owner/admin/driver` (tapi registrasi admin/driver biasanya di Web Dashboard, bukan public).
  * Payload: `{ username, password, role }`
  * Setelah register, insert record `user` → insert ke `admin_profiles` atau `driver_profiles` sesuai `role`.

* `POST /api/auth/login` → generate JWT.

  * Response: `{ token, user: { id, role, profileData… } }`

* `GET /api/users/me` → ambil profil lengkap current user (join users + profiles).

### 3.2. User Management (Owner di Web)

*(Owner punya wewenang CRUD akun Admin & Driver)*

* **Admin**

  * `GET /api/admins` → list semua admin (join users + admin\_profiles).
  * `POST /api/admins` → create admin baru + profile.

    * Payload: `{ username, password, full_name, phone, email, address }`
  * `PUT /api/admins/:id` → update profile admin & username/password opsional.
  * `DELETE /api/admins/:id` → hapus user & profile cascade.

* **Driver**

  * `GET /api/drivers?status=available|busy` → list driver sesuai filter status.
  * `POST /api/drivers` → create driver baru + profile.

    * Payload: `{ username, password, full_name, phone, address, id_card_number, sim_number, license_type }`
  * `PUT /api/drivers/:id` → update profile/username/password jika perlu.
  * `DELETE /api/drivers/:id` → hapus user & profile.
  * **Special**: `PATCH /api/drivers/:id/status` → ubah manual status `available` / `busy` (biasanya sistem yang handle, tapi admin bisa override kalau driver izin libur).

### 3.3. Kendaraan (Vehicles)

* `GET /api/vehicles?status=available|in_use|maintenance`
* `POST /api/vehicles` → `{ license_plate, type, capacity, last_service_date, next_service_due }`
* `PUT /api/vehicles/:id` → edit data mobil.
* `DELETE /api/vehicles/:id`

### 3.4. Trip Management

* `GET /api/trips?status=on_progress|otw|perjalanan_pulang|selesai`

  * Bisa tambahin filter `driver_id`, `date_from`, `date_to`.
* `POST /api/trips` → Buat trip baru (dijalankan oleh Admin-App).

  * Payload: `{ driver_id, vehicle_id, drop_lat, drop_lng, ritase, tarif_per_ritase }`
  * **Validasi**: Pastikan driver & kendaraan `status = available`.
  * Setelah insert, update `driver.status=‘busy’`, `vehicle.status=‘in_use’`, kirim FCM notif.
* `PATCH /api/trips/:id/on_progress` → Trip aktif langsung setelah assignment tugas (status langsung on_progress).

  * Atau Update Status Manual `status = on_progress`, `created_at = NOW()`.

* `PATCH /api/trips/:id/otw` → Driver mulai perjalanan ke tujuan.

  * Update `status = otw`, `started_at = NOW()`.
* `PATCH /api/trips/:id/sampai_tujuan` → Driver klik "Sampai Tujuan".

  * Update `status = perjalanan_pulang`, `reached_at = NOW()` (**catatan:** timestamp ini diisi saat driver klik tombol “Sampai Tujuan” di aplikasi).
* `PATCH /api/trips:id/perjalanan_pulang` → Driver klik "Mulai Jalan Pulang".

  * Update `status = perjalanan_pulang`, `returning_at = NOW()` (timestamp ini diisi saat driver klik tombol "Mulai Jalan Pulang di app").
* `PATCH /api/trips/:id/selesai` → Trip benar-benar selesai, driver sudah sampai base & klik tombol 'Selesai'.

  * Update `status = selesai`, `completed_at = NOW()`, update `driver.status=‘available’`, `vehicle.status=‘available’` juga.


### 3.5. Driver Expenses

* `GET /api/driver-expenses?driver_id=&trip_id=`
* `POST /api/driver-expenses` → `{ trip_id, driver_id, jenis, amount, receipt_url }`
* `PUT /api/driver-expenses/:id` → edit (opsional)
* `DELETE /api/driver-expenses/:id` → hapus jika keliru

### 3.6. Office Expenses

* `GET /api/office-expenses?date_from=&date_to=&category=`
* `POST /api/office-expenses` → `{ kategori, description, amount, receipt_url, expense_date }`
* `PUT /api/office-expenses/:id`
* `DELETE /api/office-expenses/:id`

### 3.7. Accounting Ritase

* `GET /api/accounting-ritase?date_from=&date_to=`
* **Otomatis**: Ketika `trips.status` berubah ke `completed`, backend bisa insert ke `accounting_ritase` otomatis:

  * `ritase` = value dari trip
  * `tarif` = `tarif_per_ritase`
  * `total` = `ritase * tarif`
  * `recorded_at` = NOW()
* `GET /api/accounting-ritase/export?format=pdf|xlsx&date_from=&date_to=` → download laporan

### 3.8. Vehicle Service / Maintenance

* `GET /api/vehicle-service?vehicle_id=&date_from=&date_to=`
* `POST /api/vehicle-service` → `{ vehicle_id, service_date, km_recorded, service_type, cost, note, receipt_url }`
* `PUT /api/vehicle-service/:id`
* `DELETE /api/vehicle-service/:id`
* **Reminder Otomatis** via cron job:

  * Cek setiap hari apakah `current_date >= next_service_due` → kirim email/FCM ke admin/owner

### 3.9. Payment Terms (Tempo)

* `GET /api/payment-terms?status=pending|overdue|paid`
* `POST /api/payment-terms` → `{ partner_name, amount_due, due_date }`
* `PUT /api/payment-terms/:id` → update status atau amount
* Cron Job harian:

  * Cek records dengan `status = 'pending'` & `due_date <= today + X hari` & `reminder_sent = false`, kirim email/FCM → set `reminder_sent = true`.
  * Cek `due_date < today` & `status = 'pending'` → update status ke `overdue` (opsional).

### 3.10. Analytics Endpoint

* `GET /api/analytics/overview?date_from=&date_to=`

  * Response:

    ```json
    {
      "total_trips": 120,
      "total_ritase_income": 15000000,
      "total_office_expenses": 5000000,
      "total_vehicle_service_cost": 2000000,
      "total_driver_expenses": 3000000
    }
    ```
* `GET /api/analytics/trips-per-day?date_from=&date_to=` → data array `[ { date: '2025-06-01', count: 5 }, … ]`
* `GET /api/analytics/expenses-per-category?date_from=&date_to=` → data array `[ { category: 'BBM', total: 1000000 }, { category: 'Listrik', total: 500000 }, … ]`

---

## 4. Detail Flow Kerja & Sequence Diagram (Tekstual)

### 4.1. Kasus: Admin-Assign-Trip → Driver Mulai → Selesai

1. **Admin App**: Buka halaman “Buat Trip Baru”.

   * Frontend fetch `GET /api/drivers?status=available` & `GET /api/vehicles?status=available`.
   * Pilih driver & kendaraan, isi drop point, ritase, tarif. Klik “Submit”.

2. **API (/api/trips, method=POST)**:

   * Verifikasi JWT & Role = “admin”.
   * Validasi driver & kendaraan `status=available`.
   * Insert record `trips`.
   * Update `driver_profiles.status='busy'`, `vehicles.status='in_use'`.
   * Update `trip.status='on_progress'`, `PATCH /api/trips/:id/on_progress`
   * Kirim FCM notifikasi ke driver:

     ```json
     {
       "to": "<driver_fcm_token>",
       "notification": {
         "title": "Tugas Baru",
         "body": "Trip ID 123, cek detail di app."
       },
       "data": {
         "tripId": 123
       }
     }
     ```
   * Return `{ tripId: 123, message: 'Berhasil assign' }`.

3. **Driver App**:

   * Dapet push-notif, user klik notifikasi → navigasi ke “Detail Trip” screen.
   * Frontend fetch `GET /api/trips/123` → tampilkan drop point, tombol “Mulai Perjalanan”.

4. **Driver Klik “Mulai Perjalanan”**:

   * Frontend kirim `PATCH /api/trips/123/otw` + JWT.
   * API update `trips.status='otw'`, `trips.started_at=NOW()`.
   * Return `{ message: 'Trip diupdate ke otw' }`.

5. **Driver Klik “Sampai Tujuan”**:

   * Frontend kirim `PATCH /api/trips/123/sampai_tujuan`.
   * API update `trips.status='perjalanan_pulang'`, `trips.reached_at=NOW()`.
   * Return `{ message: 'Sudan Sampai Tujuan, Silahkan Cek Kembali Surat Jalan' }`.
  
6. **Driver Klik “Mulai Jalan Pulang”**:

   * Frontend kirim `PATCH /api/trips/123/perjalanan_pulang`.
   * API update `trips.status='perjalanan_pulang'`, `trips.returning_at=NOW()`.
   * Return `{ message: 'Sedang Berjalan Pulang, Hati-hati di jalan' }`.

7. **Driver Klik “Selesai”**:

   * Frontend kirim `PATCH /api/trips/123/selesai`.
   * API update `trips.status='selesai'`, `trips.ended_at=NOW()`.
   * Ambil `vehicle_id` dari trips, update `driver_profiles.status='available'`, `vehicles.status='available'`.
   * Otomatis insert ke `accounting_ritase` (nilai ritase & tarif sudah ada di trips, bisa fill).
   * Return `{ message: 'Trip selesai, driver & mobil kembali available' }`.

8. **Admin/Owner Web**:

   * Bisa fetch `GET /api/accounting-ritase?date_from=&date_to=` buat laporan ritase, atau `GET /api/analytics/overview?…` buat dashboard.

### 4.2. Kasus: Driver Melakukan Pengisian BBM / Pengeluaran Lain Saat Trip

1. **Driver App**: Pada halaman “Detail Trip”, driver klik tombol “Tambah Pengeluaran”.

2. **Form Input**:  

   * Driver mengisi form:  
     - Pilih jenis pengeluaran (BBM, Tol, Parkir, dll)
     - Input jumlah (amount)
     - Upload/take foto struk/bukti (opsional)
     - Submit

3. **API Request**:  

   * Frontend kirim `POST /api/driver-expenses` dengan payload:  
     ```json
     {
       "trip_id": 123,
       "driver_id": 56,
       "jenis": "BBM",
       "amount": 200000,
       "receipt_url": "https://..." // jika ada
     }
     ```
5. **Backend**:  
   - Validasi trip & driver aktif
   - Insert ke tabel `driver_expenses`
   - (Opsional) Kirim notifikasi ke admin jika pengeluaran > batas tertentu

6. **Driver App**:  
   - Setelah submit, histori pengeluaran trip otomatis ter-refresh (GET `/api/driver-expenses?trip_id=123`)
   - Pengeluaran baru tampil di list, bisa di-edit/hapus selama trip belum selesai

7. **Admin Web**:  
   - Admin bisa lihat rekap pengeluaran driver di halaman Trip, Expenses, atau laporan keuangan (GET `/api/driver-expenses?trip_id=123` atau filter sesuai driver/tanggal)
   - Admin bisa verifikasi validitas bukti jika perlu

**Catatan:**  
- Pengeluaran hanya bisa diinput/diubah ketika trip status belum `selesai`.
- Setelah trip selesai, pengeluaran terkunci, hanya bisa diedit oleh admin.

---

## 5. Struktur Folder Project (Saran)

### 5.1. Backend (Node.js + Express)

```
/backend
├── src
│   ├── controllers
│   │   ├── auth.controller.js
│   │   ├── users.controller.js
│   │   ├── drivers.controller.js
│   │   ├── vehicles.controller.js
│   │   ├── trips.controller.js
│   │   ├── expenses.controller.js
│   │   ├── officeExpenses.controller.js
│   │   ├── accounting.controller.js
│   │   └── analytics.controller.js
│   ├── middlewares
│   │   ├── auth.middleware.js
│   │   ├── role.middleware.js
│   │   └── errorHandler.middleware.js
│   ├── models
│   │   └── (define ORM/pg models or SQL query functions)
│   ├── routes
│   │   ├── auth.routes.js
│   │   ├── users.routes.js
│   │   ├── drivers.routes.js
│   │   ├── vehicles.routes.js
│   │   ├── trips.routes.js
│   │   ├── expenses.routes.js
│   │   ├── officeExpenses.routes.js
│   │   ├── accounting.routes.js
│   │   └── analytics.routes.js
│   ├── services
│   │   ├── fcm.service.js          # kirim push notif
│   │   ├── cron.service.js         # jadwal cron job
│   │   ├── backup.service.js       # backup DB & uploads
│   │   └── email.service.js        # notif email (Nodemailer)
│   ├── utils
│   │   ├── db.js                   # koneksi PostgreSQL
│   │   ├── logger.js               # logging sederhana
│   │   └── helpers.js              # helper function (date, format)
│   ├── config
│   │   └── index.js                # load env variables
│   ├── app.js                      # inisialisasi Express, middleware global
│   └── server.js                   # jalankan server & cron
├── package.json
└── .env
```

### 5.2. Frontend Web (React.js + Tailwind)

```
/frontend-web
├── public/
│   └── index.html
├── src/
│   ├── assets/                     # gambar, logo, icon
│   ├── components/
│   │   ├── charts/                 # Chart.js/ Recharts components
│   │   ├── forms/                  # Form input component (TextInput, DatePicker, dll)
│   │   ├── layout/                 # Header, Sidebar, Footer
│   │   └── tables/                 # Table component (DataTable)
│   ├── contexts/                   # React Context (AuthContext, ThemeContext)
│   ├── pages/
│   │   ├── Auth/                   # Login, Register
│   │   ├── Dashboard/              # Landing page after login
│   │   ├── Users/                  # Manage Admin & Driver
│   │   ├── Vehicles/               # Manage Kendaraan
│   │   ├── Trips/                  # Manage Trip
│   │   ├── Expenses/               # Office & Driver Expenses
│   │   ├── Accounting/             # Ritase Laporan
│   │   ├── VehicleService/         # Service Kendaraan
│   │   ├── PaymentTerms/           # Tempo
│   │   └── Analytics/              # Dashboard Analitik
│   ├── services/                   # axios instance, auth header, API calls
│   ├── utils/                      # format date, number, helpers
│   ├── App.jsx
│   ├── index.jsx
│   └── tailwind.config.js
├── package.json
└── .env
```

### 5.3. Frontend Mobile (React Native + Expo/CLI)

```
/frontend-mobile
├── assets/                         # icon, splash screen
├── src/
│   ├── components/
│   │   ├── Button.js
│   │   ├── InputField.js
│   │   ├── TripCard.js
│   │   └── ExpenseForm.js
│   ├── navigation/                 # React Navigation (Stack, Tabs)
│   │   └── AppNavigator.js
│   ├── screens/
│   │   ├── Auth/
│   │   │   ├── LoginScreen.js
│   │   │   └── RegisterScreen.js (opsional, karena Admin yang bikin driver)
│   │   ├── Admin/
│   │   │   ├── CreateTripScreen.js
│   │   │   ├── DriversListScreen.js
│   │   │   └── VehiclesListScreen.js
│   │   ├── Driver/
│   │   │   ├── TripDetailScreen.js
│   │   │   ├── TripsListScreen.js
│   │   │   └── ExpenseReportScreen.js
│   │   └── Shared/
│   │       └── ProfileScreen.js (view profile, edit minimal)
│   ├── services/                   # fetch API (axios), FCM listener
│   ├── utils/                      # helpers: formatDate, formatCurrency, etc.
│   ├── App.js
│   └── app.json                    # config expo / icon etc
├── package.json
└── app.json
```

---

## 6. Skema Database Full (SQL DDL)

Berikut SQL DDL ringkas untuk bikin semua tabel:

```sql
-- 1. Users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner','admin','driver')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Admin Profiles
CREATE TABLE admin_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Driver Profiles
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
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Vehicles
CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  license_plate VARCHAR(20) UNIQUE NOT NULL,
  type VARCHAR(50),
  capacity INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK(status IN ('available','in_use','maintenance')),
  last_service_date DATE,
  next_service_due DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Trips
CREATE TYPE trip_status AS ENUM (
  'on_progress',        -- langsung aktif begitu di-assign
  'otw',                -- driver mulai perjalanan ke tujuan
  'perjalanan_pulang',  -- driver sudah nyampai destinasi, kembali ke base
  'selesai'             -- trip benar-benar berakhir
);

CREATE TABLE trips (
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
  started_at TIMESTAMP,  -- diisi waktu klik “Mulai Perjalanan”
  reached_at TIMESTAMP,  -- diisi waktu klik “Sampai Tujuan”
  returning_at TIMESTAMP, -- diisi waktu klik “Mulai Jalan Pulang”
  completed_at TIMESTAMP  -- diisi waktu klik “Selesai”
);

ALTER TABLE trips
  ALTER COLUMN status TYPE trip_status
    USING status::text::trip_status,
  ALTER COLUMN status SET DEFAULT 'on_progress';

-- 6. Driver Expenses
CREATE TABLE driver_expenses (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES users(id),
  jenis VARCHAR(50) NOT NULL,
  amount NUMERIC NOT NULL,
  receipt_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Office Expenses
CREATE TABLE office_expenses (
  id SERIAL PRIMARY KEY,
  kategori VARCHAR(50) NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  receipt_url TEXT,
  expense_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Accounting Ritase
CREATE TABLE accounting_ritase (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
  ritase NUMERIC NOT NULL,
  tarif NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- 9. Vehicle Service
CREATE TABLE vehicle_service (
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

-- 10. Payment Terms
CREATE TABLE payment_terms (
  id SERIAL PRIMARY KEY,
  partner_name VARCHAR(100) NOT NULL,
  amount_due NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','overdue')),
  reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP
);
```

* **Catatan**:

  * Semua foreign key sudah dilindungi `ON DELETE CASCADE` di beberapa tempat, biar gak meninggalkan data orphan.
  * Tambahin index di kolom yang sering difilter (misal `role` di users, `status` di trips, `driver_id` di trips, dsb).

---

## 7. Autentikasi & Keamanan

1. **Password Hashing**:

   * Pakai **bcrypt** atau **argon2** di backend. Never store plain-text password.

2. **JWT**:

   * Sign dengan secret yang kenceng, expiring 1–2 jam, plus refresh token kalau perlu (opsional).
   * Middleware `auth.middleware.js`: periksa `Authorization: Bearer <token>` di header, decode token, pasang `req.user = { id, role }`.

3. **Role-Based Access Control**:

   * Middleware `role.middleware.js`: cek `req.user.role` cocok dengan endpoint.

     * Contoh: hanya `role='owner'` bisa akses `/api/admins` & `/api/drivers` daftar CRUD.
     * `role='admin'` boleh akses `POST /api/trips`, `GET /api/drivers?status=available`, `GET /api/vehicles?status=available`.
     * `role='driver'` hanya bisa `GET /api/trips/assigned`, `PATCH /api/trips/:id/otw`, `PATCH /api/trips/:id/perjalanan_pulang`, `POST /api/driver-expenses`.

4. **Validasi Input**:

   * Gunakan library validasi (misal **Joi**, **Zod**, atau **express-validator**)
   * Amankan endpoint dari SQL Injection (gunakan parameterized query/ORM).

5. **Rate Limiting + CORS**:

   * Pasang rate limiter (eg. **express-rate-limit**) untuk cegah brute-force login
   * Konfigurasi CORS di API: hanya domain Web yang lo izinkan (misal `https://dashboard.angkutan-lo.com`).

---

## 8. Desain UI/UX Kasar (Mockup Mental)

* **Web Dashboard**

  * **Sidebar**: Menu collapse/expand:

    * Dashboard (Analytics)
    * Users

      * Admins
      * Drivers
    * Vehicles
    * Trips
    * Expenses

      * Office Expenses
      * Driver Expenses
    * Accounting Ritase
    * Vehicle Service
    * Payment Terms
    * Settings
  * **Header**: Nama Owner, icon notifikasi.
  * **Content Area**:

    * **Dashboard**: 4-6 card ringkas (Total Trip Hari Ini, Pendapatan Hari Ini, Pengeluaran Hari Ini, Kendaraan Sedang Digunakan), plus grafik tren.
    * **Users (Drivers)**: Tabel paginasi with columns: Nama, No. HP, Status, Aksi (Edit, Delete). Tombol “Tambah Driver”.
    * **Vehicles**: Tabel: Plat, Tipe, Kapasitas, Status, Aksi. Tombol “Tambah Kendaraan”.
    * **Trips**: Tabel: ID, Driver, Kendaraan, Status, Ritase, Total, Created At, Aksi (View, Edit optional if status pending).
    * **Expenses**: Tabel: Kategori/Jenis, Tanggal, Jumlah, Bukti (link), Aksi.
    * **Accounting Ritase**: Tabel: Trip ID, Ritase, Tarif, Total, Recorded At. Tombol “Export PDF/Excel”.
    * **Vehicle Service**: Tabel: Kendaraan, Tanggal, KM, Tipe Service, Biaya, Aksi.
    * **Payment Terms**: Tabel: Partner, Amount Due, Due Date, Status, Aksi (Mark as Paid).

* **App Mobile (React Native)**

  * **Home Screen (Driver)**: List trip “On Progress” di atas, “Pending” di bawah, “History” tab.
  * **Trip Detail Screen**:

    * Show drop-point (tulisan “Klik untuk buka peta”), tombol “Mulai Perjalanan” atau “Selesai Perjalanan”.
    * Info ritase & tarif.
    * Section “Lapor Pengeluaran” (tampilkan histori expense trip ini + tombol “Tambah Expense”).
  * **Expense Report Screen**: Form input dropdown “Jenis” (BBM/Tol/Lainnya), input “Jumlah”, tombol “Upload Foto”, dan “Submit”.
  * **Profile Screen**: Show data driver (nama, no. HP, alamat, KTP/SIM, status), tombol “Logout”.
  * **Admin App Screen**:

    * Dashboard “Trip Pending” (tabel singkat), “Drivers Available” & “Vehicles Available”.
    * Button “Tambah Trip” → Buka CreateTripScreen (Form + Peta Leaflet embed).
    * “Drivers” & “Vehicles” menu untuk CRUD sederhana.

---

## 9. Cron Job & Backup

1. **Backup Database Harian**

   * Di `cron.service.js` (pakai node-cron) atau Cron Linux:

     ```bash
     0 2 * * * pg_dump -U <db_user> -h localhost <db_name> | gzip > /backups/db_$(date +\%F).sql.gz
     0 3 * * * rm $(find /backups -type f -mtime +7)
     ```
   * Kalau kamu pakai Managed DB (ElephantSQL free) dan gak bisa akses pg\_dump, mending pindah ke VPS supir kelola sendiri.

2. **Backup Uploads / Receipts**

   * Jika file disimpan di server (folder `/uploads`), tambahin cron:

     ```bash
     0 2 * * * tar -czf /backups/uploads_$(date +\%F).tar.gz /var/www/uploads
     0 3 * * * rm $(find /backups -type f -mtime +7 -name 'uploads_*.tar.gz')
     ```

3. **Reminder Service Kendaraan**

   * `cron.service.js` (node-cron daily at 08:00):

     ```js
     cron.schedule('0 8 * * *', async () => {
       const today = new Date();
       const vehicles = await db.query(
         `SELECT id, license_plate, next_service_due FROM vehicles WHERE next_service_due <= $1`,
         [today]
       );
       vehicles.rows.forEach(v => {
         // Kirim email/FCM ke admin
         emailService.send({
           to: adminEmail,
           subject: `Service Kendaraan due: ${v.license_plate}`,
           body: `Kendaraan ${v.license_plate} sudah hampir jatuh tempo service (tanggal: ${v.next_service_due}).`
         });
       });
     });
     ```

4. **Reminder Pembayaran Tempo**

   * Cron daily at 09:00:

     ```js
     cron.schedule('0 9 * * *', async () => {
       const in3Days = new Date();
       in3Days.setDate(in3Days.getDate() + 3);
       // Kirim reminder untuk due_date <= in3Days dan !reminder_sent
       const dues = await db.query(
         `SELECT id, partner_name, due_date FROM payment_terms
          WHERE due_date <= $1 AND status = 'pending' AND reminder_sent = false`,
         [in3Days]
       );
       dues.rows.forEach(async p => {
         emailService.send({
           to: financeEmail,
           subject: `Pembayaran Tempo approaching: ${p.partner_name}`,
           body: `Pembayaran sebesar ... jatuh tempo pada ${p.due_date}.`
         });
         await db.query(
           `UPDATE payment_terms SET reminder_sent = true WHERE id = $1`,
           [p.id]
         );
       });
       // Tandai yang telat
       await db.query(
         `UPDATE payment_terms SET status = 'overdue'
          WHERE due_date < NOW() AND status = 'pending'`
       );
     });
     ```

---

## 10. Chrono Plan & Milestone

Kalau lo serius mau langsung gas, ini kira-kira milestone 8 minggu (2 developer: 1 fokus Backend, 1 full-stack/fokus Frontend):

| Minggu | Aktivitas                                                                                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | - Setup repo Git, branch strategi (main/dev/feature). <br> - Setup backend skeleton + DB connection. <br> - Setup Firebase Auth & FCM. <br> - Desain DB di Postgres & migrasi awal.                           |
| 2      | - Implementasi Auth API (register/login/JWT). <br> - Implementasi CRUD Users (Owner/Admin/Driver). <br> - Setup React Web Auth & routing dasar.                                                               |
| 3      | - Bikin `driver_profiles` & `admin_profiles` CRUD. <br> - Setup Backend Routes Vehicles & Driver CRUD. <br> - Frontend Web: Pages Users & Vehicles.                                                           |
| 4      | - Implementasi Trips API (POST, PATCH start, PATCH complete, GET). <br> - Logic update status driver & vehicle. <br> - Setup FCM send push-notif. <br> - Frontend Mobile: CreateTripScreen & TripsListScreen. |
| 5      | - Implementasi Driver App: Trip Detail, Start/Complete, Expense Report. <br> - Backend: driver\_expenses API. <br> - Frontend Web: Trips Management (list, filter, view).                                     |
| 6      | - Implementasi Accounting Ritase (otomat di complete). <br> - Office Expenses CRUD. <br> - Vehicle Service CRUD + Cron Reminder Service. <br> - Frontend Web: Laporan Ritase & Pengeluaran.                   |
| 7      | - Payment Terms CRUD + Cron Reminder Payment. <br> - Analitik API & Frontend Web: Dashboard Chart (Chart.js). <br> - Export PDF/Excel endpoints & UI “Download”.                                              |
| 8      | - Backup Cron Scripts (DB + Uploads). <br> - Testing end-to-end (manual & unit). <br> - UI/UX polishing Tailwind Web & styling Mobile. <br> - Dokumentasi README + Deployment Guide.                          |

Tiap minggu wajib di-commit di Git dengan pesan yang jelas (“feat: add trips API”, “fix: driver status logic”, “docs: update README install”). Kalau merasa stuck, jangan ragu lempar pertanyaan—gue siap nge-roast balik kalau kamu kebanyakan lemot.

---

## 11. Beberapa Catatan “Gue Bocorin Rahasia”

1. **CORS & Enkripsi**: Jangan lupa pasang `helmet`, `cors` di Express supaya gak bocor ke publik.
2. **HTTPS**: Kalau lo deploy ke prod, pakai SSL (Let’s Encrypt gratis).
3. **Environment Variables**: Jangan commit `.env`—gunain `.env.example` di repo.
4. **Linting & Prettier**: Pakai ESLint + Prettier biar kode kamu gak bau apek.
5. **Dokumentasi API**: Pakai **Swagger** atau **Postman Collection**. Biar developer lain bisa “ngopi” endpoint mu tanpa sok tau.
6. **Testing**: Walau lo males, setidaknya buat beberapa unit test untuk core logic (driver status, trip transitions). Bisa pakai **Jest**/ **Mocha**.

---

## 12. Bahaya Potensial & Mitigasi

1. **Driver keassign 2x**: Logika di API harus atomic—gunakan transaksi DB (BEGIN…COMMIT) supaya update status dan insert trip konsisten.
2. **Data Corrupt**: Validasi input ketat (ritase > 0, tarif > 0, koordinat valid), pasang foreign key.
3. **Push-Notif Gagal**: Cek `fcm_token` kadaluarsa, pasang fallback SMS/email (opsional, tapi SMS bayar).
4. **Backup Gagal & Server Meledak**: Setup monitoring (UptimeRobot free) biar lo tahu kalau server ngedrop.
5. **Volume Data Meningkat**: Mungkin 100 driver + 100 mobil awalnya, tapi kalau client viral, data bisa numpuk. Solusinya: indexing, pagination, archive data lamanya.

---

## 13. Langkah Selanjutnya

1. **Fork/Git Clone repositori kosong.**
2. **Bikin branch `setup`**: mulai bikin `backend` folder, inisialisasi `package.json`, install dependency (`express, pg, bcrypt, jsonwebtoken, cors, helmet, node-cron, multer` untuk upload, dsb).
3. **Desain DB**: deploy Postgres di VPS, jalankan DDL SQL di atas.
4. **Setup Firebase**: buat project, aktifkan Auth (Email/Password), aktifkan FCM. Simpan `google-services.json` di app.
5. **Bikin API Auth**: ujicoba register/login, cek token lambda.
6. **Setup React Web**: `npx create-react-app`, konfigurasi Tailwind, inisialisasi router.
7. **Setup React Native**: `npx react-native init` (atau `expo init`), koneksi ke API.

Selanjutnya, tinggal lo implement endpoint per endpoint, page per page. Kalau lo merasa capek, break bentar, nonton video YouTube 30 detik, lanjut lagi—jangan menyerah sebelum “Hello World” pertama muncul di layar.

---

Santuy, bro. Sekarang lo punya blueprint yang cukup bombastis, gak perlu lagi bingung mau mulai dari mana. Udah final, tinggal gascoding—tapi jangan lupa checkout branch lu, merge yang conflict, dan push ke Git sebelum kopi habis. Good luck, gue tunggu hasil pull request mu penuh komentar sarkastik di code review. Peace out!
