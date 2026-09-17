"""
dev/main.py — punto de entrada único del proyecto
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pygame
from pipeline.orchestrator import Orchestrator, StageStatus
from pipeline.stages import build_pipeline

WIDTH, HEIGHT = 720, 420
BG, FG, MUTED = (18, 18, 22), (230, 230, 230), (140, 140, 150)
OK, FAIL, RUNNING, BAR_BG = (110, 200, 110), (210, 90, 90), (90, 160, 220), (40, 40, 48)

STATUS_COLOR = {
    None: MUTED,
    StageStatus.RUNNING: RUNNING,
    StageStatus.DONE: OK,
    StageStatus.FAILED: FAIL,
    StageStatus.SKIPPED: MUTED,
}


class StageView:
    def __init__(self, name):
        self.name, self.status, self.percent = name, None, 0.0
        self.message, self.error = "", None


def main():
    pygame.init()
    pygame.display.set_caption("RtG-AI // Pipeline")
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    clock = pygame.time.Clock()
    font = pygame.font.SysFont("consolas", 16)
    font_small = pygame.font.SysFont("consolas", 13)

    stages = build_pipeline()
    views = {s.name: StageView(s.name) for s in stages}
    order = [s.name for s in stages]

    orchestrator = Orchestrator(stages)
    started, quitting = False, False

    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                if orchestrator.is_running():
                    orchestrator.request_stop()
                    quitting = True
                else:
                    pygame.quit(); sys.exit()
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE and not started:
                    orchestrator.start()
                    started = True
                elif event.key == pygame.K_ESCAPE:
                    if orchestrator.is_running():
                        orchestrator.request_stop()
                        quitting = True
                    else:
                        pygame.quit(); sys.exit()

        for ev in orchestrator.poll_events():
            view = views.setdefault(ev.stage_name, StageView(ev.stage_name))
            if ev.stage_name not in order:
                order.append(ev.stage_name)
            view.status, view.percent, view.message, view.error = (
                ev.status, ev.percent, ev.message, ev.error
            )
            if ev.status == StageStatus.FAILED and ev.error:
                print(f"[{ev.stage_name}] ERROR:\n{ev.error}")  # traceback completo en consola

        if quitting and not orchestrator.is_running():
            pygame.quit(); sys.exit()

        screen.fill(BG)
        title = "RtG-AI Pipeline" if started else "RtG-AI Pipeline — ESPACIO para iniciar, ESC para salir"
        screen.blit(font.render(title, True, FG), (20, 16))

        y = 60
        for name in order:
            v = views[name]
            color = STATUS_COLOR.get(v.status, MUTED)
            screen.blit(font.render(name, True, FG), (20, y))

            bx, by, bw, bh = 220, y + 2, 380, 16
            pygame.draw.rect(screen, BAR_BG, (bx, by, bw, bh))
            pygame.draw.rect(screen, color, (bx, by, int(bw * (v.percent / 100)), bh))
            screen.blit(font_small.render(v.status.name if v.status else "pendiente", True, color), (bx + bw + 10, y))

            msg = v.error if v.error else v.message
            if msg:
                first_line = msg.splitlines()[0][:90]
                screen.blit(font_small.render(first_line, True, FAIL if v.error else MUTED), (20, y + 22))
            y += 60

        if quitting:
            screen.blit(font_small.render("Deteniendo... esperando cierre limpio", True, MUTED), (20, HEIGHT - 30))

        pygame.display.flip()
        clock.tick(30)


if __name__ == "__main__":
    main()