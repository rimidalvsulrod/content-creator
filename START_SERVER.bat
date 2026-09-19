@echo off
REM Content Creator Backend Server Startup Script
REM This script starts the video processing backend on port 3001

echo.
echo ========================================
echo Content Creator - Backend Server
echo ========================================
echo.
echo Checking for FFmpeg...
ffmpeg -version >nul 2>&1
if errorlevel 1 (
    echo ERROR: FFmpeg not found!
    echo Please install FFmpeg from https://ffmpeg.org/download.html
    echo Or on Windows: choco install ffmpeg
    pause
    exit /b 1
)
echo ✓ FFmpeg found
echo.

echo Starting backend server on port 3001...
echo Once running, you have two options:
echo.
echo Option 1: LOCAL (development)
echo   - Frontend: http://localhost:5173
echo   - Backend: http://localhost:3001
echo.
echo Option 2: CLOUD (production with tunneling)
echo   - Install ngrok: npm install -g ngrok
echo   - In another terminal: ngrok http 3001
echo   - Use ngrok URL in your Vercel environment variables
echo.

node server.js
pause
