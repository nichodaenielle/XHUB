@echo off
echo Starting XHUB Services...
echo.

REM Check if PostgreSQL service is running
echo Checking PostgreSQL service...
sc query postgresql-x64-16 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo PostgreSQL service found.
    sc query postgresql-x64-16 | find "RUNNING" >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo PostgreSQL is already running.
    ) else (
        echo Starting PostgreSQL service...
        net start postgresql-x64-16
        if %ERRORLEVEL% EQU 0 (
            echo PostgreSQL started successfully.
        ) else (
            echo ERROR: Failed to start PostgreSQL service.
            pause
            exit /b 1
        )
    )
) else (
    echo WARNING: PostgreSQL service not found. Please ensure PostgreSQL is installed and running.
    echo Continuing with Docker services...
)

echo.
echo Checking Docker Desktop...

REM Wait for Docker Desktop to be ready (wait 60 seconds max)
set MAX_WAIT=60
set WAIT_COUNT=0

:wait_for_docker
docker info >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Docker is ready.
    goto start_services
)

set /a WAIT_COUNT+=1
if %WAIT_COUNT% GEQ %MAX_WAIT% (
    echo ERROR: Docker did not start within %MAX_WAIT% seconds.
    echo Please start Docker Desktop manually.
    pause
    exit /b 1
)

echo Waiting for Docker to start... (%WAIT_COUNT%/%MAX_WAIT%)
timeout /t 1 /nobreak > nul
goto wait_for_docker

:start_services
echo.
echo Starting XHUB Docker containers (Redis, Meilisearch, MinIO)...
cd /d "%~dp0"
docker-compose up -d

if %ERRORLEVEL% EQU 0 (
    echo.
    echo XHUB services started successfully!
    echo.
    echo Services running:
    echo - PostgreSQL (Windows Service)
    echo - Redis (Docker)
    echo - Meilisearch (Docker)
    echo - MinIO (Docker)
) else (
    echo.
    echo ERROR: Failed to start XHUB Docker services.
    pause
    exit /b 1
)

timeout /t 3 /nobreak > nul
