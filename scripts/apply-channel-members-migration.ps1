# Apply channel_members migration (class-section private channels)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root 'apps\backend')

Write-Host 'Stopping xhub-api if running (unlocks Prisma engine on Windows)...'
pm2 stop xhub-api 2>$null | Out-Null

Write-Host 'Applying migration...'
npx prisma db execute --file prisma/migrations/20260530_channel_members/migration.sql

Write-Host 'Regenerating Prisma client...'
npx prisma generate

Write-Host 'Done. Restart API: npm run pm2:restart (from repo root)'
