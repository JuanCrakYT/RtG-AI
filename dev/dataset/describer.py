"""
dev/dataset/describer.py

Describe COMPLETAMENTE un objeto de un build real: la instrucción debe
contener todo lo necesario para reconstruir el target (RGB exacto, todas las
conexiones, todas las propiedades). Si no, el modelo aprende a inventar.
"""

import random

from dataset.colors.rgb_colors import nearest_color_key

ORIENTATION_AXES = {"OrientationX": "X", "OrientationY": "Y", "OrientationZ": "Z"}
SCALAR_TYPES = (bool, int, float, str)


def normalize_properties(properties):
    """Quita contenedores vacíos (artefacto de Lua: "EphemeralAttachments": [])
    y ordena las claves alfabéticamente. El orden original es arbitrario y el
    cargador del juego lo ignora, así que fijarlo elimina ruido."""
    if not isinstance(properties, dict):
        return {}
    cleaned = {k: v for k, v in properties.items() if v != [] and v != {}}
    return dict(sorted(cleaned.items()))


def _valid_rgb(v):
    return (isinstance(v, list) and len(v) == 3
            and all(isinstance(c, (int, float)) and not isinstance(c, bool) for c in v))


def has_complex_properties(properties):
    """True si hay valores que una frase no puede describir (ej.
    EphemeralAttachments con cframes). Esos ejemplos se omiten."""
    for k, v in properties.items():
        if k == "RGB":
            if not _valid_rgb(v):
                return True
        elif not isinstance(v, SCALAR_TYPES):
            return True
    return False


def describe_object(obj_type, properties, parents, templates, rng=random):
    """properties: ya normalizadas. parents: lista de (punto, índice, tipo_padre)
    de TODAS las conexiones, en orden (el orden importa, ej. Wire)."""
    slots = {
        "verb": rng.choice(templates["verbs"]),
        "object": rng.choice(templates["object_ref"]).format(type=obj_type),
        "color": "", "connections": "", "props": "",
    }

    rgb = properties.get("RGB")
    if rgb is not None:
        color_key = nearest_color_key(rgb)
        if color_key is not None:
            color_options = templates["colors"].get(color_key, [color_key])
            name = rng.choice(color_options)
            exact = f"{name} ({rgb[0]}, {rgb[1]}, {rgb[2]})"
            slots["color"] = rng.choice(templates["color_clauses"]).format(color=exact)

    if parents:
        clauses = [
            rng.choice(templates["connection_clauses"]).format(parent_type=t, index=i, point=p)
            for (p, i, t) in parents
        ]
        slots["connections"] = templates.get("conjunction", " and ").join(clauses)

    prop_clauses = []
    for name, value in properties.items():
        if name == "RGB":
            continue
        if name in ORIENTATION_AXES and templates.get("orientation_clauses"):
            clause = rng.choice(templates["orientation_clauses"]).format(axis=ORIENTATION_AXES[name], value=value)
        else:
            display = rng.choice(templates.get("property_names", {}).get(name, [name]))
            if isinstance(value, bool):
                shown = rng.choice(templates["boolean_words"]["true" if value else "false"])
            elif isinstance(value, str):
                shown = f'"{value}"'
            else:
                shown = value
            clause = rng.choice(templates["property_clauses"]).format(prop=display, value=shown)
        prop_clauses.append(clause)
    rng.shuffle(prop_clauses)
    slots["props"] = templates.get("prop_separator", " ").join(prop_clauses)

    patterns = templates.get("sentence_patterns", ["{verb} {object} {color} {connections} {props}"])
    sentence = " ".join(rng.choice(patterns).format(**slots).split())
    return sentence[:1].upper() + sentence[1:]
