@echo off
title SnapQuiz
cd /d "%~dp0"
if not exist node_modules call npm install --no-audit --no-fund
node --use-system-ca server.js
pause
