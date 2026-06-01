# Start XHUB backend under PM2 (tunnel: xhub.cpu-crums.com → 127.0.0.1:3001)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host 'Checking Docker infrastructure...'
docker compose ps --format '{{.Names}} {{.Status}}' 2>$null | Select-String 'xhub-postgres|xhub-redis'

if (-not (Test-Path 'apps\backend\dist\main.js')) {
    Write-Host 'Building backend...'
    npm run build:backend
}

Write-Host 'Ensuring database schema (channel_members for class sections)...'
Push-Location apps\backend
try {
    npx prisma db execute --file prisma/migrations/20260530_channel_members/migration.sql 2>$null
    npx prisma generate 2>$null
} finally {
    Pop-Location
}

New-Item -ItemType Directory -Force -Path 'logs' | Out-Null

$existing = pm2 jlist 2>$null | ConvertFrom-Json
$running = $existing | Where-Object { $_.name -eq 'xhub-api' -and $_.pm2_env.status -eq 'online' }
if ($running) {
    Write-Host 'xhub-api already online — restarting to pick up latest build...'
    npm run pm2:restart
} else {
    npm run pm2:start
}

pm2 save
Write-Host ''
Write-Host 'XHUB API: http://127.0.0.1:3001/api/health'
Write-Host 'Logs:     npm run pm2:logs'
Write-Host 'Status:   npm run pm2:status'
Write-Host ''
Write-Host 'Persist across reboot (Windows): pm2 startup'
Write-Host 'Then run the command PM2 prints, and: pm2 save'
