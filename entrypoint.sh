#!/bin/sh

# Load .env secara manual (jika belum di-load oleh Docker)
export $(grep -v '^#' .env | xargs)

# Gunakan variabel dari .env
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3306}

echo "🔄 Menunggu database di $DB_HOST:$DB_PORT..."

until nc -z -v -w30 $DB_HOST $DB_PORT; do
  echo "❌ Belum terhubung ke MariaDB di $DB_HOST:$DB_PORT..."
  sleep 2
done

echo "✅ Database siap! Jalankan migrasi dan seed..."

npx sequelize db:migrate && npx sequelize db:seed:all

npm start
