@echo off
echo ========================================
echo   Educalcul - Cloudflare Tunnels
echo ========================================
echo.
echo Demarrage du tunnel Next.js (port 3000)...
start "Tunnel Next.js" cmd /k "cloudflared tunnel --url http://localhost:3000"

echo.
echo Le tunnel Next.js est ouvert.
echo Copie l'URL https://xxxx.trycloudflare.com affichee dans la fenetre.
echo.
echo - URL Next.js  =^> donne-la a ton ami pour acceder a l'app
echo.
pause
