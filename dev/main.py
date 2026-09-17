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
BOX_BG, BOX_BORDER = (30, 32, 40), (90, 160, 220)

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


def wrap_text(text, font, max_width):
    """Parte el texto en líneas que no superen max_width píxeles."""
    words = text.split(" ")
    lines, current = [], ""
    for word in words:
        trial = f"{current} {word}".strip()
        if font.size(trial)[0] <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


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
    pending = []  # cola de MessageRequest pendientes de responder

    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                if orchestrator.is_running():
                    orchestrator.request_stop()
                    quitting = True
                else:
                    pygame.quit(); sys.exit()
            elif event.type == pygame.KEYDOWN:
                if pending and pygame.K_1 <= event.key <= pygame.K_9:
                    idx = event.key - pygame.K_1
                    if idx < len(pending[0].options):
                        orchestrator.respond(pending[0].id, pending[0].options[idx])
                        pending.pop(0)
                elif event.key == pygame.K_SPACE and not started:
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

        pending.extend(orchestrator.poll_messages())

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

        if pending:
            msg = pending[0]
            box_x, box_y, box_w = 40, HEIGHT - 200, WIDTH - 80
            lines = wrap_text(msg.text, font_small, box_w - 30)
            option_lines = [f"{i + 1}) {opt}" for i, opt in enumerate(msg.options)]
            box_h = 30 + len(lines) * 20 + len(option_lines) * 20 + 15

            pygame.draw.rect(screen, BOX_BG, (box_x, box_y, box_w, box_h))
            pygame.draw.rect(screen, BOX_BORDER, (box_x, box_y, box_w, box_h), width=2)

            ty = box_y + 12
            for line in lines:
                screen.blit(font_small.render(line, True, FG), (box_x + 15, ty))
                ty += 20
            ty += 8
            for line in option_lines:
                screen.blit(font_small.render(line, True, RUNNING), (box_x + 15, ty))
                ty += 20

        pygame.display.flip()
        clock.tick(30)


if __name__ == "__main__":
    main()