@echo off
title StudyHub - Tro Ly Hoc Tap Sinh Vien
echo ==========================================================
echo          DANG KHOI DONG STUDYHUB LOCAL SERVER...
echo ==========================================================
echo.
echo Dang mo trinh duyet tai: http://localhost:3000
echo (Nhan Ctrl+C neu ban muon dung server)
echo.

start http://localhost:3000

python -m http.server 3000
if %errorlevel% neq 0 (
    echo.
    echo Khong tim thay Python, dang thu khoi dong bang Node...
    npx serve -l 3000 .
)

pause
