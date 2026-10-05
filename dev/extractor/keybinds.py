"""
dev/extractor/keybinds.py

Extrae todos los caracteres utilizados por la propiedad ActivationKey
de dev/json/**/*.json y actualiza EXCLUSIVAMENTE la sección:

    "keybinds": [
        ...
    ]

dentro de dev/tokens.json.

El formato utilizado para la lista de keybinds es el mismo que utiliza
extractor.py para las listas de strings.

IMPORTANTE:
    Este archivo NO vuelve a serializar tokens.json completo.
    Solo reemplaza el contenido de la sección keybinds.
"""

import json
from pathlib import Path


# ===========================================================================
# CONFIGURACIÓN
# ===========================================================================

DEV_DIR = Path(__file__).resolve().parent.parent
JSON_DIR = DEV_DIR / "json"
TOKENS_PATH = DEV_DIR / "tokens.json"


# ===========================================================================
# JSON
# ===========================================================================

def load_json(path):
    """
    Carga un archivo JSON individual.
    """

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ===========================================================================
# DESCUBRIMIENTO
# ===========================================================================

def find_activation_keys(node):
    """
    Busca recursivamente propiedades llamadas exactamente
    'ActivationKey'.

    Solo se consideran valores string.
    """

    found = []

    if isinstance(node, dict):

        for key, value in node.items():

            if key == "ActivationKey":
                if isinstance(value, str):
                    found.append(value)

            if isinstance(value, (dict, list)):
                found.extend(find_activation_keys(value))

    elif isinstance(node, list):

        for item in node:

            if isinstance(item, (dict, list)):
                found.extend(find_activation_keys(item))

    return found


# ===========================================================================
# EXTRACCIÓN
# ===========================================================================

def extract_keybind_characters(report=None, should_stop=None):
    """
    Escanea todos los archivos JSON dentro de dev/json/**/*.json.

    De cada ActivationKey obtiene todos sus caracteres individuales.

    Cada carácter observado se agrega una sola vez.
    """

    json_files = list(JSON_DIR.rglob("*.json"))
    total = len(json_files) or 1

    keybinds = set()
    activation_values = []

    for i, path in enumerate(json_files):

        if should_stop and should_stop():

            if report:
                report(
                    (i / total) * 100,
                    "Extracción de keybinds cancelada"
                )

            return None

        try:
            data = load_json(path)

        except (json.JSONDecodeError, OSError) as exc:

            if report:
                report(
                    (i + 1) / total * 100,
                    f"Omitido {path.name}: {exc}"
                )

            continue

        values = find_activation_keys(data)

        for value in values:

            activation_values.append(value)

            for character in value:
                keybinds.add(character)

        if report:
            report(
                (i + 1) / total * 100,
                f"Escaneado {path.name} "
                f"({i + 1}/{len(json_files)})"
            )

    return sorted(keybinds), activation_values


# ===========================================================================
# FORMATEO
# ===========================================================================

def _wrap_string_list(items, indent, max_width=100):
    """
    Copia el formato utilizado por extractor.py.

    Empaqueta strings en varias líneas hasta alcanzar max_width,
    en vez de escribir un elemento por línea.

    Ejemplo:

        [
          "a", "b", "c", "d", ...
        ]

    """

    lines = []
    current = []
    current_len = indent

    for idx, item in enumerate(items):

        piece = json.dumps(
            item,
            ensure_ascii=False
        )

        piece += "," if idx < len(items) - 1 else ""

        piece_len = len(piece) + 1

        if current and current_len + piece_len > max_width:

            lines.append(
                " " * indent + " ".join(current)
            )

            current = []
            current_len = indent

        current.append(piece)
        current_len += piece_len

    if current:

        lines.append(
            " " * indent + " ".join(current)
        )

    return lines


# ===========================================================================
# LOCALIZACIÓN DE KEYBINDS
# ===========================================================================

def find_keybinds_section(text):
    """
    Encuentra exclusivamente la sección:

        "keybinds": [
            ...
        ]

    y devuelve:

        (start, end)

    donde start y end delimitan únicamente el contenido interno
    de la lista.

    La línea de apertura y la línea de cierre permanecen intactas.
    """

    lines = text.splitlines(keepends=True)

    keybinds_line_index = None

    # -----------------------------------------------------------------------
    # Buscar línea de apertura
    # -----------------------------------------------------------------------

    for i, line in enumerate(lines):

        stripped = line.strip()

        if (
            stripped.startswith('"keybinds"')
            and stripped.endswith("[")
        ):

            keybinds_line_index = i
            break

    if keybinds_line_index is None:

        raise ValueError(
            'No se encontró la sección `"keybinds": [` en tokens.json.'
        )

    # -----------------------------------------------------------------------
    # Inicio del contenido
    # -----------------------------------------------------------------------

    start = sum(
        len(line)
        for line in lines[:keybinds_line_index + 1]
    )

    # -----------------------------------------------------------------------
    # Buscar línea de cierre
    # -----------------------------------------------------------------------

    end_line_index = None

    for i in range(
        keybinds_line_index + 1,
        len(lines)
    ):

        if lines[i].strip() == "]":

            end_line_index = i
            break

    if end_line_index is None:

        raise ValueError(
            'Se encontró `"keybinds": [` pero no se encontró '
            'el cierre `]` correspondiente.'
        )

    end = sum(
        len(line)
        for line in lines[:end_line_index]
    )

    return start, end


