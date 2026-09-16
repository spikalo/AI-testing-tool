@echo off
rem Hulpje: draai een node-script uit tests/ met de projectmap als werkmap en schrijf
rem de uitvoer naar experimenten\<log>. Bestaat omdat de aanroep hier via PowerShell
rem loopt en die de omleiding anders zelf afvangt.
rem   tests\draai.cmd <script.js> <log.txt>
cd /d "%~dp0.."
node "tests\%~1" > "experimenten\%~2" 2>&1
echo KLAAR exitcode=%ERRORLEVEL% >> "experimenten\%~2"
