# Angkutan System - Mobile (Expo React Native)

Aplikasi mobile untuk sistem manajemen angkutan, dibangun dengan [Expo](https://expo.dev) dan React Native. Mendukung fitur driver, admin, pengelolaan trip, pengeluaran, dan kendaraan.

---

## Struktur Direktori

```
mobile/
├── .env                  # Konfigurasi environment (API URL, dsb)
├── .env.example          # Template environment
├── .gitignore
├── app.json              # Konfigurasi Expo
├── package.json
├── tsconfig.json
├── README.md
├── node_modules/
├── app/
│   ├── _layout.tsx
│   ├── (admin)/          # Halaman admin (buat trip, dsb)
│   │    ├── _layout.tsx
│   │    ├── create-trip.tsx
│   │    ├── index.tsx
│   │    └── do-detail/[id].tsx
│   ├── (auth)/           # Halaman login/register
│   │    ├── _layout.tsx
│   │    ├── login.tsx
│   │    └── register.tsx
│   ├── (tabs)/           # Halaman utama driver (trip, expense, vehicle, dsb)
│   │    ├── _layout.tsx
│   │    ├── vehichle.tsx
│   │    └── index.tsx
│   └── trip-detail/      # Detail trip & pengeluaran
├── assets/
│   ├── fonts/
│   └── images/
├── components/
│   ├── ui/
│   ├── Collapsible.tsx
│   ├── ExternalLink.tsx
│   ├── HapticTab.tsx
│   ├── HelloWave.tsx
│   ├── LoadConfirmationModal.tsx
│   ├── MapSelector.native.tsx
│   ├── MapSelector.web.tsx
│   ├── MapSelector.tsx
│   ├── ParallaxScrollView.tsx
│   ├── ThemedText.tsx
│   └── ThemedView.tsx
├── constants/
│   └── Colors.ts
├── hooks/
│   ├── useColorScheme.ts
│   ├── useColorScheme.web.ts
│   └── useThemeColor.ts
├── scripts/
│   └── reset-project.js
└── src/
    ├── contexts/
    │   └── AuthContext.tsx
    └── services/
        └── api.js
```

---

## Environment Variables

Buat file `.env` di root `mobile/` dengan format berikut:

```
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api
```

---

## Menjalankan Aplikasi

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Jalankan aplikasi**

   ```bash
   npx expo start
   ```

   Pilih untuk membuka di:

   - Android emulator
   - iOS simulator
   - Expo Go (scan QR)
   - Web browser

---

## Fitur Utama

- **Autentikasi**: Login/register driver & admin.
- **Dashboard Driver**: Lihat tugas trip, status, dan saldo uang jalan.
- **Detail Trip**: Rincian perjalanan, status, dan riwayat pengeluaran.
- **Pengeluaran Driver**: Tambah, lihat, dan hapus pengeluaran (dengan upload foto struk).
- **Manajemen Kendaraan**: Lihat detail kendaraan & riwayat servis.
- **Admin**: Buat trip/DO baru, assign driver & kendaraan, upload surat jalan.
- **Integrasi Kamera & Galeri**: Upload foto struk dari kamera/galeri (mobile & web).
- **Routing berbasis file**: Navigasi otomatis sesuai struktur folder.

---

## Catatan Pengembangan

- **File-based routing**: Semua file di dalam `app/` otomatis menjadi route.
- **Context Auth**: Lihat `src/contexts/AuthContext.tsx` untuk manajemen login.
- **API Service**: Semua request ke backend melalui `src/services/api.js`.
- **Kompatibel Web & Mobile**: Beberapa fitur (upload, kamera) otomatis menyesuaikan platform.

---

## Tips

- Untuk development, pastikan backend sudah berjalan di alamat yang sama dengan `EXPO_PUBLIC_API_BASE_URL`.
- Untuk upload file di web, gunakan browser yang mendukung input file.
- Untuk fitur lokasi, pastikan sudah memberi izin lokasi di perangkat.

---

## Sumber Belajar

- [Expo documentation](https://docs.expo.dev/)
- [React Native docs](https://reactnative.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)

---

## Komunitas

- [Expo di GitHub](https://github.com/expo/expo)
-
