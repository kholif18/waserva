# 🟢 Waserva

**Waserva** adalah sistem pengelolaan WhatsApp multi-user berbasis web, dibangun dengan Node.js, Express, Sequelize, dan WhatsApp Web JS. Aplikasi ini memungkinkan pengguna untuk mengelola sesi WhatsApp, mengirim pesan (teks, media, bulk, grup), serta melihat log dan histori pesan dengan kontrol penuh.

---

## Fitur Utama

- Autentikasi dan manajemen multi-user
- Multi sesi WhatsApp per user
- Pengiriman pesan:
  - Teks
  - Media dari URL
  - Upload file
  - Grup
  - Bulk
- Antrian pengiriman (queue)
- Retry otomatis dengan interval dan batas maksimum
- Pengaturan per user (country code, timeout, rate limit, dll.)
- Halaman Dashboard dengan statistik pengiriman
- Riwayat pesan dan log (dengan auto-prune)
- API Client Management (register, token, status aktif)
- Halaman Tester Internal untuk kirim pesan langsung
- Integrasi socket.io untuk update real-time QR code

---

## Teknologi

- **Backend**: Node.js, Express.js
- **Database**: MariaDB / MySQL (via Sequelize)
- **WhatsApp API**: [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)
- **Frontend**: EJS + Bootstrap
- **Session Storage**: `LocalAuth` (folder per user)

---

## ⚙️ Instalasi

### 1. Clone proyek

```bash
git clone https://github.com/kholif18/waserva.git
cd waserva
```

### 2. Install dependensi

```bash
npm install
```

### 3. Konfigurasi `.env`

Buat file `.env` berdasarkan `.env.example`, isi sesuai koneksi database:

```ini
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=yourpassword
DB_NAME=waserva_db
SESSION_SECRET=somesupersecret
```

### 4. Buat database & migrasi

```bash
npx sequelize-cli db:create
npx sequelize-cli db:migrate
```

### 5. Jalankan aplikasi

```bash
node app.js
```

Akses di: [http://localhost:3000](http://localhost:3000)

---

## Struktur Folder

```
waserva/
├── app.js
├── config/
├── controllers/
├── models/
├── migrations/
├── services/
├── views/
│   └── pages/
│       ├── dashboard.ejs
│       ├── message.ejs
│       ├── tester.ejs         # Tester internal API Client
│       └── login-whatsapp.ejs
├── sessions/            # Folder penyimpanan session WhatsApp
├── public/
├── .env
└── .gitignore
```

---

## Keamanan

- Setiap user hanya dapat mengakses data miliknya sendiri
- Session WhatsApp disimpan lokal per user
- Token API client bersifat rahasia dan dapat diganti

---

## Pengembangan

### Menjalankan dalam mode dev (rekomendasi)
```bash
npm install -g nodemon
nodemon app.js
```

### Jalankan linting (jika diterapkan)
```bash
npm run lint
```

---

## Git Ignore

Pastikan file berikut **tidak ikut dikommit**:
```
.env
sessions/
.wwebjs_cache/
```

---

## Lisensi

MIT © [Rahmad N. K. R. / Ravaa Creative]
