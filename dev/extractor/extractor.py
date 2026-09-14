from __future__ import annotations

import json
from pathlib import Path
from typing import Any


# ------------------------------------------------------------
# Paths
# ------------------------------------------------------------

EXTRACTOR_DIR = Path(__file__).resolve().parent
DEV_DIR = EXTRACTOR_DIR.parent

JSON_DIR = DEV_DIR / "json"
TOKENS_FILE = DEV_DIR / "tokens.json"
UNKNOWN_PROPERTIES_FILE = DEV_DIR / "unknown-properties.json"


# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------

AUTO_TYPES = (
    "Boolean",
    "Array",
    "Object",
    "String",
)

HUMAN_TYPES = (
    "Number",
    "Integer",
)

ALL_PROPERTY_TYPES = HUMAN_TYPES + AUTO_TYPES

# ------------------------------------------------------------
# JSON helpers
# ------------------------------------------------------------

def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    # Los archivos de entrenamiento pueden contener el build
    # directamente o dentro de un wrapper con "content".
    if isinstance(data, dict) and "content" in data:
        content = data["content"]

        if not isinstance(content, str):
            raise ValueError(
                f"'content' in {path.name} must be a JSON string."
            )

        try:
            return json.loads(content)
        except json.JSONDecodeError as error:
            raise ValueError(
                f"'content' in {path.name} does not contain valid JSON."
            ) from error

    return data


def save_json(path: Path, data: Any) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as file:
        json.dump(
            data,
            file,
            ensure_ascii=False,
            indent=4,
        )
        file.write("\n")


# ------------------------------------------------------------
# Structure validation
# ------------------------------------------------------------

def get_tokens_root(data: Any) -> dict[str, Any]:
    if not isinstance(data, list) or len(data) != 1:
        raise ValueError(
            "tokens.json must contain exactly one root object."
        )

    root = data[0]

    if not isinstance(root, dict):
        raise ValueError(
            "The root element of tokens.json must be an object."
        )

    root.setdefault("Names", {})
    root["Names"].setdefault("Objects", [])
    root["Names"].setdefault("Properties", {})

    properties = root["Names"]["Properties"]

    for property_type in ALL_PROPERTY_TYPES:
        properties.setdefault(property_type, [])

    root.setdefault("Literals", {})
    root["Literals"].setdefault("Boolean", [])
    root["Literals"].setdefault("Null", [])

    root.setdefault("Characters", {})
    root["Characters"].setdefault("hex", [])
    root["Characters"].setdefault("numbers", [])
    root["Characters"].setdefault("symbols", [])
    root["Characters"].setdefault("json", [])

    return root


def get_unknown_root(data: Any) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise ValueError(
            "unknown-properties.json must contain an object."
        )

    properties = data.setdefault("Properties", {})

    human = properties.setdefault("Human", {})
    auto = properties.setdefault("Auto", {})

    for property_type in HUMAN_TYPES:
        human.setdefault(property_type, [])

    for property_type in AUTO_TYPES:
        auto.setdefault(property_type, [])

    return data


# ------------------------------------------------------------
# List helpers
# ------------------------------------------------------------

def add_unique(values: list[str], value: str) -> bool:
    if value in values:
        return False

    values.append(value)
    return True


def sort_unique(values: list[str]) -> None:
    values[:] = sorted(set(values))


# ------------------------------------------------------------
# Property detection
# ------------------------------------------------------------

def detect_property_type(value: Any) -> str:
    if isinstance(value, bool):
        return "Boolean"

    if isinstance(value, list):
        return "Array"

    if isinstance(value, dict):
        return "Object"

    if isinstance(value, str):
        return "String"

    if isinstance(value, int):
        return "NumericInteger"

    if isinstance(value, float):
        return "Number"

    if value is None:
        return "Null"

    raise ValueError(
        f"Unsupported JSON value type: {type(value).__name__}"
    )

# ------------------------------------------------------------
# Build extraction
# ------------------------------------------------------------

