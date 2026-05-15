@echo off
REM LLaVA 1.5 7B Startup Script for Windows
REM This script automatically starts Ollama and the dev server

echo.
echo ============================================================
echo   Educalcul - LLaVA 1.5 7B Local AI Setup
echo ============================================================
echo.

REM Check if Ollama is installed
where ollama >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Ollama is not installed!
    echo.
    echo Please install Ollama from: https://ollama.ai
    echo.
    pause
    exit /b 1
)

echo [INFO] Starting Ollama service...
start "" ollama serve

REM Wait for Ollama to be ready
echo [INFO] Waiting for Ollama to start (up to 30 seconds)...
setlocal enabledelayedexpansion
set "retries=0"
:wait_loop
if %retries% geq 30 (
    echo [ERROR] Ollama failed to start!
    pause
    exit /b 1
)

timeout /t 1 /nobreak >nul
REM Simple check - if we can connect, it's ready
curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    set /a retries=%retries%+1
    goto wait_loop
)

echo [SUCCESS] Ollama is ready!
echo.
echo [INFO] Checking for LLaVA 1.5 7B model...
ollama list | find "llava:7b" >nul
if errorlevel 1 (
    echo [INFO] LLaVA model not found. Pulling it now...
    echo [NOTE] First run may take 10+ minutes...
    echo.
    call ollama pull llava:7b
)

echo.
echo ============================================================
echo [SUCCESS] LLaVA 1.5 7B is ready!
echo ============================================================
echo.
echo [INFO] Starting development server...
echo.

REM Start the dev server
call npm run dev

pause
