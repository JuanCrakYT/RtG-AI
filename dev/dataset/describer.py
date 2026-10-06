"""
dev/dataset/describer.py

Arma frases en lenguaje natural para un objeto de un build real, usando
una gramática de slots (combinatoria, no frases fijas). Pura lógica: no
toca disco ni conoce la estructura de carpetas del proyecto.
"""

import random

CANONICAL_COLORS = {
    "red": (220, 30, 30), "orange": (230, 130, 30), "yellow": (230, 220, 40),
    "green": (40, 180, 70), "cyan": (40, 190, 200), "blue": (40, 90, 220),
    "purple": (140, 60, 190), "pink": (230, 100, 170), "brown": (120, 80, 50),
    "white": (235, 235, 235), "gray": (130, 130, 130), "black": (25, 25, 25),
}


def closest_color_name(rgb):
    if not (isinstance(rgb, list) and len(rgb) == 3):
        return None
    r, g, b = rgb
    best_name, best_dist = None, float("inf")
    for name, (cr, cg, cb) in CANONICAL_COLORS.items():
        dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
        if dist < best_dist:
            best_name, best_dist = name, dist
    return best_name


# Propiedades que no se describen como "con {prop} {value}" porque son
# estructuras complejas (contenedores) o ya se describen aparte (color).
SKIP_PROPERTIES = {"RGB", "EphemeralAttachments"}


def describe_object(obj_type, connections, properties, parent_index, parent_type, templates, rng=random):
    """Devuelve una frase para describir la adición de este objeto.
    parent_index/parent_type: del primer elemento de `connections`, o None
    si el objeto no tiene conexiones (ej. la raíz del build)."""

    verb = rng.choice(templates["verbs"])
    obj_phrase = rng.choice(templates["object_ref"]).format(type=obj_type)
    parts = [verb, obj_phrase]

    color_name = closest_color_name(properties.get("RGB")) if isinstance(properties, dict) else None
    if color_name:
        localized = rng.choice(templates["colors"].get(color_name, [color_name]))
        parts.append(rng.choice(templates["color_clauses"]).format(color=localized))

    if parent_type is not None:
        point = None
        if isinstance(connections, list) and connections and isinstance(connections[0], list) and len(connections[0]) == 3:
            point = connections[0][1]
        parts.append(rng.choice(templates["connection_clauses"]).format(
            parent_type=parent_type, index=parent_index, point=point
        ))

    if isinstance(properties, dict):
        extra_props = [k for k in properties if k not in SKIP_PROPERTIES]
        rng.shuffle(extra_props)
        for prop_name in extra_props[:2]:  # como mucho 2 propiedades extra por frase, para no saturar
            if rng.random() < 0.5:  # no siempre se mencionan, para variar
                parts.append(rng.choice(templates["property_clauses"]).format(
                    prop=prop_name, value=properties[prop_name]
                ))

    sentence = " ".join(parts).strip()
    return sentence[0].upper() + sentence[1:] if sentence else sentence