# Pier Charge Point Lab launcher (PowerShell)

$nodeDir = 'C:\Program Files\nodejs'
if (-not (Test-Path (Join-Path $nodeDir 'npm.cmd'))) {
  Write-Error "Node.js not found in $nodeDir. Install from https://nodejs.org"
  exit 1
}

$env:PATH = "$nodeDir;$env:PATH"
Set-Location $PSScriptRoot

Write-Host "Node $(node -v) / npm $(npm -v)" -ForegroundColor Cyan

if (-not (Test-Path '.\node_modules')) {
  Write-Host 'Installing dependencies...' -ForegroundColor Yellow
  npm run install:all
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host ''
Write-Host 'Starting Pier lab...' -ForegroundColor Green
Write-Host '  UI:  http://localhost:5173'
Write-Host '  API: http://localhost:8787'
Write-Host ''
npm run dev
