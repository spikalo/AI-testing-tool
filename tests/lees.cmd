@echo off
rem Leest een sectie uit het gegenereerde paper terug en schrijft hem naar
rem experimenten\<log>. Bestaat omdat de aanroep hier via PowerShell loopt en die de
rem omleiding anders zelf afvangt.
rem   tests\lees.cmd "<vanaf tekst>" "<tot tekst>" <log.txt>
cd /d "%~dp0.."
node tests\lees-sectie.js %1 %2 > "experimenten\%~3" 2>&1
echo KLAAR exitcode=%ERRORLEVEL% >> "experimenten\%~3"
