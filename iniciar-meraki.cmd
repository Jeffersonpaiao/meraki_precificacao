@echo off
where npm >nul 2>&1
if errorlevel 1 (
  echo O npm nao foi encontrado no PATH.
  echo Instale o Node.js LTS em https://nodejs.org/ e tente novamente.
  pause
  exit /b 1
)

cd /d "%~dp0"
echo Iniciando Meraki Precificacao em http://localhost:3000
call npm run dev

