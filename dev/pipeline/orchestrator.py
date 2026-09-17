"""
dev/pipeline/orchestrator.py

Corre una secuencia de "Stages" (implementadas después en stages.py) en un hilo
aparte, reportando progreso vía una queue.Queue para que cualquier UI (pygame,
consola, etc.) lo consuma sin bloquearse. No conoce nada de pygame ni de la
lógica interna de cada etapa: solo orquesta y reporta.
"""

import threading
import queue
import traceback
from dataclasses import dataclass
from enum import Enum, auto
from pathlib import Path
from typing import Callable, List, Optional


class StageStatus(Enum):
    RUNNING = auto()
    DONE = auto()
    FAILED = auto()
    SKIPPED = auto()


@dataclass
class ProgressEvent:
    stage_name: str
    status: StageStatus
    percent: float = 0.0       # 0-100, opcional si la etapa no sabe medirlo
    message: str = ""
    error: Optional[str] = None


class Stage:
    """Interfaz base que stages.py debe implementar para cada etapa del pipeline."""

    name: str = "unnamed_stage"

    def required_files(self) -> List[str]:
        """Rutas que deben existir antes de correr esta etapa. Vacío = sin requisitos."""
        return []

    def run(self, context: dict, report: Callable[[float, str], None],
            should_stop: Callable[[], bool]) -> None:
        """
        Ejecuta la etapa. Debe llamar report(percent, message) periódicamente,
        y revisar should_stop() en iteraciones largas para cancelarse limpiamente
        (ej. guardar checkpoint antes de salir).
        """
        raise NotImplementedError


class Orchestrator:
    def __init__(self, stages: List[Stage]):
        self.stages = stages
        self.events: "queue.Queue[ProgressEvent]" = queue.Queue()
        self._thread: Optional[threading.Thread] = None
        self._stop_requested = threading.Event()
        self._running = threading.Event()

    def start(self, context: Optional[dict] = None):
        if self._running.is_set():
            return  # ya corriendo, ignorar doble-start
        self._stop_requested.clear()
        self._running.set()
        self._thread = threading.Thread(target=self._run_all, args=(context or {},), daemon=True)
        self._thread.start()

    def request_stop(self):
        """Pide una cancelación limpia; las stages deben chequear should_stop()."""
        self._stop_requested.set()

    def is_running(self) -> bool:
        return self._running.is_set()

    def poll_events(self) -> List[ProgressEvent]:
        """Llamar una vez por frame desde la UI. Devuelve los eventos nuevos."""
        events = []
        while True:
            try:
                events.append(self.events.get_nowait())
            except queue.Empty:
                break
        return events

    def _run_all(self, context: dict):
        for stage in self.stages:
            if self._stop_requested.is_set():
                self.events.put(ProgressEvent(stage.name, StageStatus.SKIPPED, message="Cancelado por el usuario"))
                continue

            missing = [f for f in stage.required_files() if not Path(f).exists()]
            if missing:
                self.events.put(ProgressEvent(
                    stage.name, StageStatus.FAILED,
                    message="Faltan archivos requeridos",
                    error=f"No encontrado: {', '.join(missing)}"
                ))
                break  # no tiene sentido seguir si una etapa base falta

            self.events.put(ProgressEvent(stage.name, StageStatus.RUNNING, message="Iniciando..."))

            def report(percent: float, message: str, _stage=stage):
                self.events.put(ProgressEvent(_stage.name, StageStatus.RUNNING, percent, message))

            try:
                stage.run(context, report, self._stop_requested.is_set)
                self.events.put(ProgressEvent(stage.name, StageStatus.DONE, 100.0, "Completado"))
            except Exception as exc:
                self.events.put(ProgressEvent(
                    stage.name, StageStatus.FAILED,
                    message="Error durante la ejecución",
                    error=f"{exc}\n{traceback.format_exc()}"
                ))
                break  # una etapa fallida detiene el pipeline

        self._running.clear()


if __name__ == "__main__":
    # Prueba manual con stages falsas, sin depender de stages.py todavía.
    import time

    class DummyStage(Stage):
        def __init__(self, name, steps=5, fail=False):
            self.name = name
            self.steps = steps
            self.fail = fail

        def run(self, context, report, should_stop):
            for i in range(self.steps):
                if should_stop():
                    return
                time.sleep(0.3)
                report((i + 1) / self.steps * 100, f"paso {i + 1}/{self.steps}")
            if self.fail:
                raise RuntimeError("fallo simulado")

    orch = Orchestrator([DummyStage("dataset"), DummyStage("tokenizer"), DummyStage("training", fail=True)])
    orch.start()

    while orch.is_running() or not orch.events.empty():
        for ev in orch.poll_events():
            print(f"[{ev.stage_name}] {ev.status.name} {ev.percent:.0f}% - {ev.message} {ev.error or ''}")
        time.sleep(0.1)