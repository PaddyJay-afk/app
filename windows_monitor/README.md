# Aether Monitor (Windows 11)

A desktop resource monitor built for Windows 11 with a polished dark glass UI, gradient title bar, process telemetry, live charts, and an **End Task** action.

## Features

- Per-process live metrics:
  - Name, PID, full executable path
  - CPU %, RAM (RSS), VMS
  - GPU VRAM (MB), estimated GPU % (NVML)
  - Thread count, handle count, process status, uptime
  - Disk I/O read/write throughput (MB/s)
- Process-tree aggregate summary (parent + direct children)
- Resize-safe desktop UI with automatic chart reflow
- End Task button with confirmation and forced kill fallback
- 4 chart types:
  1. **Line chart** (CPU/RAM/GPU history)
  2. **Area spline chart** (memory pressure)
  3. **Bar chart** (current snapshot comparison)
  4. **Heatmap** (CPU intensity over time)

## Quick start (Windows)

From PowerShell in this folder:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
./install_windows.ps1
```

This will:
1. Create a local virtual environment
2. Install dependencies
3. Generate `run_monitor.bat`
4. Create a desktop shortcut (`Aether Monitor.lnk`)

Then launch from shortcut or run:

```powershell
./run_monitor.bat
```

## Notes

- `pynvml` is optional at runtime. If unavailable or unsupported GPU drivers are present, GPU fields gracefully fall back to `0`.
- Some system processes are protected by Windows and cannot be terminated without elevation.
- For best accuracy in CPU percentages, let the app run for a few seconds so moving averages stabilize.
