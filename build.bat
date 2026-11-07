@echo off
setlocal EnableDelayedExpansion
title Volt Cracked - build

echo ============================================
echo   Volt Cracked - build ^& package
echo ============================================
echo.

set "ROOT=%~dp0"
set "FAIL=0"

REM ── 1. validate the patcher script with node ────────────────────────
where node >nul 2>nul
if errorlevel 1 (
    echo [WARN] node not found - skipping JS syntax check
) else (
    echo [1/4] node --check volt_universal_crack.js ...
    node --check "%ROOT%volt_universal_crack.js"
    if errorlevel 1 (
        echo        FAILED
        set "FAIL=1"
    ) else (
        echo        OK
    )
)

REM ── 2. syntax-check the PowerShell scripts ──────────────────────────
echo [2/4] PowerShell syntax check ...
for %%S in (setup.ps1 install.ps1) do (
    powershell -NoProfile -Command ^
        "$e=$null; $t=[System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw '%ROOT%%%S'), [ref]$e); if($e.Count){ $e | ForEach-Object { Write-Host $_.Message }; exit 1 } else { exit 0 }" >nul 2>nul
    if errorlevel 1 (
        echo        %%S : FAILED
        set "FAIL=1"
    ) else (
        echo        %%S : OK
    )
)

REM ── 3. package a source-only release zip ────────────────────────────
echo [3/4] packaging source release ...
if not exist "%ROOT%dist" mkdir "%ROOT%dist"
powershell -NoProfile -Command ^
    "$r='%ROOT%'; $d=Join-Path $r 'dist\Volt-Cracked-src'; " ^
    "if(Test-Path $d){ Remove-Item $d -Recurse -Force }; " ^
    "New-Item -ItemType Directory -Force -Path $d | Out-Null; " ^
    "foreach($f in @('README.md','LICENSE','setup.ps1','install.ps1','volt_universal_crack.js')){ " ^
    "  if(Test-Path (Join-Path $r $f)){ Copy-Item (Join-Path $r $f) $d } }; " ^
    "Compress-Archive -Path (Join-Path $d '*') -DestinationPath (Join-Path $r 'dist\Volt-Cracked-src.zip') -Force"
if errorlevel 1 (
    echo        FAILED
    set "FAIL=1"
) else (
    echo        dist\Volt-Cracked-src.zip written
)

REM ── 4. sha256 manifest so people can verify what they got ───────────
echo [4/4] writing SHA256 manifest ...
powershell -NoProfile -Command ^
    "$d='%ROOT%dist\Volt-Cracked-src'; " ^
    "$lines = Get-ChildItem $d -File | ForEach-Object { " ^
    "  (Get-FileHash $_.FullName -Algorithm SHA256).Hash + '  ' + $_.Name }; " ^
    "$lines | Set-Content (Join-Path $d 'SHA256SUMS.txt')"
echo        SHA256SUMS.txt written

echo.
if "%FAIL%"=="1" (
    echo ============================================
    echo   BUILD FAILED - fix the errors above
    echo ============================================
    exit /b 1
)
echo ============================================
echo   BUILD OK - see dist\Volt-Cracked-src.zip
echo ============================================
exit /b 0
