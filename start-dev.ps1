#!/usr/bin/env pwsh
# Starts the whole CodeTrace dev stack: Postgres+Redis (docker), backend, worker, frontend.
$root = $PSScriptRoot

Write-Host "Starting Postgres + Redis..."
docker compose -f "$root\infra\docker-compose.dev.yml" up -d

Write-Host "Waiting for Postgres + Redis to be healthy..."
$deadline = (Get-Date).AddSeconds(60)
while ($true) {
    $status = docker compose -f "$root\infra\docker-compose.dev.yml" ps --format json | ConvertFrom-Json
    $unhealthy = $status | Where-Object { $_.Health -and $_.Health -ne "healthy" }
    if (-not $unhealthy) { break }
    if ((Get-Date) -gt $deadline) {
        Write-Host "Timed out waiting for containers to become healthy." -ForegroundColor Yellow
        break
    }
    Start-Sleep -Seconds 2
}

Write-Host "Starting backend, worker, frontend in separate windows..."

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; npm run worker:pr-review"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\worker'; .\.venv\Scripts\python.exe -m src.main"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"

Write-Host "All services launching. Backend: http://localhost:3000  Frontend: http://localhost:5173"
