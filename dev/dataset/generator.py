"""
dev/dataset/generator.py

Recorre dev/json/*.json, y por cada objeto de cada build real genera
múltiples frases (es/en) describiendo su adición, usando describer.py.
Escribe el dataset como JSONL en dev/dataset/output/.

Uso suelto:
    python dev/dataset/generator.py              # dataset completo
    python dev/dataset/generator.py --limit 5    # muestra de 5 archivos -> *_sample.jsonl
"""

import sys
import json
import random
import shutil
from pathlib import Path
import os
import time
import sys
from collections import Counter
from concurrent.futures import ProcessPoolExecutor, as_completed


sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from extractor.extractor import JSON_DIR, load_json, get_top_level_build
from dataset.describer import describe_object, normalize_properties, has_complex_properties

DATASET_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = DATASET_DIR / "templates"
OUTPUT_DIR = DATASET_DIR / "output"

LANGUAGES = ["es", "en", "pt", "de", "fr", "ru", "zh", "ja", "ko", "it", "tr", "pl"]
VARIATIONS_PER_OBJECT = 6  # con 12 idiomas, 20 pesaría varios GB
MIN_FREE_BYTES = 2 * 1024 ** 3  # si el disco baja de 2 GB libres, se detiene
DEFAULT_MAX_WORKERS = 4  # cada worker re-importa main.py (y pygame) en Windows; súbelo si te sobra RAM


def load_templates():
    templates = {}
    for lang in LANGUAGES:
        templates[lang] = load_json(TEMPLATES_DIR / f"{lang}.json", None)
        if templates[lang] is None:
            raise FileNotFoundError(f"Falta dev/dataset/templates/{lang}.json")
    return templates


def resolve_parents(connections, context):
    """Todas las conexiones como (punto, índice, tipo_padre). Devuelve None si
    alguna no resuelve dentro del contexto (índice hacia adelante o inválido):
    describirla a medias enseñaría a inventar la conexión."""
    parents = []
    for entry in connections:
        if not (isinstance(entry, list) and len(entry) == 3):
            return None
        _local_type, point, index = entry
        if not (isinstance(index, int) and 1 <= index <= len(context)):
            return None
        parents.append((point, index, context[index - 1][0]))
    return parents


def generate_examples_for_build(build, source_name, templates, rng):
    """Devuelve (examples, skipped). skipped cuenta los objetos omitidos y por qué."""
    examples = []
    skipped = {"propiedades_complejas": 0, "conexion_no_resuelta": 0}
    for i, (obj_type, connections, properties) in enumerate(build):
        props = normalize_properties(properties)
        if has_complex_properties(props):
            skipped["propiedades_complejas"] += 1
            continue
        parents = resolve_parents(connections, build[:i])
        if parents is None:
            skipped["conexion_no_resuelta"] += 1
            continue

        for lang in LANGUAGES:
            seen, attempts = set(), 0
            while len(seen) < VARIATIONS_PER_OBJECT and attempts < VARIATIONS_PER_OBJECT * 4:
                attempts += 1
                phrase = describe_object(obj_type, props, parents, templates[lang], rng)
                if phrase in seen:
                    continue
                seen.add(phrase)
                examples.append({
                    "language": lang,
                    "instruction": phrase,
                    "target": [[obj_type, connections, props]],
                    "source_file": source_name,
                    "object_index": i,
                })
    return examples, skipped


def reconstruct_context(source_file, object_index):
    """Reconstruye el build parcial de un ejemplo leyendo el archivo original
    en vez de guardarlo duplicado en el dataset. Usar esto al entrenar/tokenizar,
    no en generator.py."""
    data = load_json(JSON_DIR / source_file, None)
    build = get_top_level_build(data)
    if build is None:
        raise ValueError(f"{source_file} ya no es un build válido (¿se movió o se editó?)")
    return build[:object_index]


