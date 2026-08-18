@echo off
cd /d "%~dp0"
echo ================================
echo   Baixando atualizacoes do GitHub
echo ================================
git pull
echo.
echo Concluido!
pause
