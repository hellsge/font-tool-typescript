@echo off
cd /d "%~dp0\.."
node scripts/pack-deploy.js --zip
pause
