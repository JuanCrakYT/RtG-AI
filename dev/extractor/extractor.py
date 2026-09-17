"""
dev/extractor/extractor.py

Escanea dev/json/*.json, compara objetos y propiedades contra dev/tokens.json,
y registra lo desconocido en dev/unknown-properties.json.

Reglas clave:
- Nunca clasifica automáticamente como "Integer" (regla semántica del proyecto).
- Números decimales van a Human.Number para revisión manual, nunca se asumen.
- No sobreescribe clasificaciones ya hechas a mano en corridas anteriores.
"""

import json
from pathlib import Path

DEV_DIR = Path(__file__).resolve().parent.parent
JSON_DIR = DEV_DIR / "json"
TOKENS_PATH = DEV_DIR / "tokens.json"
UNKNOWN_PATH = DEV_DIR / "unknown-properties.json"


def load_json(path, default):
    if not path.exists():
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_known_sets(tokens_data):
    names = tokens_data[0]["Names"]
    known_objects = set(names["Objects"])
    known_properties = set()
    for category_list in names["Properties"].values():
        known_properties.update(category_list)
    return known_objects, known_properties


def already_tracked(prop_name, unknown_data):
    """True si la propiedad ya aparece en CUALQUIER bucket (Auto o Human)."""
    for section in ("Auto", "Human"):
        for bucket in unknown_data["Properties"].get(section, {}).values():
            if prop_name in bucket:
                return True
    return False


def is_decimal(value):
    """True si el número tiene parte decimal real (12.5), no si es 10.0."""
    return isinstance(value, float) and not value.is_integer()


def classify_value(value):
    """Devuelve (seccion, categoria) para un valor nunca antes visto."""
    if isinstance(value, bool):
        return "Auto", "Boolean"
    if isinstance(value, str):
        return "Auto", "String"
    if isinstance(value, list):
        return "Auto", "Array"
    if isinstance(value, dict):
        return "Auto", "Object"
    if isinstance(value, float):
        if not value.is_integer():
            return "Auto", "Number"    # decimal real -> no puede ser Integer, seguro
        return "Human", "Number"       # ej. 10.0 -> ambiguo igual que un int, a revisión
    if isinstance(value, int):
        return "Human", "Number"       # entero -> ambiguo (¿Number o Integer?), nunca se asume
    return "Human", "Unclassified"


def find_object_tuples(node):
    """Busca recursivamente tuplas [Type:str, Connections:list, Properties:dict]
    en cualquier parte del JSON, sin asumir una estructura rígida de nivel superior."""
    found = []
    if isinstance(node, list):
        if (len(node) == 3 and isinstance(node[0], str)
                and isinstance(node[1], list) and isinstance(node[2], dict)):
            found.append(node)
        for item in node:
            found.extend(find_object_tuples(item))
    elif isinstance(node, dict):
        for value in node.values():
            found.extend(find_object_tuples(value))
    return found


def ensure_structure(unknown_data):
    unknown_data.setdefault("Properties", {})
    unknown_data["Properties"].setdefault("Human", {})
    unknown_data["Properties"]["Human"].setdefault("Integer", [])  # bandeja manual, nunca auto-poblada
    unknown_data["Properties"].setdefault("Auto", {})
    for cat in ("Boolean", "Array", "Object", "String", "Number"):
        unknown_data["Properties"]["Auto"].setdefault(cat, [])
    unknown_data.setdefault("Objects", {})
    unknown_data["Objects"].setdefault("Auto", [])


def main():
    tokens_data = load_json(TOKENS_PATH, [{"Names": {"Objects": [], "Properties": {}}}])
    unknown_data = load_json(UNKNOWN_PATH, {})
    ensure_structure(unknown_data)

    known_objects, known_properties = get_known_sets(tokens_data)
    known_unknown_objects = set(unknown_data["Objects"]["Auto"])

    new_objects, new_properties = 0, 0

    for path in JSON_DIR.rglob("*.json"):
        data = load_json(path, None)
        if data is None:
            continue
        for obj_type, _connections, properties in find_object_tuples(data):
            if obj_type not in known_objects and obj_type not in known_unknown_objects:
                unknown_data["Objects"]["Auto"].append(obj_type)
                known_unknown_objects.add(obj_type)
                new_objects += 1

            for prop_name, value in properties.items():
                if prop_name in known_properties:
                    continue
                if already_tracked(prop_name, unknown_data):
                    continue
                section, category = classify_value(value)
                unknown_data["Properties"][section].setdefault(category, [])
                unknown_data["Properties"][section][category].append(prop_name)
                new_properties += 1

    for section in ("Auto", "Human"):
        for cat in unknown_data["Properties"][section]:
            unknown_data["Properties"][section][cat] = sorted(set(unknown_data["Properties"][section][cat]))
    unknown_data["Objects"]["Auto"] = sorted(set(unknown_data["Objects"]["Auto"]))

    with open(UNKNOWN_PATH, "w", encoding="utf-8") as f:
        json.dump(unknown_data, f, indent=2, ensure_ascii=False)

    print(f"Objetos nuevos: {new_objects} | Propiedades nuevas: {new_properties}")


if __name__ == "__main__":
    main()