def get_keybinds_indentation(text):
    """
    Obtiene la indentación de los elementos de keybinds.

    Si existen elementos, copia la indentación de uno de ellos.

    Si la lista está vacía, utiliza la indentación de la propiedad
    keybinds + dos espacios.
    """

    lines = text.splitlines()

    keybinds_line_index = None

    for i, line in enumerate(lines):

        stripped = line.strip()

        if (
            stripped.startswith('"keybinds"')
            and stripped.endswith("[")
        ):

            keybinds_line_index = i
            break

    if keybinds_line_index is None:

        raise ValueError(
            'No se pudo localizar la línea de keybinds.'
        )

    # -----------------------------------------------------------------------
    # Intentar copiar la indentación de un elemento existente
    # -----------------------------------------------------------------------

    for i in range(
        keybinds_line_index + 1,
        len(lines)
    ):

        stripped = lines[i].strip()

        if stripped == "]":
            break

        if stripped:

            return len(lines[i]) - len(lines[i].lstrip())

    # -----------------------------------------------------------------------
    # Lista vacía
    # -----------------------------------------------------------------------

    keybinds_indent = len(
        lines[keybinds_line_index]
    ) - len(
        lines[keybinds_line_index].lstrip()
    )

    return keybinds_indent + 2


# ===========================================================================
# ESCRITURA
# ===========================================================================

def replace_keybinds_only(keybinds):
    """
    Reemplaza exclusivamente el contenido de keybinds.

    El formato interno utiliza exactamente la misma lógica de
    empaquetado que extractor.py.

    Todo lo demás de tokens.json permanece intacto.
    """

    # -----------------------------------------------------------------------
    # Leer archivo
    # -----------------------------------------------------------------------

    with open(
        TOKENS_PATH,
        "r",
        encoding="utf-8",
        newline=""
    ) as f:

        text = f.read()

    # -----------------------------------------------------------------------
    # Localizar sección
    # -----------------------------------------------------------------------

    start, end = find_keybinds_section(text)

    # -----------------------------------------------------------------------
    # Obtener indentación
    # -----------------------------------------------------------------------

    indent = get_keybinds_indentation(text)

    # -----------------------------------------------------------------------
    # Detectar salto de línea
    # -----------------------------------------------------------------------

    newline = "\r\n" if "\r\n" in text else "\n"

    # -----------------------------------------------------------------------
    # Formatear utilizando el mismo algoritmo de extractor.py
    # -----------------------------------------------------------------------

    formatted_lines = _wrap_string_list(
        keybinds,
        indent,
        max_width=100
    )

    new_content = ""

    if formatted_lines:
        new_content = newline.join(formatted_lines) + newline

    # -----------------------------------------------------------------------
    # Reemplazo quirúrgico
    # -----------------------------------------------------------------------
    #
    # Se conserva:
    #
    #     "keybinds": [
    #
    # Se reemplaza:
    #
    #     SOLO el contenido interno
    #
    # Se conserva:
    #
    #     ]
    #
    # -----------------------------------------------------------------------

    new_text = (
        text[:start]
        + new_content
        + text[end:]
    )

    # -----------------------------------------------------------------------
    # Escribir
    # -----------------------------------------------------------------------

    with open(
        TOKENS_PATH,
        "w",
        encoding="utf-8",
        newline=""
    ) as f:

        f.write(new_text)


# ===========================================================================
# STAGE
# ===========================================================================

def run(report=None, should_stop=None, ask=None):
    """
    Punto de entrada utilizado por KeybindsStage.
    """

    result = extract_keybind_characters(
        report=report,
        should_stop=should_stop
    )

    if result is None:
        return

    keybinds, activation_values = result

    if should_stop and should_stop():
        return

    replace_keybinds_only(keybinds)

    msg = (
        f"Keybinds encontrados: {len(keybinds)} | "
        f"Valores ActivationKey: {len(activation_values)}"
    )

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