def extract_build(
    build: Any,
    objects: set[str],
    properties: dict[str, set[str]],
    literals: dict[str, set[str]],
    characters: dict[str, set[str]],
) -> None:
    """
    Extract semantic RtG data from:

        [TipoDelBloque, Conexiones, Propiedades]

    Only the object name and properties are interpreted semantically.
    Connections are deliberately ignored because their contents are
    structural build data rather than tokenizer property definitions.
    """

    if not isinstance(build, list):
        raise ValueError(
            "RtG build must be a JSON array."
        )

    for block_index, block in enumerate(build, start=1):
        if not isinstance(block, list):
            raise ValueError(
                f"Block {block_index} must be an array."
            )

        if len(block) != 3:
            raise ValueError(
                f"Block {block_index} must contain exactly "
                "3 elements: [Type, Connections, Properties]."
            )

        object_name = block[0]
        connections = block[1]
        block_properties = block[2]

        if not isinstance(object_name, str):
            raise ValueError(
                f"Block {block_index} has an invalid object type."
            )

        if not isinstance(connections, list):
            raise ValueError(
                f"Block {block_index} has invalid connections."
            )

        if not isinstance(block_properties, dict):
            raise ValueError(
                f"Block {block_index} has invalid properties."
            )

        objects.add(object_name)

        for property_name, value in block_properties.items():
            if not isinstance(property_name, str):
                raise ValueError(
                    f"Block {block_index} contains a non-string property name."
                )

            property_type = detect_property_type(value)

            properties.setdefault(
                property_name,
                set(),
            ).add(property_type)

            collect_literals(
                value,
                literals,
            )

            collect_characters(
                property_name,
                characters,
            )

            collect_value_characters(
                value,
                characters,
            )


# ------------------------------------------------------------
# Literals
# ------------------------------------------------------------

def collect_literals(
    value: Any,
    literals: dict[str, set[str]],
) -> None:
    if value is True:
        literals["Boolean"].add("true")
        return

    if value is False:
        literals["Boolean"].add("false")
        return

    if value is None:
        literals["Null"].add("null")
        return

    if isinstance(value, list):
        for item in value:
            collect_literals(item, literals)

    elif isinstance(value, dict):
        for item in value.values():
            collect_literals(item, literals)


# ------------------------------------------------------------
# Character extraction
# ------------------------------------------------------------

def collect_characters(
    text: str,
    characters: dict[str, set[str]],
) -> None:
    for character in text:
        if character in "abcdefABCDEF":
            characters["hex"].add(character)

        if character.isdigit():
            characters["numbers"].add(character)

        if character in "-.":
            characters["symbols"].add(character)


def collect_value_characters(
    value: Any,
    characters: dict[str, set[str]],
) -> None:
    if isinstance(value, str):
        collect_characters(value, characters)

    elif isinstance(value, list):
        for item in value:
            collect_value_characters(item, characters)

    elif isinstance(value, dict):
        for key, item in value.items():
            collect_characters(key, characters)
            collect_value_characters(item, characters)


# ------------------------------------------------------------
# Training data
# ------------------------------------------------------------

def scan_training_data() -> tuple[
    set[str],
    dict[str, set[str]],
    dict[str, set[str]],
    dict[str, set[str]],
]:
    objects: set[str] = set()

    properties: dict[str, set[str]] = {}

    literals = {
        "Boolean": set(),
        "Null": set(),
    }

    characters = {
        "hex": set(),
        "numbers": set(),
        "symbols": set(),
        "json": set('"{}[]:,'),
    }

    json_files = sorted(
        path
        for path in JSON_DIR.rglob("*.json")
        if path.is_file()
    )

    for json_file in json_files:
        data = load_json(json_file)

        extract_build(
            data,
            objects,
            properties,
            literals,
            characters,
        )

    return (
        objects,
        properties,
        literals,
        characters,
    )


# ------------------------------------------------------------
# Existing token lookup
# ------------------------------------------------------------

def find_existing_property_type(
    property_name: str,
    tokens: dict[str, Any],
) -> str | None:
    properties = tokens["Names"]["Properties"]

    matches = [
        property_type
        for property_type in ALL_PROPERTY_TYPES
        if property_name in properties[property_type]
    ]

    if len(matches) > 1:
        raise ValueError(
            f"Property '{property_name}' exists in multiple "
            f"token categories: {', '.join(matches)}"
        )

    return matches[0] if matches else None


# ------------------------------------------------------------
# Unknown property handling
# ------------------------------------------------------------

def get_human_classification(
    property_name: str,
    unknown: dict[str, Any],
) -> str | None:
    human = unknown["Properties"]["Human"]

    for property_type in HUMAN_TYPES:
        if property_name in human[property_type]:
            return property_type

    return None


def register_unknown_property(
    property_name: str,
    property_type: str,
    unknown: dict[str, Any],
) -> None:
    """
    Put an unresolved property into unknown-properties.json.

    Auto properties are classified immediately and therefore can later
    be promoted into tokens.json.

    Human numeric properties remain unresolved until the user places
    them in Human.Number or Human.Integer.
    """

    if property_type in AUTO_TYPES:
        unknown["Properties"]["Auto"][property_type].append(
            property_name
        )
        return

    raise ValueError(
        f"Cannot automatically classify human property "
        f"'{property_name}' as {property_type}."
    )


