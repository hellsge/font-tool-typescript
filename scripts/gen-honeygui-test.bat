@echo off
cd /d "%~dp0\.."
echo === Generating honeygui_test fonts ===
node bin/font-converter.js examples/honeygui_test.json
pause
