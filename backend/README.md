# Angkutan System - Backend Documentation

## Struktur Direktori Backend

```
backend/
├── .env                  # Environment variables configuration
├── .env.example          # Example environment variables template
├── .gitignore            # Git ignore rules
├── package.json          # Project dependencies and scripts
├── package-lock.json
├── README.md             # Project documentation
├── node_modules/
└── src/                  # Source code directory
    ├── server.js         # Main application entry point
    ├── config/           # Configuration files
    │   ├── database.js
    │   └── angkutan-system-d87e3-ef128576fdb9.json  # Firebase credentials
    ├── controllers/      # Business logic handlers
    │   ├── auth.controller.js
    │   ├── deliveryOrder.controller.js
    │   ├── driverExpenseController.js
    │   ├── firebase.controller.js
    │   ├── health.controller.js
    │   ├── purchaseOrder.controller.js
    │   ├── user.controller.js
    │   └── vehicleController.js
    ├── middlewares/      # Express middleware functions
    │   ├── auth.middleware.js
    │   ├── error.middleware.js
    │   ├── setup.middleware.js
    │   └── validation.middleware.js
    ├── migrations/       # Database migration files
    │   ├── seeder.sql
    │   └── init.sql
    ├── models/           # Sequelize models
    │   ├── adminProfile.model.js
    │   ├── deliveryOrder.model.js
    │   ├── driverExpense.model.js
    │   ├── driverProfile.model.js
    │   ├── index.js
    │   ├── purchaseOrder.model.js
    │   ├── Trip.js
    │   ├── user.model.js
    │   ├── vehicle.model.js
    │   ├── vehicleService.model.js
    │   └── helpers/
    │       └── validation.js
    ├── routes/           # API route definitions
    │   ├── auth.routes.js
    │   ├── deliveryOrder.routes.js
    │   ├── driverExpense.routes.js
    │   ├── firebase.routes.js
    │   ├── health.routes.js
    │   ├── purchaseOrder.routes.js
    │   ├── user.routes.js
    │   └── vehicle.routes.js
    ├── services/         # External service integrations
    │   └── firebase.js
    └── utils/            # Utility functions
        ├── db.js
        ├── hashPasswords.js
        ├── migrateFresh.js
        ├── runMigrations.js
        ├── runSeeder.js
        └── verifyFirebaseToken.js
uploads/
    ├── receipts/
    ├── surat_jalan/
    └── surat-jalan/
```

## Environment Variables

Buat file `.env` di root backend dengan format berikut:

```
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=angkutan_db
DB_USER=angkutan_user
DB_PASS=user123

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_complex

# Firebase
GOOGLE_APPLICATION_CREDENTIALS=./src/config/angkutan-system-d87e3-ef128576fdb9.json
FIREBASE_PROJECT_ID=angkutan-system

# Server
PORT=8080
NODE_ENV=development
```

## Menjalankan Server

```bash
# Install dependencies
npm install

# Development mode (auto-reload)
npm run dev

# Production mode
npm start

# Jalankan migrasi database
npm run migrate

# Jalankan seeder (isi data awal)
npm run seed
```

## API Endpoints Documentation

### Base URL

```
http://localhost:8080/api
```

### 1. Health Check Endpoints

- **GET /health**  
  Cek status API  
  **Response:**

  ```json
  { "status": "OK", "timestamp": "2025-06-08T10:00:00.000Z" }
  ```

- **GET /db-test**  
  Cek koneksi database  
  **Response:**
  ```json
  { "dbTime": "2025-06-08 10:00:00.000000" }
  ```

### 2. Authentication Endpoints

- **POST /auth/register**  
  Register user baru (admin/owner/driver)  
  **Body:**

  ```json
  {
    "username": "string",
    "password": "string",
    "role": "owner|admin|driver",
    "fullName": "string",
    "phone": "string",
    "email": "string",
    "address": "string",
    "idCardNumber": "string (required for driver)",
    "simNumber": "string (optional for driver)",
    "licenseType": "string (optional for driver)"
  }
  ```

  **Response:**

  ```json
  {
    "message": "User registered successfully",
    "userId": 1,
    "role": "driver",
    "username": "supir_andi"
  }
  ```

- **POST /auth/login**  
  Login user  
  **Body:**
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
  **Response:**
  ```json
  {
    "message": "Login successful",
    "token": "jwt_token"
  }
  ```

### 3. Delivery Order & Trip Endpoints

- **GET /delivery-orders/me**  
  List DO yang sedang/selesai untuk driver login

- **PATCH /delivery-orders/:id/:action**  
  Update status DO (`start`, `arrive`, `return`, `complete`)

- **GET /delivery-orders/:id**  
  Detail DO (termasuk riwayat pengeluaran driver)

- **POST /delivery-orders**  
  (Admin) Membuat DO baru

### 4. Driver Expense Endpoints

- **GET /driver-expenses**  
  List pengeluaran driver (hanya milik sendiri)

- **POST /driver-expenses**  
  Tambah pengeluaran (dengan upload foto struk)

- **DELETE /driver-expenses/:id**  
  Hapus pengeluaran

### 5. Purchase Order Endpoints

- **GET /purchase-orders**  
  List PO

- **GET /purchase-orders/:id**  
  Detail PO

### 6. Vehicle Endpoints

- **GET /vehicles**  
  List kendaraan

- **GET /vehicles/:id**  
  Detail kendaraan (termasuk riwayat servis)

### 7. Firebase Test Endpoints

- **GET /test-auth**  
  Test Firebase Auth  
  **Response:**

  ```json
  { "message": "Firebase Auth is working", "testToken": "string" }
  ```

- **GET /protected**  
  Test protected route (butuh token Firebase)  
  **Headers:**  
  `Authorization: Bearer {token}`  
  **Response:**
  ```json
  {
    "message": "Hello, user@email.com! This is a protected route",
    "user": {
      "email": "string",
      "uid": "string"
    }
  }
  ```

## Error Responses

Semua endpoint bisa mengembalikan error berikut:

- **400 Bad Request**
  ```json
  { "error": "Validation error", "details": ["List of validation errors"] }
  ```
- **401 Unauthorized**
  ```json
  {
    "error": "Unauthorized",
    "message": "Invalid token or missing authentication"
  }
  ```
- **500 Internal Server Error**
  ```json
  {
    "error": "Internal Server Error",
    "details": "Error message (only in development)"
  }
  ```

## Request Headers

- `Content-Type: application/json`
- `Authorization: Bearer {token}` (untuk endpoint yang butuh login)

## Database Schema

Lihat file migrasi SQL di `src/migrations/` (`init.sql`, `seeder.sql`) untuk struktur tabel lengkap.

---

**Catatan:**

- Untuk upload file (struk, surat jalan), file akan disimpan di folder `uploads/`.
- Untuk setup Firebase Admin, pastikan file JSON credential sudah ada di `src/config/` dan sudah diatur di `.env`.
