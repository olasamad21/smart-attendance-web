<#
  EduVerify demo launcher.

  Starts the Python face/attendance API, the Next.js site and a Cloudflare quick tunnel,
  then prints a public HTTPS link you can open on any phone (camera + GPS work over HTTPS).
  Press Ctrl+C to stop everything.

  Usage (from the project root):
    npm run demo                 # production build + start (fast, what you want for demos)
    npm run demo -- -SkipBuild   # reuse the last build
    npm run demo -- -Dev         # next dev instead (slower first loads, live reload)
    npm run demo -- -Force       # first stop anything left on ports 3000/8000 (e.g. an earlier demo)
#>
param(
  [switch]$Dev,
  [switch]$SkipBuild,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root '.demo'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$python = Join-Path $root 'python-backend\venv\Scripts\python.exe'
$cloudflared = @(
  (Get-Command cloudflared -ErrorAction SilentlyContinue).Source,
  'C:\Program Files (x86)\cloudflared\cloudflared.exe',
  'C:\Program Files\cloudflared\cloudflared.exe'
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if (-not (Test-Path $python)) { throw "Python venv not found at $python" }
if (-not $cloudflared) { throw 'cloudflared not found. Install it with: winget install Cloudflare.cloudflared' }

function Test-PortInUse([int]$port) {
  return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}
foreach ($port in 3000, 8000) {
  if (-not (Test-PortInUse $port)) { continue }
  if (-not $Force) {
    throw "Port $port is already in use (probably an earlier demo or dev server). Run 'npm run demo -- -Force' to stop it and start fresh."
  }
  $owners = (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique
  foreach ($id in $owners) {
    Write-Host "Stopping process $id on port $port ..." -ForegroundColor Yellow
    & taskkill.exe /PID $id /T /F 2>$null | Out-Null
  }
}
if ($Force) { Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force }
Start-Sleep -Seconds 1
foreach ($port in 3000, 8000) {
  if (Test-PortInUse $port) { throw "Port $port is still in use. Close the program using it and try again." }
}

function Wait-ForUrl([string]$url, [int]$timeoutSec, [string]$name) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 | Out-Null
      return
    } catch { Start-Sleep -Seconds 2 }
  }
  throw "$name did not start within $timeoutSec seconds. See logs in $logDir"
}

$procs = @()
try {
  # 1. Python API
  Write-Host '[1/3] Starting face/attendance API on :8000 ...' -ForegroundColor Cyan
  $procs += Start-Process -FilePath $python `
    -ArgumentList '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000' `
    -WorkingDirectory (Join-Path $root 'python-backend') -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $logDir 'api.log') -RedirectStandardError (Join-Path $logDir 'api.err.log')
  Wait-ForUrl 'http://127.0.0.1:8000/api/health' 180 'API'

  # 2. Next.js site
  if ($Dev) {
    Write-Host '[2/3] Starting Next.js (dev) on :3000 ...' -ForegroundColor Cyan
    $nextArgs = 'run dev'
  } else {
    if (-not $SkipBuild) {
      Write-Host '[2/3] Building Next.js (about a minute) ...' -ForegroundColor Cyan
      Push-Location $root
      try { npm run build | Out-File (Join-Path $logDir 'build.log') } finally { Pop-Location }
      if ($LASTEXITCODE -ne 0) { throw "next build failed. See $logDir\build.log" }
    }
    Write-Host '[2/3] Starting Next.js on :3000 ...' -ForegroundColor Cyan
    $nextArgs = 'run start'
  }
  $procs += Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "npm $nextArgs" `
    -WorkingDirectory $root -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $logDir 'web.log') -RedirectStandardError (Join-Path $logDir 'web.err.log')
  Wait-ForUrl 'http://localhost:3000/login' 180 'Website'

  # 3. Public HTTPS tunnel
  Write-Host '[3/3] Opening Cloudflare tunnel ...' -ForegroundColor Cyan
  $tunnelLog = Join-Path $logDir 'tunnel.log'
  if (Test-Path $tunnelLog) { Remove-Item $tunnelLog }
  $procs += Start-Process -FilePath $cloudflared `
    -ArgumentList 'tunnel', '--no-autoupdate', '--url', 'http://localhost:3000' `
    -WindowStyle Hidden -PassThru -RedirectStandardError $tunnelLog -RedirectStandardOutput (Join-Path $logDir 'tunnel.out.log')

  $publicUrl = $null
  $deadline = (Get-Date).AddSeconds(60)
  while (-not $publicUrl -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 1
    if (Test-Path $tunnelLog) {
      $m = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
      if ($m) { $publicUrl = $m.Matches[0].Value }
    }
  }
  if (-not $publicUrl) { throw "Tunnel did not report a URL. See $tunnelLog" }

  Write-Host ''
  Write-Host '  EduVerify demo is live' -ForegroundColor Green
  Write-Host "  Phone / anyone:  $publicUrl" -ForegroundColor Green
  Write-Host '  This laptop:     http://localhost:3000'
  Write-Host "  Logs:            $logDir"
  Write-Host ''
  Write-Host '  Press Ctrl+C to stop everything.' -ForegroundColor Yellow

  while ($true) {
    foreach ($p in $procs) {
      if ($p.HasExited) { throw "A demo process exited unexpectedly. See logs in $logDir" }
    }
    Start-Sleep -Seconds 3
  }
}
finally {
  Write-Host 'Stopping demo ...' -ForegroundColor Yellow
  foreach ($p in $procs) {
    if ($p -and -not $p.HasExited) {
      # /T kills the whole tree (npm -> node, etc.)
      & taskkill.exe /PID $p.Id /T /F 2>$null | Out-Null
    }
  }
}
