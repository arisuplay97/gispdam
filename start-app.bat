@echo off
echo Mengaktifkan Smart Water System...
echo ------------------------------------------
echo.

:: Konfigurasi Database (Ganti jika password postgres Anda berbeda)
set DATABASE_URL=postgresql://postgres:@localhost:5432/gis_pdam

:: Push Schema ke Database (Otomatis membuat tabel jika belum ada)
echo Menyiapkan struktur Database (Push Schema)...
call cmd /c "set DATABASE_URL=%DATABASE_URL% && cd lib\db && pnpm run push"
echo Database siap!
echo.

:: Menjalankan Backend (API Server) di Port 3000
echo Memulai API Server...
start cmd /c "cd artifacts\api-server && set PORT=3000 && set DATABASE_URL=%DATABASE_URL% && set NODE_ENV=development && pnpm run dev"

:: Menjalankan Frontend (Vite React) di Port 5173
echo Memulai Smart Water Client (Frontend)...
start cmd /c "cd artifacts\smart-water && set PORT=5173 && set BASE_PATH=/ && pnpm run dev"

echo.
echo ========================================================
echo Tunggu beberapa saat sampai Node.js dan Vite nyala...
echo.
echo - API Backend bisa dicek di: http://localhost:3000/api/health
echo - BUKA WEB DI BROWSER: http://localhost:5173
echo ========================================================
pause
