"""
dev/pipeline/stages.py

Implementaciones reales de Stage para el orchestrator. Por ahora solo existe
ExtractorStage, porque es la única etapa con código funcional. Las demás se
agregan cuando dataset/generator.py, el tokenizer y model/train.py existan.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.orchestrator import Stage
from extractor.extractor import run as run_extractor, TOKENS_PATH


class ExtractorStage(Stage):
    name = "extractor"

    def required_files(self):
        return [str(TOKENS_PATH)]

    def run(self, context, report, should_stop):
        run_extractor(report=report, should_stop=should_stop)


# Etapas futuras (no implementadas todavía, sin depender de código que aún no existe):
# class DatasetGeneratorStage(Stage): ...   # dev/dataset/generator.py
# class TokenizerStage(Stage): ...          # dev/tokens/build_tokenizer.py
# class TrainingStage(Stage): ...           # model/train.py
