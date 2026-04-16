@echo off
echo ================================
echo  ALaunchi - Setup para Windows
echo ================================
echo.

echo [1/3] Borrando node_modules antiguo (puede tardar)...
if exist "node_modules" (
    rmdir /s /q node_modules
    echo      OK - node_modules borrado
) else (
    echo      OK - no habia node_modules
)

echo.
echo [2/3] Instalando dependencias para Windows...
call pnpm install --ignore-scripts
if %errorlevel% neq 0 (
    echo ERROR: fallo pnpm install
    pause
    exit /b 1
)

echo.
echo [3/3] Instalando binarios nativos de Windows...
call pnpm add -w @esbuild/win32-x64 @rollup/rollup-win32-x64-msvc --ignore-scripts
if %errorlevel% neq 0 (
    echo AVISO: no se pudieron instalar algunos binarios opcionales
)

echo.
echo ================================
echo  Listo! Ahora ejecuta:
echo    cd artifacts\alaunchi
echo    pnpm run electron:dev
echo ================================
pause
