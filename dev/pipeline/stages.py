"""
dev/pipeline/stages.py

Implementaciones reales de Stage para el orchestrator.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.orchestrator import Stage
from extractor.extractor import run as run_extractor, TOKENS_PATH
from extractor.keybinds import run as run_keybinds
from dataset.generator import run as run_dataset_generator, TEMPLATES_DIR, LANGUAGES
from dataset.colors import rgb_colors


class ExtractorStage(Stage):
    name = "extractor"

    def required_files(self):
        return [str(TOKENS_PATH)]

    def run(self, context, report, should_stop, ask):
        run_extractor(report=report, should_stop=should_stop, ask=ask)

class KeybindsStage(Stage):
    name = "keybinds"

    def required_files(self):
        return [str(TOKENS_PATH)]

    def run(self, context, report, should_stop, ask):
        run_keybinds(
            report=report,
            should_stop=should_stop,
            ask=ask
        )

class RGBColorsStage(Stage):
    """Valida la paleta RGB como una etapa independiente del pipeline."""
    name = "rgb_colors"

    def run(self, context, report, should_stop, ask):
        palette_items = list(rgb_colors.PALETTE.items())
        total = len(palette_items) or 1

        for index, (key, rgb) in enumerate(palette_items, 1):
            if should_stop():
                return

            if rgb_colors.nearest_color_key(rgb) != key:
                raise ValueError(f"RGB inválido en la paleta: {key} -> {rgb}")

            for language in rgb_colors.NAMES:
                if rgb_colors.nearest_color(rgb, language) is None:
                    raise ValueError(
                        f"Falta traducción de {key!r} para {language!r}"
                    )

            report(
                index / total * 100,
                f"Validando color {key} ({index}/{total})"
            )


class DatasetGeneratorStage(Stage):
    name = "dataset_generator"

    def required_files(self):
        return [str(TEMPLATES_DIR / f"{lang}.json") for lang in LANGUAGES]

    def run(self, context, report, should_stop, ask):
        run_dataset_generator(report=report, should_stop=should_stop, ask=ask)


# Etapas futuras (no implementadas todavía, sin depender de código que aún no existe):
# class TokenizerStage(Stage): ...          # dev/tokens/build_tokenizer.py
# class TrainingStage(Stage): ...           # model/train.py

def build_pipeline():
    """Lista de etapas activas, en orden de ejecución.
    Editar acá al agregar TokenizerStage, TrainingStage."""
    return [
        ExtractorStage(),
        KeybindsStage(),
        RGBColorsStage(),
        DatasetGeneratorStage(),
    ]
