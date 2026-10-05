"""
dev/extractor/keybinds.py

Extrae todos los caracteres utilizados por la propiedad ActivationKey
de dev/json/**/*.json y actualiza EXCLUSIVAMENTE la sección:

    "keybinds": [
        ...
    ]

dentro de dev/tokens.json.

La estructura del archivo sigue la organización utilizada por extractor.py:

    1. Configuración
    2. JSON
    3. Descubrimiento
    4. Extracción
    5. Procesamiento
    6. Escritura
    7. Stage / ejecución

IMPORTANTE:
    Este archivo NO vuelve a serializar tokens.json completo.
    Solo reemplaza el contenido de Characters.keybinds.
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

    Parameters
    ----------
    path : Path
        Archivo JSON que se desea cargar.

    Returns
    -------
    object
        Contenido deserializado del JSON.
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

    El recorrido funciona sobre:

        - diccionarios
        - listas
        - estructuras JSON anidadas

    Solo se consideran valores string.

    Ejemplo:

        {
            "ActivationKey": "F"
        }

    produce:

        ["F"]
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

    De cada propiedad ActivationKey obtiene todos sus caracteres
    individuales.

    No interpreta los caracteres ni genera keybinds adicionales.

    Ejemplo:

        ActivationKey = "Shift+F"

    produce:

        S
        h
        i
        f
        t
        +
        F

    Returns
    -------
    tuple[list[str], list[str]] | None
        Una lista ordenada de caracteres y una lista de los valores
        ActivationKey encontrados.

        Si la operación fue cancelada, devuelve None.
    """

    json_files = list(JSON_DIR.rglob("*.json"))
    total = len(json_files) or 1

    keybinds = set()
    activation_values = []

    for i, path in enumerate(json_files):

        # ---------------------------------------------------------------
        # Cancelación
        # ---------------------------------------------------------------

        if should_stop and should_stop():

            if report:
                report(
                    (i / total) * 100,
                    "Extracción de keybinds cancelada"
                )

            return None

        # ---------------------------------------------------------------
        # Carga
        # ---------------------------------------------------------------

        try:
            data = load_json(path)

        except (json.JSONDecodeError, OSError) as exc:

            if report:
                report(
                    (i + 1) / total * 100,
                    f"Omitido {path.name}: {exc}"
                )

            continue

        # ---------------------------------------------------------------
        # Descubrimiento
        # ---------------------------------------------------------------

        values = find_activation_keys(data)

        # ---------------------------------------------------------------
        # Extracción
        # ---------------------------------------------------------------

        for value in values:

            activation_values.append(value)

            for character in value:
                keybinds.add(character)

        # ---------------------------------------------------------------
        # Progreso
        # ---------------------------------------------------------------

        if report:
            report(
                (i + 1) / total * 100,
                f"Escaneado {path.name} "
                f"({i + 1}/{len(json_files)})"
            )

    return sorted(keybinds), activation_values


# ===========================================================================
# PROCESAMIENTO DE TOKENS
# ===========================================================================

def find_keybinds_section(text):
    """
    Localiza exclusivamente la lista:

        "keybinds": [
            ...
        ]

    dentro de tokens.json.

    Devuelve:

        (start, end)

    donde:

        start
            Es la posición inmediatamente posterior a la línea
            de apertura de keybinds.

        end
            Es la posición donde comienza la línea de cierre ']'.

    Esto permite reemplazar únicamente el contenido de la lista.

    No se utiliza json.dumps() sobre tokens.json completo.
    """

    lines = text.splitlines(keepends=True)

    keybinds_line_index = None

    # -----------------------------------------------------------------------
    # Buscar apertura de keybinds
    # -----------------------------------------------------------------------

    for i, line in enumerate(lines):

        stripped = line.strip()

        if stripped.startswith('"keybinds"') and stripped.endswith("["):

            keybinds_line_index = i
            break

    if keybinds_line_index is None:

        raise ValueError(
            'No se encontró la sección `"keybinds": [` en tokens.json.'
        )

    # -----------------------------------------------------------------------
    # Posición inicial del contenido
    # -----------------------------------------------------------------------

    start = sum(
        len(line)
        for line in lines[:keybinds_line_index + 1]
    )

    # -----------------------------------------------------------------------
    # Buscar cierre de keybinds
    # -----------------------------------------------------------------------

    end_line_index = None

    for i in range(
        keybinds_line_index + 1,
        len(lines)
    ):

        stripped = lines[i].strip()

        if stripped == "]":

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
    Obtiene la indentación utilizada por los elementos de la lista
    keybinds.

    Si la lista ya contiene elementos, utiliza la indentación de
    uno de ellos.

    Si está vacía, utiliza la indentación de la propia propiedad
    keybinds y agrega dos espacios.
    """

    lines = text.splitlines()

    keybinds_line_index = None

    # -----------------------------------------------------------------------
    # Localizar keybinds
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
            'No se pudo localizar la línea de keybinds.'
        )

    # -----------------------------------------------------------------------
    # Buscar indentación de un elemento existente
    # -----------------------------------------------------------------------

    for i in range(
        keybinds_line_index + 1,
        len(lines)
    ):

        stripped = lines[i].strip()

        if stripped == "]":
            break

        if stripped:

            return lines[i][
                :len(lines[i]) - len(lines[i].lstrip())
            ]

    # -----------------------------------------------------------------------
    # Lista vacía
    # -----------------------------------------------------------------------

    keybinds_indent = lines[keybinds_line_index][
        :len(lines[keybinds_line_index])
        - len(lines[keybinds_line_index].lstrip())
    ]

    return keybinds_indent + "  "


# ===========================================================================
# ESCRITURA
# ===========================================================================

def replace_keybinds_only(keybinds):
    """
    Reemplaza exclusivamente el contenido de Characters.keybinds.

    Todo el contenido externo a esa lista permanece intacto.

    No se vuelve a serializar tokens.json completo.
    """

    # -----------------------------------------------------------------------
    # Leer archivo original
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

    item_indent = get_keybinds_indentation(text)

    # -----------------------------------------------------------------------
    # Detectar salto de línea utilizado por el archivo
    # -----------------------------------------------------------------------

    newline = "\r\n" if "\r\n" in text else "\n"

    # -----------------------------------------------------------------------
    # Construir nuevo contenido
    # -----------------------------------------------------------------------

    new_content_lines = []

    for index, character in enumerate(keybinds):

        encoded = json.dumps(
            character,
            ensure_ascii=False
        )

        comma = "," if index < len(keybinds) - 1 else ""

        new_content_lines.append(
            f"{item_indent}{encoded}{comma}{newline}"
        )

    new_content = "".join(new_content_lines)

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
    #     TODO EL CONTENIDO INTERNO
    #
    # Se conserva:
    #
    #     ]
    #
    # Todo lo demás del archivo permanece exactamente igual.
    # -----------------------------------------------------------------------

    new_text = (
        text[:start]
        + new_content
        + text[end:]
    )

    # -----------------------------------------------------------------------
    # Escritura
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

    # -----------------------------------------------------------------------
    # Extracción
    # -----------------------------------------------------------------------

    result = extract_keybind_characters(
        report=report,
        should_stop=should_stop
    )

    # -----------------------------------------------------------------------
    # Cancelación
    # -----------------------------------------------------------------------

    if result is None:
        return

    keybinds, activation_values = result

    if should_stop and should_stop():
        return

    # -----------------------------------------------------------------------
    # Escritura
    # -----------------------------------------------------------------------

    replace_keybinds_only(keybinds)

    # -----------------------------------------------------------------------
    # Resultado
    # -----------------------------------------------------------------------

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