# ------------------------------------------------------------
# Token promotion
# ------------------------------------------------------------

def promote_auto_properties(
    tokens: dict[str, Any],
    unknown: dict[str, Any],
) -> list[str]:
    """
    Copy every property classified under Auto in
    unknown-properties.json into tokens.json.
    """

    properties = tokens["Names"]["Properties"]
    auto = unknown["Properties"]["Auto"]

    promoted: list[str] = []

    for property_type in AUTO_TYPES:
        for property_name in auto[property_type]:
            existing_type = find_existing_property_type(
                property_name,
                tokens,
            )

            if existing_type is None:
                add_unique(
                    properties[property_type],
                    property_name,
                )
                promoted.append(property_name)

            elif existing_type != property_type:
                raise ValueError(
                    f"Property '{property_name}' is classified as "
                    f"{property_type} in unknown-properties.json but "
                    f"already exists as {existing_type} in tokens.json."
                )

    return promoted


def promote_human_properties(
    tokens: dict[str, Any],
    unknown: dict[str, Any],
) -> list[str]:
    """
    Copy manually classified Number/Integer properties into tokens.json.
    """

    properties = tokens["Names"]["Properties"]
    human = unknown["Properties"]["Human"]

    promoted: list[str] = []

    for property_type in HUMAN_TYPES:
        for property_name in human[property_type]:
            existing_type = find_existing_property_type(
                property_name,
                tokens,
            )

            if existing_type is None:
                add_unique(
                    properties[property_type],
                    property_name,
                )
                promoted.append(property_name)

            elif existing_type != property_type:
                raise ValueError(
                    f"Property '{property_name}' is classified as "
                    f"{property_type} in unknown-properties.json but "
                    f"already exists as {existing_type} in tokens.json."
                )

    return promoted


# ------------------------------------------------------------
# Synchronization
# ------------------------------------------------------------

def synchronize_properties(
    discovered_properties: dict[str, set[str]],
    tokens: dict[str, Any],
    unknown: dict[str, Any],
) -> tuple[list[str], list[str]]:
    """
    Synchronize discovered properties with unknown-properties.json.

    New automatic properties are first registered in Auto.

    Human numeric properties are never guessed. If the user has already
    classified them in Human.Number or Human.Integer, that classification
    is respected.
    """

    discovered = []
    unresolved_numeric = []

    for property_name in sorted(discovered_properties):
        observed_types = discovered_properties[property_name]

        if len(observed_types) != 1:
            raise ValueError(
                f"Property '{property_name}' was observed with "
                f"multiple types: {', '.join(sorted(observed_types))}"
            )

        observed_type = next(iter(observed_types))

        existing_type = find_existing_property_type(
            property_name,
            tokens,
        )

        if existing_type is not None:
            continue

        human_type = get_human_classification(
            property_name,
            unknown,
        )

        if human_type is not None:
            if human_type != observed_type:
                raise ValueError(
                    f"Property '{property_name}' is classified as "
                    f"{human_type}, but the training data contains "
                    f"{observed_type}."
                )

            continue

        if observed_type in AUTO_TYPES:
            auto_values = unknown["Properties"]["Auto"][observed_type]
        
            if property_name not in auto_values:
                auto_values.append(property_name)
                discovered.append(property_name)
        
        elif observed_type == "Number":
            auto_values = unknown["Properties"]["Auto"]["Number"]
        
            if property_name not in auto_values:
                auto_values.append(property_name)
                discovered.append(property_name)
        
        elif observed_type == "NumericInteger":
            unresolved_numeric.append(property_name)     
        
            return discovered, unresolved_numeric


# ------------------------------------------------------------
# Validation
# ------------------------------------------------------------

