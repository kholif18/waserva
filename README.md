# 📦 Waserva - WhatsApp Gateway Multi-User

**Waserva** adalah gateway WhatsApp berbasis web, mendukung banyak pengguna (multi-user) dengan fitur pengiriman pesan lengkap, integrasi API Client, retry, rate-limit, statistik, dan sistem update otomatis. Dibangun dengan **Node.js**, **Express**, **Sequelize**, dan **whatsapp-web.js**.

---

## 🚀 Fitur Utama

- Autentikasi dan manajemen **multi-user**
- **Multi sesi WhatsApp** per pengguna (QR login)
- Pengiriman pesan:
  - ✅ Teks
  - ✅ Media dari URL
  - ✅ Upload file
  - ✅ Grup
  - ✅ Bulk
- **Antrian (queue)** dan **retry otomatis**
- **Rate limit** & timeout per user
- Halaman **dashboard statistik**
- **Manajemen API Client** (register, token, status aktif)
- Panel tester internal API Client
- **Real-time QR Code** via socket.io
- **Backup & restore session otomatis**
- Sistem **update otomatis** via GitHub Releases

---

## ⚙️ Teknologi

| Komponen       | Teknologi                  |
|----------------|-----------------------------|
| Backend        | Node.js, Express.js         |
| Database       | MariaDB / MySQL (Sequelize) |
| WhatsApp API   | [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) |
| Frontend       | EJS + Bootstrap             |
| Penyimpanan Session | LocalAuth (per folder user) |

---

## 🧱 Struktur Proyek

```
waserva/
├── app.js
├── setup.js             # Script setup sekali klik
├── config/
├── controllers/
├── middlewares/
├── models/
├── routes/
├── services/
├── views/
│   └── pages/
│       ├── dashboard.ejs
│       ├── message.ejs
│       ├── tester.ejs
│       └── login-whatsapp.ejs
├── public/
├── sessions/            # Folder sesi WhatsApp
├── tmp/                 # Temp folder untuk update
├── Dockerfile
├── docker-compose.yml
├── .env
└── .gitignore
```

---

## 🔧 Instalasi Manual (Lokal)

### 1. Clone Repository

```bash
git clone https://github.com/kholif18/waserva.git
cd waserva
```

### 2. Install Dependency

```bash
npm install
```

### 3. Konfigurasi `.env`

Buat file `.env` berdasarkan `.env.example`:

```ini
PORT=3000
ADMIN_USER_ID=1
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=yourpassword
DB_NAME=waserva
```

### 4. Migrasi Database

```bash
npx sequelize-cli db:create
npx sequelize-cli db:migrate
```

### 5. Jalankan Aplikasi

```bash
node app.js
```

Akses di: [http://localhost:3000](http://localhost:3000)

---

## ⚙️ Instalasi Sekali Klik

Untuk instalasi cepat:

```bash
npm run setup
```

Fungsi `setup.js`:
- Membuat folder `sessions/`
- Duplikat `.env.example`
- Install dependensi
- Migrasi database

---

## 🐳 Instalasi via Docker

### 1. Jalankan:

```bash
docker compose up -d
```

### 2. Akses:

- Aplikasi: [http://localhost:3000](http://localhost:3000)
- MariaDB: `localhost:3306` (user: `root`, password: `root`)

### 3. Volume penting:

```yaml
volumes:
  - ./sessions:/app/sessions
```

---

## 🔄 Update Aplikasi

1. Buka: `/admin/check-update`
2. Klik **Install Update**
3. Sistem akan:
   - Backup otomatis
   - Ambil versi terbaru dari GitHub
   - Salin file (tanpa menimpa `.env`, `sessions`, `uploads`)
   - Jalankan migrasi DB

---

## 🔐 Keamanan

- Akses data dibatasi per user
- API Token hanya dapat dilihat saat dibuat
- Semua sesi WhatsApp disimpan secara lokal dan terisolasi
- User role `System Admin` hanya satu (akses penuh update)

---

## 📌 Catatan Tambahan

- File yang **harus di-ignore**:
  ```
  .env
  sessions/
  .wwebjs_cache/
  ```
- Jalankan dengan `nodemon` (dev):
  ```bash
  npm install -g nodemon
  nodemon app.js
  ```

---

## 👤 Pengembang

Dikembangkan oleh [@kholif18](https://github.com/kholif18)  
MIT License © [Rahmad N. K. R. / Ravaa Creative]