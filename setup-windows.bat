@echo off
echo ================================
echo  ALaunchi - Setup para Windows
echo ================================
echo.

echo [1/2] Borrando node_modules antiguo (puede tardar)...
if exist "node_modules" (
    rmdir /s /q node_modules
    echo      OK - node_modules borrado
) else (
    echo      OK - no habia node_modules
)

echo.
echo [2/2] Instalando dependencias para Windows (puede tardar 2-3 min)...
call pnpm install
if %errorlevel% neq 0 (
    echo ERROR: fallo pnpm install
    pause
    exit /b 1
)

echo.
echo ================================
echo  Listo! Ahora ejecuta:
echo    cd artifacts\alaunchi
echo    pnpm run electron:dev
echo ================================
pause
