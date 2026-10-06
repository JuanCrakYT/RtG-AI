"""
dev/extractor/keybinds.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from extractor.extractor import (
    DEV_DIR, JSON_DIR, TOKENS_PATH,
    load_json, dump_pretty,
)

def find_activation_keys(node):
    found = []
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "ActivationKey" and isinstance(value, str):
                found.append(value)
            if isinstance(value, (dict, list)):
                found.extend(find_activation_keys(value))
    elif isinstance(node, list):
        for item in node:
            if isinstance(item, (dict, list)):
                found.extend(find_activation_keys(item))
    return found


def run(report=None, should_stop=None, ask=None):
    tokens_data = load_json(TOKENS_PATH, [{"Names": {"Objects": [], "Properties": {}}}])
    tokens_data[0].setdefault("Characters", {})

    json_files = list(JSON_DIR.rglob("*.json"))
    total = len(json_files) or 1
    keybinds = set()
    activation_count = 0

    for i, path in enumerate(json_files):
        if should_stop and should_stop():
            if report:
                report((i / total) * 100, "Cancelado por el usuario")
            return

        data = load_json(path, None)
        if data is None:
            continue

        for value in find_activation_keys(data):
            activation_count += 1
            keybinds.update(value)

        if report:
            report((i + 1) / total * 100, f"Escaneado {path.name} ({i + 1}/{total})")

    tokens_data[0]["Characters"]["keybinds"] = sorted(keybinds)

    with open(TOKENS_PATH, "w", encoding="utf-8") as f:
        f.write(dump_pretty(tokens_data))

    msg = f"Keybinds encontrados: {len(keybinds)} | Valores ActivationKey: {activation_count}"
    print(msg)
    if report:
        report(100, msg)


# ===========================================================================
# MAIN
# ===========================================================================

def main():
    run()


if __name__ == "__main__":
    main()
