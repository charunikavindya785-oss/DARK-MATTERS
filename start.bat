@echo off
title SmartQ - Intelligent Queue Management & Service Allocation
echo ======================================================================
echo             Starting SmartQ Intelligent Queue Engine
echo          BuildX 0.1 Hackathon - Challenge 10 Application
echo ======================================================================
echo.

set ELECTRON_RUN_AS_NODE=1

if exist "C:\Users\charu\AppData\Local\Programs\antigravity\Antigravity.exe" (
  start "" http://localhost:3000
  "C:\Users\charu\AppData\Local\Programs\antigravity\Antigravity.exe" backend\server.js
) else (
  start "" http://localhost:3000
  node backend\server.js
)

pause
