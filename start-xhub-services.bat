@echo off
echo Starting XHUB Services...
echo.

REM Check if PostgreSQL service is running (try both x64-16 and x64-18)
echo Checking PostgreSQL service...
sc query postgresql-x64-18 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set PG_SERVICE=postgresql-x64-18
    echo PostgreSQL service found: postgresql-x64-18
) else (
    sc query postgresql-x64-16 >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        set PG_SERVICE=postgresql-x64-16
        echo PostgreSQL service found: postgresql-x64-16
    ) else (
        echo ERROR: PostgreSQL service not found.
        echo Please ensure PostgreSQL is installed as a Windows service.
        pause
        exit /b 1
    )
)

sc query %PG_SERVICE% | find "RUNNING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo PostgreSQL is already running.
) else (
    echo Starting PostgreSQL service...
    net start %PG_SERVICE%
    if %ERRORLEVEL% EQU 0 (
        echo PostgreSQL started successfully.
    ) else (
        echo ERROR: Failed to start PostgreSQL service.
        pause
        exit /b 1
    )
)

echo.
echo Checking XHUB Backend service...
sc query XHUB-Backend >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    sc query XHUB-Backend | find "RUNNING" >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo XHUB Backend is already running as a Windows service.
    ) else (
        echo Starting XHUB Backend service...
        net start XHUB-Backend
        if %ERRORLEVEL% EQU 0 (
            echo XHUB Backend started successfully.
        ) else (
            echo ERROR: Failed to start XHUB Backend service.
            pause
            exit /b 1
        )
    )
) else (
    echo XHUB Backend Windows service not found.
    echo Starting XHUB Backend manually...
    cd /d "%~dp0"
    start "XHUB Backend" cmd /k "pnpm --filter @xhub/backend dev"
)

echo.
echo XHUB services started successfully!
echo.
echo Services running:
echo - PostgreSQL (Windows Service: %PG_SERVICE%)
echo - XHUB Backend (http://localhost:3001)
echo.
echo Note: Redis, Meilisearch, and MinIO should be running as local services or Docker containers.
echo If they are not running, please start them manually.

timeout /t 3 /nobreak > nul
