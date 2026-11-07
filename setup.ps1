# Volt Cracked - Setup Script
# Run as Administrator

Write-Host "=== Volt Cracked Setup ===" -ForegroundColor Cyan

# 1. Add hosts entries
Write-Host "[1/3] Adding hosts entries..."
$hostsPath = "C:\Windows\System32\drivers\etc\hosts"
$content = Get-Content $hostsPath -Raw -ErrorAction SilentlyContinue
if ($content -notmatch "api\.voltbz") {
    Add-Content $hostsPath "`n127.0.0.1 api.voltbz.net`n127.0.0.1 api.voltbz.org"
    Write-Host "  hosts entries added" -ForegroundColor Green
} else {
    Write-Host "  already present" -ForegroundColor Yellow
}

# 2. Install cracked exe
Write-Host "[2/3] Installing cracked tauri-app.exe..."
$voltDir = "$env:LOCALAPPDATA\Volt"
if (Test-Path $voltDir) {
    Copy-Item "$PSScriptRoot\tauri-app.exe" "$voltDir\tauri-app.exe" -Force
    Write-Host "  deployed to $voltDir" -ForegroundColor Green
} else {
    Write-Host "  Volt not installed - run volt-installer.exe first" -ForegroundColor Red
}

# 3. Copy leaked modules to cache (so Volt finds them)
Write-Host "[3/3] Placing leaked modules..."
$cacheDir = "$env:LOCALAPPDATA\Volt\cache\volt"
if (Test-Path $cacheDir) {
    Copy-Item "$PSScriptRoot\Executor.dll" "$cacheDir\dll.dll" -Force -ErrorAction SilentlyContinue
    Copy-Item "$PSScriptRoot\Emulator.dll" "$cacheDir\emulator.dll" -Force -ErrorAction SilentlyContinue
    Copy-Item "$PSScriptRoot\volt.bin" "$cacheDir\bin.bin" -Force -ErrorAction SilentlyContinue
    Write-Host "  modules placed" -ForegroundColor Green
} else {
    New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
    Copy-Item "$PSScriptRoot\Executor.dll" "$cacheDir\dll.dll" -Force
    Copy-Item "$PSScriptRoot\Emulator.dll" "$cacheDir\emulator.dll" -Force
    Copy-Item "$PSScriptRoot\volt.bin" "$cacheDir\bin.bin" -Force
    Write-Host "  modules placed (fresh install)" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Cyan
Write-Host "Launch Volt from the Start Menu. No login required."
Write-Host "The autoupdater is disabled (api.voltbz.net -> 127.0.0.1)."