def validate_no_duplicate_properties(
    tokens: dict[str, Any],
    unknown: dict[str, Any],
) -> None:
    locations: dict[str, list[str]] = {}

    for property_type in ALL_PROPERTY_TYPES:
        for property_name in tokens["Names"]["Properties"][property_type]:
            locations.setdefault(
                property_name,
                [],
            ).append(f"tokens.{property_type}")

    for property_type in HUMAN_TYPES:
        for property_name in unknown["Properties"]["Human"][property_type]:
            locations.setdefault(
                property_name,
                [],
            ).append(f"unknown.Human.{property_type}")

    for property_type in AUTO_TYPES:
        for property_name in unknown["Properties"]["Auto"][property_type]:
            locations.setdefault(
                property_name,
                [],
            ).append(f"unknown.Auto.{property_type}")

    duplicates = {
        name: locations_list
        for name, locations_list in locations.items()
        if len(locations_list) > 1
    }

    for property_name, locations_list in duplicates.items():
        # A property existing in unknown-properties.json and tokens.json
        # is expected after promotion, so only reject conflicting
        # classifications.
        token_locations = [
            location
            for location in locations_list
            if location.startswith("tokens.")
        ]

        unknown_locations = [
            location
            for location in locations_list
            if location.startswith("unknown.")
        ]

        if len(token_locations) > 1:
            raise ValueError(
                f"Property '{property_name}' exists in multiple "
                f"tokens.json categories: {', '.join(token_locations)}"
            )

        if len(unknown_locations) > 1:
            raise ValueError(
                f"Property '{property_name}' exists in multiple "
                f"unknown-properties.json categories: "
                f"{', '.join(unknown_locations)}"
            )


def sort_all(data: dict[str, Any]) -> None:
    properties = data["Names"]["Properties"]

    for values in properties.values():
        sort_unique(values)

    sort_unique(data["Names"]["Objects"])

    for values in data["Literals"].values():
        sort_unique(values)

    for values in data["Characters"].values():
        sort_unique(values)


def sort_unknown(data: dict[str, Any]) -> None:
    properties = data["Properties"]

    for group in ("Human", "Auto"):
        for values in properties[group].values():
            sort_unique(values)


# ------------------------------------------------------------
# Main
# ------------------------------------------------------------

def main() -> None:
    if not JSON_DIR.is_dir():
        raise FileNotFoundError(
            f"Training directory not found: {JSON_DIR}"
        )

    if not TOKENS_FILE.is_file():
        raise FileNotFoundError(
            f"tokens.json not found: {TOKENS_FILE}"
        )

    if not UNKNOWN_PROPERTIES_FILE.is_file():
        raise FileNotFoundError(
            "unknown-properties.json not found: "
            f"{UNKNOWN_PROPERTIES_FILE}"
        )

    tokens_file = load_json(TOKENS_FILE)
    unknown_file = load_json(UNKNOWN_PROPERTIES_FILE)

    tokens = get_tokens_root(tokens_file)
    unknown = get_unknown_root(unknown_file)

    (
        discovered_objects,
        discovered_properties,
        discovered_literals,
        discovered_characters,
    ) = scan_training_data()

    # --------------------------------------------------------
    # Objects
    # --------------------------------------------------------

    for object_name in discovered_objects:
        add_unique(
            tokens["Names"]["Objects"],
            object_name,
        )

    # --------------------------------------------------------
    # Properties
    # --------------------------------------------------------

    new_auto, unresolved_numeric = synchronize_properties(
        discovered_properties,
        tokens,
        unknown,
    )

    # Auto classifications are now promoted into tokens.json.
    promoted_auto = promote_auto_properties(
        tokens,
        unknown,
    )

    # Human classifications are also promoted once the user has
    # explicitly classified them.
    promoted_human = promote_human_properties(
        tokens,
        unknown,
    )

    # --------------------------------------------------------
    # Literals
    # --------------------------------------------------------

    for literal_type, values in discovered_literals.items():
        for value in values:
            add_unique(
                tokens["Literals"][literal_type],
                value,
            )

    # --------------------------------------------------------
    # Characters
    # --------------------------------------------------------

    for category, values in discovered_characters.items():
        for value in values:
            add_unique(
                tokens["Characters"][category],
                value,
            )

    # --------------------------------------------------------
    # Final validation + deterministic formatting
    # --------------------------------------------------------

    sort_all(tokens_file)
    sort_unknown(unknown_file)

    validate_no_duplicate_properties(
        tokens,
        unknown,
    )

    save_json(
        TOKENS_FILE,
        tokens_file,
    )

    save_json(
        UNKNOWN_PROPERTIES_FILE,
        unknown_file,
    )

    # --------------------------------------------------------
    # Report
    # --------------------------------------------------------

    print("Extraction completed.")
    print()

    print(f"Training directory: {JSON_DIR}")
    print(f"Discovered objects: {len(discovered_objects)}")
    print(f"Discovered properties: {len(discovered_properties)}")
    print(f"New Auto properties: {len(new_auto)}")
    print(f"Promoted Auto properties: {len(promoted_auto)}")
    print(f"Promoted Human properties: {len(promoted_human)}")
    print(f"Unresolved numeric properties: {len(unresolved_numeric)}")

    if unresolved_numeric:
        print()
        print("Numeric properties requiring human classification:")

        for property_name in unresolved_numeric:
            print(f"  ? {property_name}")


if __name__ == "__main__":
    main()
