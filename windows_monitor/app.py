import os
import sys
import time
import math
from collections import deque, defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import psutil
import pyqtgraph as pg
from PySide6.QtCore import QTimer, Qt
from PySide6.QtGui import QAction, QColor, QFont
from PySide6.QtWidgets import (
    QApplication,
    QComboBox,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QTabWidget,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

try:
    import pynvml

    NVML_AVAILABLE = True
except Exception:
    NVML_AVAILABLE = False


MAX_HISTORY = 180
REFRESH_MS = 1000


@dataclass
class ProcessSnapshot:
    pid: int
    name: str
    path: str
    cpu: float
    ram_mb: float
    rss_mb: float
    vms_mb: float
    threads: int
    handles: int
    read_mb_s: float
    write_mb_s: float
    uptime_s: float
    status: str
    parent_pid: Optional[int]
    gpu_vram_mb: float = 0.0
    gpu_percent: float = 0.0


class Collector:
    def __init__(self) -> None:
        self.prev_io: Dict[int, Tuple[float, float, float]] = {}
        self.last_ts = time.time()
        self.nvml_inited = False
        self._maybe_init_nvml()

    def _maybe_init_nvml(self) -> None:
        if not NVML_AVAILABLE:
            return
        try:
            pynvml.nvmlInit()
            self.nvml_inited = True
        except Exception:
            self.nvml_inited = False

    def collect_gpu(self) -> Dict[int, Tuple[float, float]]:
        """Returns pid -> (gpu_vram_mb, gpu_percent_estimate)."""
        per_pid_vram: Dict[int, float] = defaultdict(float)
        per_pid_gpu: Dict[int, float] = defaultdict(float)
        if not self.nvml_inited:
            return {}

        try:
            device_count = pynvml.nvmlDeviceGetCount()
            for i in range(device_count):
                handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                util = float(pynvml.nvmlDeviceGetUtilizationRates(handle).gpu)
                procs = []
                try:
                    procs.extend(pynvml.nvmlDeviceGetComputeRunningProcesses(handle))
                except Exception:
                    pass
                try:
                    procs.extend(pynvml.nvmlDeviceGetGraphicsRunningProcesses(handle))
                except Exception:
                    pass

                total_proc_mem = 0.0
                pid_mem: Dict[int, float] = {}
                for p in procs:
                    used = float(getattr(p, "usedGpuMemory", 0) or 0)
                    mb = used / (1024 * 1024)
                    pid_mem[int(p.pid)] = pid_mem.get(int(p.pid), 0.0) + mb
                    total_proc_mem += mb

                for pid, mb in pid_mem.items():
                    per_pid_vram[pid] += mb
                    if total_proc_mem > 0:
                        per_pid_gpu[pid] += util * (mb / total_proc_mem)
        except Exception:
            return {}

        merged = {}
        for pid in set(list(per_pid_vram.keys()) + list(per_pid_gpu.keys())):
            merged[pid] = (per_pid_vram.get(pid, 0.0), per_pid_gpu.get(pid, 0.0))
        return merged

    def collect(self) -> List[ProcessSnapshot]:
        now = time.time()
        dt = max(now - self.last_ts, 0.001)
        self.last_ts = now
        gpu_map = self.collect_gpu()

        snapshots: List[ProcessSnapshot] = []
        for proc in psutil.process_iter(
            ["pid", "name", "exe", "cpu_percent", "memory_info", "status", "create_time", "ppid", "num_threads"]
        ):
            try:
                info = proc.info
                pid = int(info["pid"])
                name = info.get("name") or "Unknown"
                path = info.get("exe") or ""
                mem = info.get("memory_info")
                rss_mb = float(mem.rss) / (1024 * 1024) if mem else 0.0
                vms_mb = float(mem.vms) / (1024 * 1024) if mem else 0.0
                cpu = float(proc.cpu_percent(interval=None))
                threads = int(info.get("num_threads") or 0)
                status = info.get("status") or "unknown"
                uptime_s = max(0.0, now - float(info.get("create_time") or now))

                io = proc.io_counters() if hasattr(proc, "io_counters") else None
                r_bytes = float(io.read_bytes) if io else 0.0
                w_bytes = float(io.write_bytes) if io else 0.0

                prev = self.prev_io.get(pid)
                if prev:
                    read_mb_s = max(0.0, (r_bytes - prev[1]) / (1024 * 1024) / dt)
                    write_mb_s = max(0.0, (w_bytes - prev[2]) / (1024 * 1024) / dt)
                else:
                    read_mb_s = 0.0
                    write_mb_s = 0.0
                self.prev_io[pid] = (now, r_bytes, w_bytes)

                handles = 0
                try:
                    handles = proc.num_handles() if hasattr(proc, "num_handles") else 0
                except Exception:
                    handles = 0

                gpu_vram_mb, gpu_percent = gpu_map.get(pid, (0.0, 0.0))

                snapshots.append(
                    ProcessSnapshot(
                        pid=pid,
                        name=name,
                        path=path,
                        cpu=cpu,
                        ram_mb=rss_mb,
                        rss_mb=rss_mb,
                        vms_mb=vms_mb,
                        threads=threads,
                        handles=handles,
                        read_mb_s=read_mb_s,
                        write_mb_s=write_mb_s,
                        uptime_s=uptime_s,
                        status=status,
                        parent_pid=int(info.get("ppid")) if info.get("ppid") is not None else None,
                        gpu_vram_mb=gpu_vram_mb,
                        gpu_percent=gpu_percent,
                    )
                )
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue

        snapshots.sort(key=lambda p: (p.cpu + p.ram_mb / 200.0), reverse=True)
        return snapshots


class MonitorWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("Aether Monitor — Windows 11 Resource Monitor")
        self.resize(1520, 920)

        self.collector = Collector()
        self.history: Dict[int, Dict[str, deque]] = {}
        self.current_data: List[ProcessSnapshot] = []
        self.selected_pid: Optional[int] = None

        self._build_ui()
        self._setup_timer()
        self.refresh()

    def _build_ui(self) -> None:
        root = QWidget()
        root_layout = QVBoxLayout(root)
        root_layout.setContentsMargins(10, 10, 10, 10)
        root_layout.setSpacing(10)

        header = QFrame()
        header.setObjectName("header")
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(20, 16, 20, 16)

        title = QLabel("Aether Process Intelligence")
        title.setObjectName("title")
        subtitle = QLabel("Dark glassmorphism · live telemetry · Windows 11 optimized")
        subtitle.setObjectName("subtitle")

        title_wrap = QVBoxLayout()
        title_wrap.addWidget(title)
        title_wrap.addWidget(subtitle)

        self.sort_combo = QComboBox()
        self.sort_combo.addItems(["CPU %", "RAM MB", "GPU %", "GPU VRAM MB", "PID"])
        self.sort_combo.currentTextChanged.connect(self._resort)

        self.kill_btn = QPushButton("End Task")
        self.kill_btn.clicked.connect(self.end_task)

        self.refresh_btn = QPushButton("Refresh Now")
        self.refresh_btn.clicked.connect(self.refresh)

        header_layout.addLayout(title_wrap)
        header_layout.addStretch(1)
        header_layout.addWidget(self.sort_combo)
        header_layout.addWidget(self.refresh_btn)
        header_layout.addWidget(self.kill_btn)

        splitter = QSplitter(Qt.Horizontal)
        splitter.setChildrenCollapsible(False)

        left = QFrame()
        left_layout = QVBoxLayout(left)
        left_layout.setContentsMargins(8, 8, 8, 8)

        self.table = QTableWidget(0, 10)
        self.table.setHorizontalHeaderLabels(
            ["Name", "PID", "CPU %", "RAM MB", "GPU %", "GPU VRAM", "Threads", "Handles", "State", "Path"]
        )
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setSelectionMode(QTableWidget.SingleSelection)
        self.table.itemSelectionChanged.connect(self._on_select_row)
        self.table.setAlternatingRowColors(True)
        self.table.horizontalHeader().setStretchLastSection(True)
        left_layout.addWidget(self.table)

        right = QFrame()
        right_layout = QVBoxLayout(right)
        right_layout.setContentsMargins(8, 8, 8, 8)

        self.meta = QTextEdit()
        self.meta.setReadOnly(True)
        self.meta.setMaximumHeight(170)

        self.tabs = QTabWidget()
        self.tab_overview = self._build_overview_tab()
        self.tab_cpu = self._build_plot_tab("CPU %", (0, 100), metric_key="cpu")
        self.tab_ram = self._build_plot_tab("RAM (MB)", (0, 1000), metric_key="ram_mb")
        self.tab_gpu = self._build_plot_tab("GPU %", (0, 100), metric_key="gpu_percent")

        self.tabs.addTab(self.tab_overview, "Overview")
        self.tabs.addTab(self.tab_cpu, "CPU")
        self.tabs.addTab(self.tab_ram, "Memory")
        self.tabs.addTab(self.tab_gpu, "GPU")

        right_layout.addWidget(self.meta)
        right_layout.addWidget(self.tabs)

        splitter.addWidget(left)
        splitter.addWidget(right)
        splitter.setStretchFactor(0, 5)
        splitter.setStretchFactor(1, 6)

        root_layout.addWidget(header)
        root_layout.addWidget(splitter)

        self.setCentralWidget(root)
        self._apply_styles()

    def _build_overview_tab(self) -> QWidget:
        tab = QWidget()
        layout = QGridLayout(tab)
        layout.setContentsMargins(4, 4, 4, 4)

        self.line_plot = pg.PlotWidget(title="Line Chart — CPU/RAM/GPU")
        self.line_plot.addLegend()
        self.line_plot.showGrid(x=True, y=True, alpha=0.3)
        self.line_cpu = self.line_plot.plot(pen=pg.mkPen("#4FC3F7", width=2), name="CPU %")
        self.line_ram = self.line_plot.plot(pen=pg.mkPen("#9C6BFF", width=2), name="RAM MB")
        self.line_gpu = self.line_plot.plot(pen=pg.mkPen("#72E0A8", width=2), name="GPU %")

        self.area_plot = pg.PlotWidget(title="Area Spline — Memory Pressure")
        self.area_plot.showGrid(x=True, y=True, alpha=0.2)
        self.area_curve = self.area_plot.plot(pen=pg.mkPen("#BEA4FF", width=2))
        self.area_fill = pg.FillBetweenItem(self.area_curve, pg.PlotDataItem([0], [0]), brush=pg.mkBrush(158, 111, 255, 80))
        self.area_plot.addItem(self.area_fill)

        self.bar_plot = pg.PlotWidget(title="Bar Chart — Current Snapshot")
        self.bar_plot.setYRange(0, 100)

        self.heatmap_plot = pg.PlotWidget(title="Heatmap — CPU Intensity")
        self.heatmap_img = pg.ImageItem()
        self.heatmap_plot.addItem(self.heatmap_img)

        layout.addWidget(self.line_plot, 0, 0)
        layout.addWidget(self.area_plot, 0, 1)
        layout.addWidget(self.bar_plot, 1, 0)
        layout.addWidget(self.heatmap_plot, 1, 1)

        return tab

    def _build_plot_tab(self, title: str, y_range: Tuple[float, float], metric_key: str) -> QWidget:
        tab = QWidget()
        layout = QVBoxLayout(tab)
        plot = pg.PlotWidget(title=title)
        plot.showGrid(x=True, y=True, alpha=0.3)
        plot.setYRange(y_range[0], y_range[1])
        curve = plot.plot(pen=pg.mkPen("#65A7FF", width=2))
        setattr(self, f"{metric_key}_plot", plot)
        setattr(self, f"{metric_key}_curve", curve)
        layout.addWidget(plot)
        return tab

    def _apply_styles(self) -> None:
        self.setStyleSheet(
            """
            QMainWindow {
                background: #0A0E1A;
                color: #E8EDFF;
            }
            QFrame#header {
                border-radius: 16px;
                border: 1px solid rgba(255,255,255,0.12);
                background: qlineargradient(x1:0,y1:0,x2:1,y2:1,
                    stop:0 rgba(32,54,122,220),
                    stop:1 rgba(103,57,183,220));
            }
            QLabel#title {
                font-size: 22px;
                font-weight: 700;
                color: #FFFFFF;
            }
            QLabel#subtitle {
                color: #D8DDF5;
                font-size: 12px;
            }
            QTableWidget, QTextEdit, QTabWidget::pane, QComboBox {
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.10);
                border-radius: 12px;
                color: #E8EDFF;
                selection-background-color: rgba(79,195,247,0.35);
            }
            QHeaderView::section {
                background: rgba(255,255,255,0.08);
                border: none;
                color: #C6D2FF;
                padding: 6px;
            }
            QPushButton {
                border-radius: 10px;
                padding: 8px 14px;
                background: rgba(255,255,255,0.12);
                border: 1px solid rgba(255,255,255,0.20);
                color: white;
                font-weight: 600;
            }
            QPushButton:hover { background: rgba(255,255,255,0.18); }
            QPushButton:pressed { background: rgba(255,255,255,0.24); }
            QTabBar::tab {
                background: rgba(255,255,255,0.08);
                color: #D7DEFF;
                padding: 8px 12px;
                margin-right: 4px;
                border-top-left-radius: 8px;
                border-top-right-radius: 8px;
            }
            QTabBar::tab:selected {
                background: rgba(110,145,255,0.35);
                color: white;
            }
            """
        )

        pg.setConfigOption("background", (0, 0, 0, 0))
        pg.setConfigOption("foreground", "#DDE6FF")

    def _setup_timer(self) -> None:
        self.timer = QTimer(self)
        self.timer.setInterval(REFRESH_MS)
        self.timer.timeout.connect(self.refresh)
        self.timer.start()

    def _resort(self) -> None:
        key = self.sort_combo.currentText()
        if key == "CPU %":
            self.current_data.sort(key=lambda p: p.cpu, reverse=True)
        elif key == "RAM MB":
            self.current_data.sort(key=lambda p: p.ram_mb, reverse=True)
        elif key == "GPU %":
            self.current_data.sort(key=lambda p: p.gpu_percent, reverse=True)
        elif key == "GPU VRAM MB":
            self.current_data.sort(key=lambda p: p.gpu_vram_mb, reverse=True)
        else:
            self.current_data.sort(key=lambda p: p.pid)
        self._render_table()

    def refresh(self) -> None:
        self.current_data = self.collector.collect()

        active_pids = {p.pid for p in self.current_data}
        for pid in list(self.history.keys()):
            if pid not in active_pids:
                del self.history[pid]

        for p in self.current_data:
            if p.pid not in self.history:
                self.history[p.pid] = {
                    "cpu": deque(maxlen=MAX_HISTORY),
                    "ram_mb": deque(maxlen=MAX_HISTORY),
                    "gpu_percent": deque(maxlen=MAX_HISTORY),
                    "gpu_vram_mb": deque(maxlen=MAX_HISTORY),
                    "read_mb_s": deque(maxlen=MAX_HISTORY),
                    "write_mb_s": deque(maxlen=MAX_HISTORY),
                }
            h = self.history[p.pid]
            h["cpu"].append(p.cpu)
            h["ram_mb"].append(p.ram_mb)
            h["gpu_percent"].append(p.gpu_percent)
            h["gpu_vram_mb"].append(p.gpu_vram_mb)
            h["read_mb_s"].append(p.read_mb_s)
            h["write_mb_s"].append(p.write_mb_s)

        self._resort()
        self._sync_selection()
        self._update_detail()

    def _render_table(self) -> None:
        self.table.setRowCount(len(self.current_data))
        for row, p in enumerate(self.current_data):
            cols = [
                p.name,
                str(p.pid),
                f"{p.cpu:.1f}",
                f"{p.ram_mb:.1f}",
                f"{p.gpu_percent:.1f}",
                f"{p.gpu_vram_mb:.1f}",
                str(p.threads),
                str(p.handles),
                p.status,
                p.path,
            ]
            for col, value in enumerate(cols):
                item = QTableWidgetItem(value)
                if col in (2, 3, 4, 5, 6, 7):
                    item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
                self.table.setItem(row, col, item)
        self.table.resizeColumnsToContents()

    def _sync_selection(self) -> None:
        if self.selected_pid is None and self.current_data:
            self.selected_pid = self.current_data[0].pid

        if self.selected_pid is None:
            return

        for row, p in enumerate(self.current_data):
            if p.pid == self.selected_pid:
                self.table.selectRow(row)
                return

        if self.current_data:
            self.selected_pid = self.current_data[0].pid
            self.table.selectRow(0)

    def _on_select_row(self) -> None:
        items = self.table.selectedItems()
        if not items:
            return
        row = items[0].row()
        if 0 <= row < len(self.current_data):
            self.selected_pid = self.current_data[row].pid
            self._update_detail()

    def _selected_process(self) -> Optional[ProcessSnapshot]:
        if self.selected_pid is None:
            return None
        for p in self.current_data:
            if p.pid == self.selected_pid:
                return p
        return None

    def _update_detail(self) -> None:
        p = self._selected_process()
        if p is None:
            self.meta.setText("No process selected")
            return

        tree_cpu = p.cpu
        tree_ram = p.ram_mb
        for c in self.current_data:
            if c.parent_pid == p.pid:
                tree_cpu += c.cpu
                tree_ram += c.ram_mb

        self.meta.setText(
            f"Name: {p.name}\n"
            f"PID: {p.pid} | Parent PID: {p.parent_pid}\n"
            f"Path: {p.path or 'N/A'}\n"
            f"Status: {p.status} | Uptime: {p.uptime_s/60:.1f} minutes\n"
            f"CPU: {p.cpu:.2f}% | RAM: {p.ram_mb:.2f} MB | VMS: {p.vms_mb:.2f} MB\n"
            f"GPU: {p.gpu_percent:.2f}% | GPU VRAM: {p.gpu_vram_mb:.2f} MB\n"
            f"I/O Read: {p.read_mb_s:.3f} MB/s | I/O Write: {p.write_mb_s:.3f} MB/s\n"
            f"Threads: {p.threads} | Handles: {p.handles}\n"
            f"Process Tree Aggregate -> CPU: {tree_cpu:.2f}% | RAM: {tree_ram:.2f} MB"
        )

        h = self.history.get(p.pid)
        if not h:
            return
        x = list(range(len(h["cpu"])))

        cpu_vals = list(h["cpu"])
        ram_vals = list(h["ram_mb"])
        gpu_vals = list(h["gpu_percent"])

        self.line_cpu.setData(x, cpu_vals)
        self.line_ram.setData(x, ram_vals)
        self.line_gpu.setData(x, gpu_vals)

        self.area_curve.setData(x, ram_vals)
        baseline = pg.PlotDataItem(x, [0] * len(x))
        self.area_fill.setCurves(self.area_curve, baseline)

        self.bar_plot.clear()
        bar_x = [0, 1, 2, 3]
        bar_h = [p.cpu, min(100.0, p.ram_mb / max(1.0, ram_vals[-1] if ram_vals else 100.0) * 100.0), p.gpu_percent, min(100.0, p.gpu_vram_mb)]
        colors = ["#58C4FF", "#9F7BFF", "#6EE7B7", "#F59E0B"]
        bg = pg.BarGraphItem(x=bar_x, height=bar_h, width=0.6, brushes=[pg.mkBrush(c) for c in colors])
        self.bar_plot.addItem(bg)
        ax = self.bar_plot.getAxis("bottom")
        ax.setTicks([[(0, "CPU"), (1, "RAM idx"), (2, "GPU"), (3, "VRAM")]])

        heat_source = list(h["cpu"])
        if heat_source:
            rows = 12
            matrix = []
            for _ in range(rows):
                matrix.append(heat_source[-MAX_HISTORY:])
            self.heatmap_img.setImage(matrix, autoLevels=True)

        self.cpu_curve.setData(x, cpu_vals)
        self.ram_mb_curve.setData(x, ram_vals)
        self.gpu_percent_curve.setData(x, gpu_vals)

    def end_task(self) -> None:
        p = self._selected_process()
        if p is None:
            return

        ans = QMessageBox.question(
            self,
            "Confirm End Task",
            f"End task for {p.name} (PID {p.pid})?\n\nPath: {p.path or 'N/A'}",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if ans != QMessageBox.Yes:
            return

        try:
            proc = psutil.Process(p.pid)
            proc.terminate()
            try:
                proc.wait(2)
            except psutil.TimeoutExpired:
                proc.kill()
            QMessageBox.information(self, "Task Ended", f"Terminated {p.name} (PID {p.pid}).")
        except Exception as ex:
            QMessageBox.critical(self, "Unable to End Task", str(ex))


def main() -> None:
    app = QApplication(sys.argv)
    app.setApplicationName("Aether Monitor")
    win = MonitorWindow()
    win.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
