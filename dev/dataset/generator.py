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
import os
from concurrent.futures import ProcessPoolExecutor, as_completed


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
                parent_index = None

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


def _process_one_file(path_str, templates, seed):
    """Función de worker: corre en un proceso aparte. Debe recibir todo lo
    que necesita como argumento (templates, seed) porque los procesos no
    comparten memoria entre sí."""
    path = Path(path_str)
    data = load_json(path, None)
    build = get_top_level_build(data) if data is not None else None

    if build is None:
        return path.name, None

    # Semilla propia por archivo, independiente del orden de ejecución o
    # finalización: así el resultado es reproducible aunque los procesos
    # terminen en un orden distinto cada vez.
    local_rng = random.Random(f"{seed}:{path.name}")
    examples = generate_examples_for_build(build, path.name, templates, local_rng)
    return path.name, examples


def run(report=None, should_stop=None, ask=None, seed=42, max_workers=None):
    templates = load_templates()
    max_workers = max_workers or os.cpu_count() or 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    writers = {lang: open(OUTPUT_DIR / f"dataset_{lang}.jsonl", "w", encoding="utf-8") for lang in LANGUAGES}

    # Orden estable: necesario para que el reporte de progreso sea
    # consistente entre corridas, aunque el procesamiento en sí ya no
    # depende del orden gracias a la semilla por archivo.
    json_files = sorted(JSON_DIR.rglob("*.json"), key=lambda p: p.name)
    total = len(json_files) or 1
    total_examples, skipped_files, completed = 0, 0, 0

    try:
        with ProcessPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(_process_one_file, str(path), templates, seed): path
                for path in json_files
            }

            for future in as_completed(futures):
                if should_stop and should_stop():
                    # Cancela las tareas que todavía no empezaron; las que ya
                    # están corriendo en otro proceso se dejan terminar solas
                    # (no se pueden interrumpir a mitad de trabajo de forma limpia).
                    for f in futures:
                        f.cancel()
                    if report:
                        report((completed / total) * 100, "Cancelado por el usuario")
                    return

                name, examples = future.result()
                completed += 1

                if examples is None:
                    skipped_files += 1
                else:
                    for example in examples:
                        writers[example["language"]].write(json.dumps(example, ensure_ascii=False) + "\n")
                    total_examples += len(examples)

                if report:
                    report((completed / total) * 100, f"Procesado {name} ({completed}/{total})")
    finally:
        for w in writers.values():
            w.close()

    msg = (f"Ejemplos generados: {total_examples} | Archivos omitidos (no son build válido): {skipped_files} | "
           f"Procesos usados: {max_workers}")
    print(msg)
    if report:
        report(100, msg)


def main():
    run()


if __name__ == "__main__":
    main()