# =============================================================================
#  VibeCoded Volt - auto updater
#  Pulls the latest build from this repo's GitHub Releases and installs it.
#
#  Usage:
#    .\update.ps1            # update host + engine modules
#    .\update.ps1 -Check     # only report what would change
# =============================================================================

param([switch]$Check)

$ErrorActionPreference = 'Stop'
$repo = 'bendover89/volt-crack'
$base = "https://github.com/$repo/releases/latest/download"
$voltDir = "$env:LOCALAPPDATA\Volt"
$cacheDir = "$voltDir\cache\volt"

Write-Host ""
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host "        VibeCoded Volt - updater" -ForegroundColor Cyan
Write-Host "  ==========================================" -ForegroundColor Cyan
Write-Host ""

$assets = @(
    @{ Name = 'tauri-app.exe';  Dest = "$voltDir\tauri-app.exe" },
    @{ Name = 'Executor.dll';   Dest = "$cacheDir\dll.dll" },
    @{ Name = 'Emulator.dll';   Dest = "$cacheDir\emulator.dll" },
    @{ Name = 'volt.bin';       Dest = "$cacheDir\bin.bin" }
)

# make sure dirs exist
foreach ($d in @($voltDir, $cacheDir)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
}

$changed = 0
foreach ($a in $assets) {
    $url = "$base/$($a.Name)"
    $tmp = Join-Path $env:TEMP $a.Name
    try {
        Write-Host "  [..] checking $($a.Name)" -ForegroundColor Yellow
        Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing -ErrorAction Stop
    } catch {
        Write-Host "  [!] download failed for $($a.Name): $($_.Exception.Message)" -ForegroundColor Red
        continue
    }

    $newHash = (Get-FileHash $tmp -Algorithm SHA256).Hash
    $oldHash = if (Test-Path $a.Dest) { (Get-FileHash $a.Dest -Algorithm SHA256).Hash } else { '' }

    if ($newHash -eq $oldHash) {
        Write-Host "  [=] $($a.Name) already up to date" -ForegroundColor DarkGray
        Remove-Item $tmp -Force
        continue
    }

    if ($Check) {
        Write-Host "  [~] $($a.Name) has an update" -ForegroundColor Yellow
        Remove-Item $tmp -Force
        $changed++
        continue
    }

    # close running Volt before swapping the exe
    if ($a.Name -eq 'tauri-app.exe') {
        Get-Process | Where-Object { $_.Name -match 'tauri-app' } | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }

    Copy-Item $tmp $a.Dest -Force
    Remove-Item $tmp -Force
    Write-Host "  [+] $($a.Name) updated" -ForegroundColor Green
    $changed++
}

Write-Host ""
if ($Check) {
    if ($changed -gt 0) {
        Write-Host "  $changed file(s) have updates. Run .\update.ps1 to apply." -ForegroundColor Yellow
    } else {
        Write-Host "  Everything up to date." -ForegroundColor Green
    }
} else {
    if ($changed -gt 0) {
        Write-Host "  Updated $changed file(s). Launch Volt and vibe on." -ForegroundColor Green
    } else {
        Write-Host "  Nothing changed - already on the latest build." -ForegroundColor Green
    }
}
Write-Host ""
