#!/bin/sh

# Tunggu DB siap
echo "Menunggu database siap..."
until nc -z -v -w30 mariadb-db-1 3306; do
  echo "Menunggu koneksi ke MariaDB di host mariadb-db-1:3306..."
  sleep 2
done

echo "Database siap! Jalankan migrasi dan seed..."

# Jalankan migrasi dan seed
npx sequelize db:migrate && npx sequelize db:seed:all

# Jalankan aplikasi
npm start
