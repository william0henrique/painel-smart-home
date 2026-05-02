@echo off
chcp 65001 >nul
title Painel Smart Home

echo.
echo  ╔══════════════════════════════════════╗
echo  ║       🏠 PAINEL SMART HOME           ║
echo  ╠══════════════════════════════════════╣
echo  ║  Iniciando backend e frontend...     ║
echo  ╚══════════════════════════════════════╝
echo.

:: Verificar se Node.js está instalado
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ ERRO: Node.js não encontrado!
    echo    Baixe em: https://nodejs.org
    pause
    exit /b 1
)

:: Verificar se o .env existe
if not exist "backend\.env" (
    echo ⚠️  Arquivo backend\.env não encontrado!
    echo    Copiando de .env.example...
    copy "backend\.env.example" "backend\.env" >nul
    echo    ✅ Arquivo .env criado. Configure suas credenciais Tuya antes de continuar.
    echo.
    echo    Abra o arquivo: backend\.env
    echo    E preencha: TUYA_CLIENT_ID e TUYA_CLIENT_SECRET
    echo.
    pause
    start notepad "backend\.env"
    echo.
    echo    Após configurar o .env, execute este arquivo novamente.
    pause
    exit /b 0
)

:: Verificar se node_modules existe no backend
if not exist "backend\node_modules" (
    echo 📦 Instalando dependências do backend...
    cd backend
    call npm install
    cd ..
    echo.
)

:: Verificar se node_modules existe no frontend
if not exist "frontend\node_modules" (
    echo 📦 Instalando dependências do frontend...
    cd frontend
    call npm install
    cd ..
    echo.
)

:: Verificar se existe usuário admin
echo 🔍 Verificando usuário admin...
cd backend
node -e "try { const {getDb}=require('./database/init'); const db=getDb(); const u=db.prepare('SELECT COUNT(*) as c FROM users').get(); if(u.c===0){console.log('NO_USERS');}else{console.log('OK');} } catch(e){console.log('OK');}" > temp_check.txt 2>&1
set /p CHECK_RESULT=<temp_check.txt
del temp_check.txt
cd ..

if "%CHECK_RESULT%"=="NO_USERS" (
    echo.
    echo ⚠️  Nenhum usuário encontrado!
    echo    Vamos criar o usuário admin...
    echo.
    cd backend
    call npm run create-admin
    cd ..
    echo.
)

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo  🚀 Iniciando servidores...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo  📡 Backend:  http://localhost:3001
echo  🌐 Frontend: http://localhost:5173
echo.
echo  Pressione Ctrl+C para parar os servidores
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

:: Iniciar backend em nova janela
start "Smart Home - Backend" cmd /k "cd /d %~dp0backend && echo Iniciando Backend... && npm run dev"

:: Aguardar 2 segundos para o backend iniciar
timeout /t 2 /nobreak >nul

:: Iniciar frontend em nova janela
start "Smart Home - Frontend" cmd /k "cd /d %~dp0frontend && echo Iniciando Frontend... && npm run dev"

:: Aguardar 3 segundos e abrir no navegador
timeout /t 3 /nobreak >nul
echo  🌐 Abrindo no navegador...
start http://localhost:5173

echo.
echo  ✅ Servidores iniciados!
echo  📌 Esta janela pode ser fechada com segurança.
echo     Os servidores continuarão nas janelas abertas.
echo.
pause
