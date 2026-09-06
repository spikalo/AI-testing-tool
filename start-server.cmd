@echo off
rem ---------------------------------------------------------------------------
rem  Lokaal model lab - start een kleine webserver in deze map.
rem
rem  Waarom: als je de HTML-bestanden rechtstreeks vanaf schijf opent (file://),
rem  stuurt de browser "Origin: null" mee en weigert Ollama de verbinding (CORS).
rem  Via http://localhost werkt het zonder Ollama aan te passen.
rem ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0"
set PORT=8080

set SERVER=
py -3 -c "import http.server" >nul 2>&1 && set SERVER=py -3 -m http.server %PORT%
if "%SERVER%"=="" python -c "import http.server" >nul 2>&1 && set SERVER=python -m http.server %PORT%

if "%SERVER%"=="" (
  echo.
  echo   Geen Python gevonden.
  echo.
  echo   Kies een van deze twee:
  echo     1^) Installeer Python van https://www.python.org/downloads/ en start dit script opnieuw.
  echo     2^) Geef Ollama toestemming voor bestanden vanaf schijf:
  echo            setx OLLAMA_ORIGINS "*"
  echo        sluit Ollama daarna volledig af via het systeemvak en start het opnieuw.
  echo.
  pause
  exit /b 1
)

echo.
echo   Server draait straks op http://localhost:%PORT%/
echo   Laat het servervenster openstaan zolang je de test gebruikt.
echo.

start "Lokaal model lab - server (dit venster openlaten)" cmd /k %SERVER%
timeout /t 2 /nobreak >nul
start "" "http://localhost:%PORT%/index.html"

echo   Klaar. Het hoofdmenu opent in je browser.
timeout /t 3 /nobreak >nul
endlocal
