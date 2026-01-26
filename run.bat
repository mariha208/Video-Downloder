@echo off
TITLE Video Downloader Server
echo Starting Video Downloader...
echo.

:: Start the server in the background
start /B node server.js

:: Wait for server to initialize (2 seconds)
timeout /t 2 /nobreak > nul

:: Open the browser
start http://localhost:3000

echo.
echo Server is running at http://localhost:3000
echo You can close this window now.
echo.
pause
