@echo off
set "MERAKI_NODE=C:\Users\jpaiao\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "MERAKI_NPM=%~dp0..\npm-runtime\package\bin\npm-cli.js"

if not exist "%MERAKI_NODE%" (
  echo Node.js do ambiente Codex nao foi encontrado.
  echo Instale o Node.js LTS em https://nodejs.org/ ou reabra o projeto no Codex.
  pause
  exit /b 1
)

cd /d "%~dp0"
echo Iniciando Meraki Precificacao em http://localhost:3000
"%MERAKI_NODE%" "%MERAKI_NPM%" run dev

