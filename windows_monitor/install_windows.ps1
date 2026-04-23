param(
  [string]$PythonExe = "python",
  [switch]$NoShortcut
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$venv = Join-Path $root ".venv"
$req = Join-Path $root "requirements.txt"
$app = Join-Path $root "app.py"

Write-Host "[1/4] Creating virtual environment..."
& $PythonExe -m venv $venv

$venvPython = Join-Path $venv "Scripts\python.exe"
$venvPip = Join-Path $venv "Scripts\pip.exe"

Write-Host "[2/4] Installing dependencies..."
& $venvPip install --upgrade pip
& $venvPip install -r $req

$launcher = Join-Path $root "run_monitor.bat"
@"
@echo off
""%~dp0.venv\Scripts\python.exe"" ""%~dp0app.py""
"@ | Set-Content -Path $launcher -Encoding ASCII

Write-Host "[3/4] Created launcher: $launcher"

if (-not $NoShortcut) {
  Write-Host "[4/4] Creating desktop shortcut..."
  $desktop = [Environment]::GetFolderPath("Desktop")
  $shortcutPath = Join-Path $desktop "Aether Monitor.lnk"
  $wsh = New-Object -ComObject WScript.Shell
  $shortcut = $wsh.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $launcher
  $shortcut.WorkingDirectory = $root
  $shortcut.Description = "Aether Monitor - Windows 11 resource monitor"
  $shortcut.Save()
  Write-Host "Shortcut created: $shortcutPath"
}

Write-Host "Done. Launch with run_monitor.bat or desktop shortcut."
