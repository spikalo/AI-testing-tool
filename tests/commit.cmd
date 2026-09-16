@echo off
rem Committen met een bericht uit een bestand, omdat de aanroep hier via PowerShell
rem loopt en die aanhalingstekens en regeleindes anders zelf afvangt.
rem   tests\commit.cmd <berichtbestand-in-tests>
cd /d "%~dp0.."
git commit -F "tests\%~1"
git log --oneline -3
git status --short
