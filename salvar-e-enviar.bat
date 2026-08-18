@echo off
cd /d "%~dp0"
echo ================================
echo   Salvando e enviando mudancas
echo ================================
git add -A

git diff --cached --quiet
if %errorlevel%==0 (
    echo Nenhuma mudanca para enviar.
    pause
    exit /b
)

set /p msg="Descreva o que voce mudou (Enter para pular): "
if "%msg%"=="" set msg=Atualizacao rapida

git commit -m "%msg%"
git push

echo.
echo Concluido!
pause
