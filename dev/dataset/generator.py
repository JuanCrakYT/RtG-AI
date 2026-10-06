"""
dev/dataset/generator.py

Recorre dev/json/*.json, y por cada objeto de cada build real genera
múltiples frases (es/en) describiendo su adición, usando describer.py.
Escribe el dataset como JSONL en dev/dataset/output/.
"""

import sys
import json
import random
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from extractor.extractor import JSON_DIR, load_json, get_top_level_build
from dataset.describer import describe_object

DATASET_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = DATASET_DIR / "templates"
OUTPUT_DIR = DATASET_DIR / "output"

LANGUAGES = ["es", "en"]
VARIATIONS_PER_OBJECT = 20  # tope; si el objeto no da para tantas combinaciones distintas, se corta antes


def load_templates():
    templates = {}
    for lang in LANGUAGES:
        templates[lang] = load_json(TEMPLATES_DIR / f"{lang}.json", None)
        if templates[lang] is None:
            raise FileNotFoundError(f"Falta dev/dataset/templates/{lang}.json")
    return templates


def generate_examples_for_build(build, source_name, templates, rng):
    examples = []
    for i, (obj_type, connections, properties) in enumerate(build):
        context = build[:i]

        parent_index, parent_type = None, None
        if isinstance(connections, list) and connections and isinstance(connections[0], list) and len(connections[0]) == 3:
            parent_index = connections[0][2]
            if isinstance(parent_index, int) and 1 <= parent_index <= len(context):
                parent_type = context[parent_index - 1][0]
            else:
                parent_index = None  # índice inválido, no describimos conexión

        for lang in LANGUAGES:
            seen = set()
            attempts = 0
            while len(seen) < VARIATIONS_PER_OBJECT and attempts < VARIATIONS_PER_OBJECT * 4:
                attempts += 1
                phrase = describe_object(obj_type, connections, properties, parent_index, parent_type, templates[lang], rng)
                if phrase in seen:
                    continue
                seen.add(phrase)
                examples.append({
                    "language": lang,
                    "instruction": phrase,
                    "context_build": context,
                    "target": [[obj_type, connections, properties]],
                    "source_file": source_name,
                    "object_index": i,
                })
    return examples


def run(report=None, should_stop=None, ask=None, seed=42):
    templates = load_templates()
    rng = random.Random(seed)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    writers = {lang: open(OUTPUT_DIR / f"dataset_{lang}.jsonl", "w", encoding="utf-8") for lang in LANGUAGES}

    json_files = list(JSON_DIR.rglob("*.json"))
    total = len(json_files) or 1
    total_examples, skipped_files = 0, 0

    try:
        for i, path in enumerate(json_files):
            if should_stop and should_stop():
                if report:
                    report((i / total) * 100, "Cancelado por el usuario")
                return

            data = load_json(path, None)
            build = get_top_level_build(data) if data is not None else None

            if build is None:
                skipped_files += 1
            else:
                examples = generate_examples_for_build(build, path.name, templates, rng)
                for example in examples:
                    writers[example["language"]].write(json.dumps(example, ensure_ascii=False) + "\n")
                total_examples += len(examples)

            if report:
                report((i + 1) / total * 100, f"Procesado {path.name} ({i + 1}/{total})")
    finally:
        for w in writers.values():
            w.close()

    msg = f"Ejemplos generados: {total_examples} | Archivos omitidos (no son build válido): {skipped_files}"
    print(msg)
    if report:
        report(100, msg)


def main():
    run()


if __name__ == "__main__":
    main()