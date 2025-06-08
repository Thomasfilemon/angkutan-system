# 4. Set Up Firebase Admin untuk Auth & FCM

Kalau lo mau pakai Firebase untuk autentikasi di App dan push-notif, kita perlu Firebase Admin SDK di backend. Langkahnya:

1. Buat project di Firebase Console (kalau belum):

- Masuk ke console.firebase.google.com, klik “Add project”, isi nama (misal angkutan-project).

- Setelah project jadi, di bagian Settings → Service Accounts → klik “Generate new private key”.

- Ini bakal download file JSON (contoh: angkutan-firebase-adminsdk.json).

- Pindahkan file JSON ini ke folder backend/ (atau backend/firebase/ kalau mau teratur):

`backend/
├── /src
├   └─ /config
├       └─ firebase-adminsdk.json   <-- service account key
└── ...`

JANGAN commit file ini ke Git. Tambahkan ke .gitignore:

gitignore

# di backend/.gitignore

`firebase-adminsdk.json`

# Struktur Direktori Backend

`backend/
├── .env                 # Environment variables configuration
├── .env.example        # Example environment variables template
├── .gitignore         # Git ignore rules
├── package.json       # Project dependencies and scripts
├── README.md         # Project documentation
└── src/              # Source code directory
    ├── server.js     # Main application entry point
    ├── config/       # Configuration files
    │   └── angkutan-system-firebase-adminsdk-fbsvc-35bb803ee3.json  # Firebase credentials
    │
    ├── controllers/  # Business logic handlers
    │   ├── auth.controller.js      # Authentication logic
    │   ├── firebase.controller.js  # Firebase-related operations
    │   └── health.controller.js    # API health check endpoints
    │
    ├── middlewares/  # Express middleware functions
    │   ├── error.middleware.js     # Global error handler
    │   ├── setup.middleware.js     # App-wide middleware setup
    │   └── validation.middleware.js # Request validation rules
    │
    ├── migrations/   # Database migration files
    │   └── init.sql  # Initial database schema
    │
    ├── models/      # Data models (currently empty)
    │
    ├── routes/      # API route definitions
    │   ├── auth.routes.js     # Authentication endpoints
    │   ├── firebase.routes.js # Firebase-related endpoints
    │   └── health.routes.js   # Health check endpoints
    │
    ├── services/    # External service integrations
    │   └── firebase.js  # Firebase Admin SDK setup
    │
    └── utils/       # Utility functions
        ├── db.js               # Database connection setup
        ├── runMigrations.js    # Database migration runner
        └── verifyFirebaseToken.js  # Firebase token verification`

# Angkutan System - Backend Documentation

## API Endpoints Documentation

### Base URL

```
http://localhost:8080/api
```

### 1. Health Check Endpoints

#### Check API Status

```
GET /health
```

- **Purpose**: Verify if the API is running
- **Response**:

```json
{
  "status": "OK",
  "timestamp": "2025-06-08T10:00:00.000Z"
}
```

#### Check Database Connection

```
GET /db-test
```

- **Purpose**: Test PostgreSQL database connection
- **Response**:

```json
{
  "dbTime": "2025-06-08 10:00:00.000000"
}
```

### 2. Authentication Endpoints

#### Register New User

```
POST /auth/register
```

- **Purpose**: Register new user (admin/owner/driver)
- **Request Body**:

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

- **Response**:

```json
{
  "message": "User registered successfully",
  "userId": "number",
  "role": "string",
  "username": "string"
}
```

#### Login

```
POST /auth/login
```

- **Purpose**: Authenticate user
- **Request Body**:

```json
{
  "username": "string",
  "password": "string"
}
```

- **Response**:

```json
{
  "message": "Login successful",
  "token": "string"
}
```

### 3. Firebase Test Endpoints

#### Test Firebase Auth

```
GET /test-auth
```

- **Purpose**: Test Firebase authentication setup
- **Response**:

```json
{
  "message": "Firebase Auth is working",
  "testToken": "string"
}
```

#### Protected Route Test

```
GET /protected
```

- **Purpose**: Test protected route with Firebase authentication
- **Headers**:
  - `Authorization: Bearer {token}`
- **Response**:

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

All endpoints may return these error responses:

### 400 Bad Request

```json
{
  "error": "Validation error",
  "details": ["List of validation errors"]
}
```

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Invalid token or missing authentication"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal Server Error",
  "details": "Error message (only in development)"
}
```

## Request Headers

- `Content-Type: application/json`
- `Authorization: Bearer {token}` (for protected routes)

## Environment Variables

Required environment variables in `.env` file:

```
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=angkutan_db
DB_USER=angkutan_user
DB_PASS=user123

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_complex

# Firebase (you'll get these from Firebase Console)
GOOGLE_APPLICATION_CREDENTIALS=./src/config/angkutan-system-firebase-adminsdk-fbsvc-35bb803ee3.json

FIREBASE_PROJECT_ID=angkutan-system

# Server
PORT=3000
NODE_ENV=development
```

## Database Schema

Please refer to the SQL migration files in `src/migrations/` for the complete database schema.

## Running the Server

```bash
# Development mode
npm run dev

# Production mode
npm start

# Run database migrations
npm run migrate
```
