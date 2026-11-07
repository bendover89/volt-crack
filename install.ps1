# =============================================================================
#  VOLT CRACKED INSTALLER  (v1.0.23 - NoAuth build)
#  Installs the patched Volt UI from the included files.
#  No key required. No login required. No server needed.
#  Run as Administrator (hosts-file write requires elevation).
# =============================================================================

$ErrorActionPreference = 'Stop'
Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host "        VOLT CRACKED INSTALLER" -ForegroundColor Cyan
Write-Host "        v1.0.23 - NoAuth Build" -ForegroundColor Cyan
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host ""

$source = $PSScriptRoot
if (-not $source) { $source = Split-Path $MyInvocation.MyCommand.Path }
$voltDir = "$env:LOCALAPPDATA\Volt"

# ---- 0. kill running instances ----
Write-Host "  [0/5] Closing running instances..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.Name -match 'tauri-app|volt' } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# ---- 1. copy files ----
Write-Host "  [1/5] Copying files..." -ForegroundColor Yellow

if (-not (Test-Path $voltDir)) {
    New-Item -ItemType Directory -Force -Path $voltDir | Out-Null
}

Copy-Item "$source\Volt\tauri-app.exe" "$voltDir\tauri-app.exe" -Force
Write-Host "    tauri-app.exe (NoAuth build)" -ForegroundColor Green

New-Item -ItemType Directory -Force -Path "$voltDir\cache\volt" | Out-Null
Copy-Item "$source\Volt\cache\volt\dll.dll"      "$voltDir\cache\volt\dll.dll"      -Force -ErrorAction SilentlyContinue
Copy-Item "$source\Volt\cache\volt\emulator.dll" "$voltDir\cache\volt\emulator.dll" -Force -ErrorAction SilentlyContinue
Copy-Item "$source\Volt\cache\volt\bin.bin"      "$voltDir\cache\volt\bin.bin"      -Force -ErrorAction SilentlyContinue
Write-Host "    executor + emulator + payload modules" -ForegroundColor Green

if (Test-Path "$source\Volt\lsp") {
    New-Item -ItemType Directory -Force -Path "$voltDir\lsp" | Out-Null
    Copy-Item "$source\Volt\lsp\*" "$voltDir\lsp\" -Recurse -Force
    Write-Host "    Luau LSP" -ForegroundColor Green
}

foreach ($d in @('scripts', 'autoexec', 'themes', 'workspace', 'terminal-logs')) {
    if (Test-Path "$source\Volt\$d") {
        New-Item -ItemType Directory -Force -Path "$voltDir\$d" | Out-Null
        Copy-Item "$source\Volt\$d\*" "$voltDir\$d\" -Recurse -Force -ErrorAction SilentlyContinue
    } else {
        New-Item -ItemType Directory -Force -Path "$voltDir\$d" | Out-Null
    }
}
Write-Host "    Scripts + autoexec + workspace" -ForegroundColor Green

if (Test-Path "$source\Volt\uninstall.exe") {
    Copy-Item "$source\Volt\uninstall.exe" "$voltDir\uninstall.exe" -Force
}

# ---- 2. registry ----
Write-Host "  [2/5] Registry..." -ForegroundColor Yellow
if (-not (Test-Path 'HKCU:\Software\Volt')) { New-Item -Path 'HKCU:\Software\Volt' -Force | Out-Null }
Set-ItemProperty -Path 'HKCU:\Software\Volt' -Name '(Default)' -Value $voltDir
Set-ItemProperty -Path 'HKCU:\Software\Volt' -Name 'Installer Language' -Value '1033'
Write-Host "    HKCU\Software\Volt -> $voltDir" -ForegroundColor Green

# ---- 3. hosts entries (block autoupdater) ----
Write-Host "  [3/5] Blocking autoupdater..." -ForegroundColor Yellow
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$content = Get-Content $hostsPath -Raw -ErrorAction SilentlyContinue
if ($content -notmatch 'api\.voltbz') {
    try {
        Add-Content $hostsPath "`n127.0.0.1 api.voltbz.net" -ErrorAction Stop
        Add-Content $hostsPath "127.0.0.1 api.voltbz.org" -ErrorAction Stop
        Write-Host "    api.voltbz.net -> 127.0.0.1 (updates blocked)" -ForegroundColor Green
    } catch {
        Write-Host "    WARNING: could not write hosts (run as Administrator!)" -ForegroundColor Red
        Write-Host "    The autoupdater is still active - Volt may overwrite the patch." -ForegroundColor Red
    }
} else {
    Write-Host "    already blocked" -ForegroundColor Yellow
}

# ---- 4. shortcuts ----
Write-Host "  [4/5] Shortcuts..." -ForegroundColor Yellow
$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$sc = $shell.CreateShortcut("$desktop\Volt.lnk")
$sc.TargetPath = "$voltDir\tauri-app.exe"
$sc.WorkingDirectory = $voltDir
$sc.Description = "Volt Executor (NoAuth)"
$sc.Save()

$startMenu = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
$sc2 = $shell.CreateShortcut("$startMenu\Volt.lnk")
$sc2.TargetPath = "$voltDir\tauri-app.exe"
$sc2.WorkingDirectory = $voltDir
$sc2.Save()
Write-Host "    Desktop + Start Menu shortcuts" -ForegroundColor Green

# ---- 5. done ----
Write-Host "  [5/5] Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host "     INSTALLATION COMPLETE" -ForegroundColor Green
Write-Host "     No login required" -ForegroundColor Green
Write-Host "     No key required" -ForegroundColor Green
Write-Host "     No license check" -ForegroundColor Green
Write-Host "     Autoupdater disabled" -ForegroundColor Green
Write-Host "  ==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Launch Volt from the Desktop or Start Menu." -ForegroundColor White
Write-Host ""

$launch = Read-Host "Launch Volt now? (Y/n)"
if ($launch -ne 'n') {
    Start-Process "$voltDir\tauri-app.exe" -WorkingDirectory $voltDir
    Write-Host "  Volt launched." -ForegroundColor Green
}
