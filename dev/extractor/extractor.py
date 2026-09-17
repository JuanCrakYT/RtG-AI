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
            return "Auto", "Number"     # decimal real -> no puede ser Integer, seguro
        return "Human", "Integer"       # ej. 10.0 -> ambiguo, candidato a Integer
    if isinstance(value, int):
        return "Human", "Integer"       # entero -> ambiguo, nunca se asume, va a revisión
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


def promote_auto(tokens_data, unknown_data):
    """Mueve todo lo que está en Auto (propiedades y objetos) a tokens.json,
    y lo borra de unknown-properties.json. Human nunca se toca aquí."""
    names = tokens_data[0]["Names"]
    promoted_props, promoted_objects = 0, 0

    for category, prop_list in unknown_data["Properties"]["Auto"].items():
        if not prop_list:
            continue
        names["Properties"].setdefault(category, [])
        for prop_name in prop_list:
            if prop_name not in names["Properties"][category]:
                names["Properties"][category].append(prop_name)
                promoted_props += 1
        unknown_data["Properties"]["Auto"][category] = []

    for obj_name in unknown_data["Objects"]["Auto"]:
        if obj_name not in names["Objects"]:
            names["Objects"].append(obj_name)
            promoted_objects += 1
    unknown_data["Objects"]["Auto"] = []

    for category in names["Properties"]:
        names["Properties"][category] = sorted(set(names["Properties"][category]))
    names["Objects"] = sorted(set(names["Objects"]))

    return promoted_props, promoted_objects

def _wrap_string_list(items, indent, max_width=100):
    """Empaqueta strings en líneas de hasta max_width caracteres, en vez de una por línea."""
    lines, current, current_len = [], [], indent
    for idx, item in enumerate(items):
        piece = json.dumps(item, ensure_ascii=False)
        piece += "," if idx < len(items) - 1 else ""
        piece_len = len(piece) + 1  # +1 por el espacio separador
        if current and current_len + piece_len > max_width:
            lines.append(" " * indent + " ".join(current))
            current, current_len = [], indent
        current.append(piece)
        current_len += piece_len
    if current:
        lines.append(" " * indent + " ".join(current))
    return lines


def _format_value(value, indent):
    pad = " " * indent
    closing_pad = " " * (indent - 2)

    if isinstance(value, dict):
        if not value:
            return "{}"
        entries = []
        keys = list(value.keys())
        for i, key in enumerate(keys):
            comma = "," if i < len(keys) - 1 else ""
            entries.append(f'{pad}{json.dumps(key, ensure_ascii=False)}: {_format_value(value[key], indent + 2)}{comma}')
        return "{\n" + "\n".join(entries) + "\n" + closing_pad + "}"

    if isinstance(value, list):
        if not value:
            return "[]"
        if all(isinstance(v, str) for v in value):
            body = "\n".join(_wrap_string_list(value, indent))
            return "[\n" + body + "\n" + closing_pad + "]"
        # Respaldo para listas que no son puros strings (no ocurre hoy en tokens.json)
        entries = [f'{pad}{_format_value(v, indent + 2)}' for v in value]
        return "[\n" + ",\n".join(entries) + "\n" + closing_pad + "]"

    return json.dumps(value, ensure_ascii=False)


def dump_pretty(data):
    return _format_value(data, indent=2)

def _note_property(prop_name, value, known_properties, unknown_data, observed_properties):
    """Registra una propiedad vista (sea de nivel superior o anidada en
    EphemeralAttachments) y la clasifica si es nueva. Devuelve 1 si era nueva."""
    observed_properties.add(prop_name)
    if prop_name in known_properties:
        return 0
    if already_tracked(prop_name, unknown_data):
        return 0
    section, category = classify_value(value)
    unknown_data["Properties"][section].setdefault(category, [])
    unknown_data["Properties"][section][category].append(prop_name)
    return 1

def run(report=None, should_stop=None, ask=None):
    tokens_data = load_json(TOKENS_PATH, [{"Names": {"Objects": [], "Properties": {}}}])
    unknown_data = load_json(UNKNOWN_PATH, {})
    ensure_structure(unknown_data)

    known_objects, known_properties = get_known_sets(tokens_data)
    known_unknown_objects = set(unknown_data["Objects"]["Auto"])
    observed_properties = set()

    new_objects, new_properties = 0, 0

    json_files = list(JSON_DIR.rglob("*.json"))
    total = len(json_files) or 1

    for i, path in enumerate(json_files):
        if should_stop and should_stop():
            if report:
                report((i / total) * 100, "Cancelado por el usuario")
            return

        data = load_json(path, None)
        if data is None:
            continue
        for obj_type, _connections, properties in find_object_tuples(data):
            if obj_type not in known_objects and obj_type not in known_unknown_objects:
                unknown_data["Objects"]["Auto"].append(obj_type)
                known_unknown_objects.add(obj_type)
                new_objects += 1

            for prop_name, value in properties.items():
                new_properties += _note_property(prop_name, value, known_properties, unknown_data, observed_properties)

                if prop_name == "EphemeralAttachments" and isinstance(value, dict):
                    for _uuid, attachment in value.items():
                        if not isinstance(attachment, dict):
                            continue
                        for inner_name, inner_value in attachment.items():
                            new_properties += _note_property(
                                inner_name, inner_value, known_properties, unknown_data, observed_properties
                            )

        if report:
            report((i + 1) / total * 100, f"Escaneado {path.name} ({i + 1}/{total})")

    for section in ("Auto", "Human"):
        for cat in unknown_data["Properties"][section]:
            unknown_data["Properties"][section][cat] = sorted(set(unknown_data["Properties"][section][cat]))
    unknown_data["Objects"]["Auto"] = sorted(set(unknown_data["Objects"]["Auto"]))

    promoted_props, promoted_objects = promote_auto(tokens_data, unknown_data)

    if ask:
        for category in list(unknown_data["Properties"]["Human"].keys()):
            for prop_name in list(unknown_data["Properties"]["Human"][category]):
                if should_stop and should_stop():
                    break
                choice = ask(
                    f"'{prop_name}' es ambiguo (detectado como {category}). ¿A qué tipo pertenece?",
                    ["Integer", "Number", "Boolean", "String", "Array", "Object", "Postponer"]
                )
                if choice and choice != "Postponer":
                    names = tokens_data[0]["Names"]
                    names["Properties"].setdefault(choice, [])
                    if prop_name not in names["Properties"][choice]:
                        names["Properties"][choice].append(prop_name)
                    unknown_data["Properties"]["Human"][category].remove(prop_name)

        _, known_properties_now = get_known_sets(tokens_data)
        unused = sorted(known_properties_now - observed_properties)
        if unused:
            ask(f"Estas propiedades están en tokens.json pero no aparecen en ningún ejemplo real de dev/json: "
                f"{', '.join(unused)}", ["OK"])

    with open(TOKENS_PATH, "w", encoding="utf-8") as f:
        f.write(dump_pretty(tokens_data))

    with open(UNKNOWN_PATH, "w", encoding="utf-8") as f:
        json.dump(unknown_data, f, indent=2, ensure_ascii=False)

    msg = (f"Objetos nuevos: {new_objects} | Propiedades nuevas: {new_properties} | "
           f"Promovidos: objetos {promoted_objects}, propiedades {promoted_props}")
    print(msg)
    if report:
        report(100, msg)


def main():
    run()

if __name__ == "__main__":
    main()
