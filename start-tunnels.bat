@echo off
echo ========================================
echo   Educalcul - Cloudflare Tunnels
echo ========================================
echo.
echo Demarrage du tunnel Next.js (port 3000)...
start "Tunnel Next.js" cmd /k "cloudflared tunnel --url http://localhost:3000"

echo Demarrage du tunnel Ollama (port 11434)...
start "Tunnel Ollama" cmd /k "cloudflared tunnel --url http://localhost:11434"

echo.
echo Les 2 fenetres de tunnel sont ouvertes.
echo Copie les URLs https://xxxx.trycloudflare.com affichees dans chaque fenetre.
echo.
echo - URL Next.js  =^> donne-la a ton ami pour acceder a l'app
echo - URL Ollama   =^> optionnel, si ton ami a besoin d'Ollama directement
echo.
pause
