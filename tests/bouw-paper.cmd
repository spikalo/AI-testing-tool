@echo off
cd /d "%~dp0..\paper"
node paper.js > "..\experimenten\paper-bouw-log.txt" 2>&1
echo KLAAR exitcode=%ERRORLEVEL% >> "..\experimenten\paper-bouw-log.txt"
