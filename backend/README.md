# 4. Set Up Firebase Admin untuk Auth & FCM

Kalau lo mau pakai Firebase untuk autentikasi di App dan push-notif, kita perlu Firebase Admin SDK di backend. Langkahnya:

1. Buat project di Firebase Console (kalau belum):

- Masuk ke console.firebase.google.com, klik “Add project”, isi nama (misal angkutan-project).

- Setelah project jadi, di bagian Settings → Service Accounts → klik “Generate new private key”.

- Ini bakal download file JSON (contoh: angkutan-firebase-adminsdk.json).

- Pindahkan file JSON ini ke folder backend/ (atau backend/firebase/ kalau mau teratur):

`Copy
Edit
backend/
├── firebase-adminsdk.json   <-- service account key
└── ... `

JANGAN commit file ini ke Git. Tambahkan ke .gitignore:

gitignore

# di backend/.gitignore

`firebase-adminsdk.json`
