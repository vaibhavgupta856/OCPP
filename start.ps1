# Massive Mobility Charging Simulator launcher (PowerShell)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$nodeDir = 'C:\Program Files\nodejs'
if (Test-Path "$nodeDir\node.exe") {
  $env:Path = "$nodeDir;$env:Path"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js not found. Install Node LTS, then re-run.' -ForegroundColor Red
  exit 1
}

if (-not (Test-Path 'node_modules')) {
  Write-Host 'Installing root dependencies...' -ForegroundColor Yellow
  npm install
}
if (-not (Test-Path 'client\node_modules')) {
  Write-Host 'Installing client dependencies...' -ForegroundColor Yellow
  npm install --prefix client
}

Write-Host 'Starting Massive Mobility Charging Simulator...' -ForegroundColor Green
npm run dev
