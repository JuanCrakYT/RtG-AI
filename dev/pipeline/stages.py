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
        DatasetGeneratorStage(),
    ]