def select_files(json_files, limit):
    """Con limit, toma N archivos repartidos parejo sobre la lista ordenada
    (no los primeros N, que incluirían siempre los mismos archivos)."""
    if not limit or limit >= len(json_files):
        return json_files
    step = max(1, len(json_files) // limit)
    return json_files[::step][:limit]


def estimate_output_size(sample_size=5):
    """Estima el tamaño total del dataset sin escribir nada a disco.
    Genera una muestra real de `sample_size` archivos para medir el tamaño
    promedio por ejemplo, y extrapola al resto."""
    templates = load_templates()
    json_files = sorted(JSON_DIR.rglob("*.json"), key=lambda p: p.name)
    sample_files = select_files(json_files, sample_size)

    sample_bytes, sample_examples = 0, 0
    for path in sample_files:
        data = load_json(path, None)
        build = get_top_level_build(data) if data is not None else None
        if build is None:
            continue
        local_rng = random.Random(f"42:{path.name}")
        examples, _skipped, _stats = generate_examples_for_build(build, path.name, templates, local_rng)
        sample_examples += len(examples)
        sample_bytes += sum(len(json.dumps(e, ensure_ascii=False)) + 1 for e in examples)

    if sample_examples == 0:
        print("La muestra no generó ejemplos, no se puede estimar.")
        return

    avg_bytes_per_example = sample_bytes / sample_examples
    estimated_total = sample_bytes * (len(json_files) / len(sample_files))

    print(f"Muestra: {sample_examples} ejemplos de {len(sample_files)} archivos, "
          f"{avg_bytes_per_example:.0f} bytes/ejemplo promedio")
    print(f"Estimado total ({len(json_files)} archivos): ~{estimated_total / 1024 / 1024:.1f} MB")


def _process_one_file(path_str, templates, seed):
    """Función de worker: corre en un proceso aparte. Debe recibir todo lo
    que necesita como argumento (templates, seed) porque los procesos no
    comparten memoria entre sí."""
    path = Path(path_str)
    data = load_json(path, None)
    build = get_top_level_build(data) if data is not None else None

    if build is None:
        return path.name, None, {}

    # Semilla propia por archivo, independiente del orden de ejecución o
    # finalización: así el resultado es reproducible aunque los procesos
    # terminen en un orden distinto cada vez.
    local_rng = random.Random(f"{seed}:{path.name}")
    examples, skipped = generate_examples_for_build(build, path.name, templates, local_rng)
    return path.name, examples, skipped


def run(report=None, should_stop=None, ask=None, seed=42, max_workers=None, limit=None):
    templates = load_templates()
    max_workers = max_workers or min(os.cpu_count() or 1, DEFAULT_MAX_WORKERS)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    free = shutil.disk_usage(OUTPUT_DIR).free
    if free < MIN_FREE_BYTES:
        raise RuntimeError(
            f"Espacio libre insuficiente ({free / 1024 ** 3:.1f} GB, mínimo "
            f"{MIN_FREE_BYTES / 1024 ** 3:.0f} GB): no se genera el dataset."
        )

    suffix = "_sample" if limit else ""
    writers = {
        lang: open(OUTPUT_DIR / f"dataset_{lang}{suffix}.jsonl", "w", encoding="utf-8")
        for lang in LANGUAGES
    }

    # Orden estable: necesario para que el reporte de progreso sea
    # consistente entre corridas, aunque el procesamiento en sí ya no
    # depende del orden gracias a la semilla por archivo.
    all_files = sorted(JSON_DIR.rglob("*.json"), key=lambda p: p.name)
    json_files = select_files(all_files, limit)
    total = len(json_files) or 1

    total_examples, skipped_files, completed = 0, 0, 0
    started_at = time.perf_counter()
    skipped_totals = {"propiedades_complejas": 0, "conexion_no_resuelta": 0}
    stats = {"objects": Counter(), "properties": Counter(), "property_types": Counter(), "colors": Counter(), "languages": Counter(), "connections": Counter(), "connection_total": 0}

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

                free = shutil.disk_usage(OUTPUT_DIR).free
                if free < MIN_FREE_BYTES:
                    for f in futures:
                        f.cancel()
                    raise RuntimeError(
                        f"Se detiene: quedan {free / 1024 ** 3:.1f} GB libres "
                        f"(mínimo {MIN_FREE_BYTES / 1024 ** 3:.0f} GB)."
                    )

                name, examples, skipped = future.result()
                completed += 1

                if examples is None:
                    skipped_files += 1
                else:
                    for example in examples:
                        writers[example["language"]].write(json.dumps(example, ensure_ascii=False) + "\n")
                    total_examples += len(examples)
                    for example in examples:
                        stats["languages"][example["language"]] += 1
                        obj_type, connections, props = example["target"][0]
                        stats["objects"][obj_type] += 1
                        stats["connections"][len(connections)] += 1
                        stats["connection_total"] += len(connections)
                        for name, value in props.items():
                            stats["properties"][name] += 1
                            if isinstance(value, bool): kind = "Boolean"
                            elif isinstance(value, int): kind = "Integer"
                            elif isinstance(value, float): kind = "Number"
                            elif isinstance(value, str): kind = "String"
                            elif isinstance(value, list): kind = "Array"
                            elif isinstance(value, dict): kind = "Object"
                            else: kind = type(value).__name__
                            stats["property_types"][kind] += 1
                            if name == "RGB": stats["colors"][str(value)] += 1
                    for key, value in skipped.items():
                        skipped_totals[key] += value

                if report:
                    report((completed / total) * 100, f"Procesado {name} ({completed}/{total})")
    finally:
        for w in writers.values():
            w.close()

    elapsed = max(time.perf_counter() - started_at, 1e-9)
    output_files = [OUTPUT_DIR / ("dataset_" + lang + suffix + ".jsonl") for lang in LANGUAGES if (OUTPUT_DIR / ("dataset_" + lang + suffix + ".jsonl")).exists()]
    total_bytes = sum(path.stat().st_size for path in output_files)
    examples_per_second = total_examples / elapsed

    def counter_text(counter, limit=None):
        items = counter.most_common(limit)
        return "\n".join("  {:<32} {:,}".format(key, value) for key, value in items) or "  (ninguno)"

    multiplier = len(LANGUAGES) * VARIATIONS_PER_OBJECT
    generated_objects = total_examples // multiplier
    analyzed_objects = generated_objects + skipped_totals["propiedades_complejas"] + skipped_totals["conexion_no_resuelta"]
    object_stats = Counter({key: value // multiplier for key, value in stats["objects"].items()})
    property_stats = Counter({key: value // multiplier for key, value in stats["properties"].items()})
    property_type_stats = Counter({key: value // multiplier for key, value in stats["property_types"].items()})
    connection_stats = Counter({key: value // multiplier for key, value in stats["connections"].items()})
    connection_total = stats["connection_total"] // multiplier
    rgb_stats = Counter({key: value // multiplier for key, value in stats["colors"].items()})
    msg = "\n".join([
        "", "╔══════════════════════════════════════════════════════════════╗",
        "║                 RtG-AI DATASET REPORT                       ║",
        "╚══════════════════════════════════════════════════════════════╝",
        "", "[INPUT]",
        "  Builds encontrados              {:,}".format(len(all_files)),
        "  Builds procesados               {:,}".format(len(json_files)),
        "  Builds inválidos                {:,}".format(skipped_files),
        "", "[OBJECTS]",
        "  Objetos analizados              {:,}".format(analyzed_objects),
        "  Objetos generados               {:,}".format(generated_objects),
        "  Propiedades complejas           {:,}".format(skipped_totals["propiedades_complejas"]),
        "  Conexiones no resueltas         {:,}".format(skipped_totals["conexion_no_resuelta"]),
        "", "[EXAMPLES]",
        "  Idiomas                         {:,}".format(len(LANGUAGES)),
        "  Variaciones por objeto/idioma  {:,}".format(VARIATIONS_PER_OBJECT),
        "  Ejemplos totales               {:,}".format(total_examples),
        "", "  Ejemplos por idioma:", counter_text(stats["languages"]),
        "", "[OBJECT TYPES]", counter_text(object_stats, 25),
        "", "[PROPERTIES]",
        "  Propiedades registradas        {:,}".format(sum(property_stats.values())),
        counter_text(property_stats, 30),
        "", "[PROPERTY TYPES]", counter_text(property_type_stats),
        "", "[RGB]",
        "  Valores RGB exactos             {:,}".format(sum(rgb_stats.values())),
        counter_text(rgb_stats, 20),
        "", "[CONNECTIONS]",
        "  Conexiones totales              {:,}".format(connection_total),
        "  Distribución:", counter_text(connection_stats),
        "", "[OUTPUT]",
        "  Archivos JSONL                  {:,}".format(len(output_files)),
        "  Tamaño total                    {:.2f} MB".format(total_bytes / 1024 / 1024),
        "", "[PERFORMANCE]",
        "  Procesos                        {:,}".format(max_workers),
        "  Tiempo total                    {:.2f} s".format(elapsed),
        "  Ejemplos/segundo                {:,.0f}".format(examples_per_second),
        "", "══════════════════════════════════════════════════════════════",
        "Dataset generado correctamente.",
        "══════════════════════════════════════════════════════════════",
    ])
    try:
        print(msg)
    except UnicodeEncodeError:
        safe_msg = msg.encode(sys.stdout.encoding or "utf-8", errors="replace").decode(sys.stdout.encoding or "utf-8", errors="replace")
        print(safe_msg)
    if report:
        report(100, msg)


def main():
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])
    run(limit=limit)


if __name__ == "__main__":
    main()