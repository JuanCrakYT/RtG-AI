from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
JSON_DIR = ROOT / "json"
TOKENS_FILE = ROOT / "tokens.json"
UNKNOWN_FILE = ROOT / "unknown-properties.json"


AUTO_TYPES = (
    "Boolean",
    "Array",
    "Object",
    "String",
    "Number",
)

HUMAN_TYPES = (
    "Number",
    "Integer",
)

ALL_PROPERTY_TYPES = (
    "Number",
    "Integer",
    "Boolean",
    "Array",
    "Object",
    "String",
)

OBSERVED_TYPES = (
    "Boolean",
    "Array",
    "Object",
    "String",
    "Number",
    "NumericInteger",
    "Null",
)


def load_json(path: Path) -> Any:
    """Load a JSON file, including RtG training wrappers with a `content` field."""
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if isinstance(data, dict) and "content" in data:
        content = data["content"]

        if isinstance(content, str):
            return json.loads(content)

        return content

    return data


def save_json(path: Path, data: Any) -> None:
    """Save JSON using stable formatting."""
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as file:
        json.dump(
            data,
            file,
            indent=2,
            ensure_ascii=False,
        )
        file.write("\n")


def add_unique(items: list[str], value: str) -> None:
    """Append a value only if it is not already present."""
    if value not in items:
        items.append(value)


def detect_property_type(value: Any) -> str:
    """
    Detect the observed JSON type.

    Integer JSON values are intentionally returned as `NumericInteger`
    because their semantic meaning must be classified manually as either
    Number or Integer.
    """
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

    raise TypeError(
        f"Unsupported JSON value type: {type(value).__name__}"
    )


def ensure_unknown_structure(data: dict[str, Any]) -> dict[str, Any]:
    """Ensure unknown-properties.json has the expected structure."""
    properties = data.setdefault("Properties", {})

    human = properties.setdefault("Human", {})
    auto = properties.setdefault("Auto", {})

    human.setdefault("Number", [])
    human.setdefault("Integer", [])

    auto.setdefault("Boolean", [])
    auto.setdefault("Array", [])
    auto.setdefault("Object", [])
    auto.setdefault("String", [])
    auto.setdefault("Number", [])

    return data


def load_unknown_properties() -> dict[str, Any]:
    """Load or create the unresolved property database."""
    if UNKNOWN_FILE.exists():
        data = load_json(UNKNOWN_FILE)

        if not isinstance(data, dict):
            raise ValueError(
                "unknown-properties.json must contain a JSON object."
            )

        return ensure_unknown_structure(data)

    return ensure_unknown_structure({})


def register_unknown_property(
    unknown: dict[str, Any],
    property_name: str,
    property_type: str,
) -> None:
    """
    Register an unknown property according to its observed type.

    NumericInteger is intentionally not registered directly because an
    integer JSON value may semantically represent either Number or Integer.
    """
    properties = unknown["Properties"]

    if property_type in HUMAN_TYPES:
        add_unique(
            properties["Human"][property_type],
            property_name,
        )
        return

    if property_type in AUTO_TYPES:
        add_unique(
            properties["Auto"][property_type],
            property_name,
        )
        return

    if property_type == "NumericInteger":
        return

    if property_type == "Null":
        return

    raise ValueError(
        f"Cannot register property '{property_name}' "
        f"with unsupported type '{property_type}'."
    )


def synchronize_properties(
    build: list[Any],
    tokens: dict[str, Any],
    unknown: dict[str, Any],
) -> list[str]:
    """
    Compare properties found in the build against tokens.json.

    Returns unresolved integer properties that require human
    Number/Integer classification.
    """
    names = tokens.setdefault("Names", {})
    properties = names.setdefault("Properties", {})

    for property_type in ALL_PROPERTY_TYPES:
        properties.setdefault(property_type, [])

    unresolved: list[str] = []

    known_properties = {
        property_name
        for property_names in properties.values()
        if isinstance(property_names, list)
        for property_name in property_names
    }

    for block_index, block in enumerate(build, start=1):
        block_properties = block[2]

        # RtG uses [] for blocks without properties.
        if block_properties == []:
            continue

        for property_name, value in block_properties.items():
            if property_name in known_properties:
                continue

            observed_type = detect_property_type(value)

            if observed_type == "NumericInteger":
                # Integer JSON values are ambiguous:
                # 0, 45, 180, 5900000000, etc. may be either
                # semantic Number or semantic Integer.
                register_unknown_property(
                    unknown,
                    property_name,
                    observed_type,
                )

                if property_name not in unresolved:
                    unresolved.append(property_name)

                continue

            if observed_type in AUTO_TYPES:
                register_unknown_property(
                    unknown,
                    property_name,
                    observed_type,
                )
                continue

            # Null does not provide enough information to classify
            # the semantic property type.
            if observed_type == "Null":
                continue

            raise ValueError(
                f"Block {block_index} property '{property_name}' "
                f"has unsupported type '{observed_type}'."
            )

    return unresolved


def extract_build(
    build: Any,
    tokens: dict[str, Any],
    unknown: dict[str, Any],
) -> list[str]:
    """Validate and extract information from one RtG build."""
    if not isinstance(build, list):
        raise ValueError("RtG build must be a JSON array.")

    for block_index, block in enumerate(build, start=1):
        if not isinstance(block, list):
            raise ValueError(
                f"Block {block_index} must be an array."
            )

        if len(block) != 3:
            raise ValueError(
                f"Block {block_index} must contain exactly "
                f"3 elements."
            )

        object_name = block[0]
        connections = block[1]
        block_properties = block[2]

        if not isinstance(object_name, str):
            raise ValueError(
                f"Block {block_index} has an invalid object name."
            )

        if not isinstance(connections, list):
            raise ValueError(
                f"Block {block_index} has invalid connections."
            )

        # RtG represents empty properties as [].
        #
        # A populated property collection is represented as an object.
        if not isinstance(block_properties, (list, dict)):
            raise ValueError(
                f"Block {block_index} has invalid properties."
            )

        if isinstance(block_properties, list):
            if block_properties != []:
                raise ValueError(
                    f"Block {block_index} has invalid properties."
                )

    return synchronize_properties(
        build,
        tokens,
        unknown,
    )


def promote_auto_properties(
    tokens: dict[str, Any],
    unknown: dict[str, Any],
) -> None:
    """Move automatically classified properties into tokens.json."""
    token_properties = tokens["Names"]["Properties"]
    auto_properties = unknown["Properties"]["Auto"]

    for property_type in AUTO_TYPES:
        for property_name in auto_properties[property_type]:
            add_unique(
                token_properties[property_type],
                property_name,
            )


def promote_human_properties(
    tokens: dict[str, Any],
    unknown: dict[str, Any],
) -> None:
    """
    Move manually classified Human properties into tokens.json.
    """
    token_properties = tokens["Names"]["Properties"]
    human_properties = unknown["Properties"]["Human"]

    for property_type in HUMAN_TYPES:
        for property_name in human_properties[property_type]:
            add_unique(
                token_properties[property_type],
                property_name,
            )


def main() -> None:
    if not TOKENS_FILE.exists():
        raise FileNotFoundError(
            f"tokens.json not found: {TOKENS_FILE}"
        )

    with TOKENS_FILE.open("r", encoding="utf-8") as file:
        tokens = json.load(file)

    if not isinstance(tokens, list) or len(tokens) != 1:
        raise ValueError(
            "tokens.json must contain a single root object inside an array."
        )

    tokens = tokens[0]

    if not isinstance(tokens, dict):
        raise ValueError(
            "tokens.json must contain an object as its first element."
        )

    unknown = load_unknown_properties()

    json_files = sorted(JSON_DIR.glob("*.json"))

    if not json_files:
        print(f"No JSON files found in: {JSON_DIR}")
        return

    unresolved_by_file: dict[str, list[str]] = {}

    for json_file in json_files:
        print(f"Scanning: {json_file}")

        build = load_json(json_file)

        unresolved = extract_build(
            build,
            tokens,
            unknown,
        )

        if unresolved:
            unresolved_by_file[json_file.name] = unresolved

    promote_auto_properties(tokens, unknown)
    promote_human_properties(tokens, unknown)

    save_json(TOKENS_FILE, [tokens])
    save_json(UNKNOWN_FILE, unknown)

    print()
    print("Extraction complete.")

    if unresolved_by_file:
        print()
        print("Unresolved numeric properties:")

        for filename, properties in unresolved_by_file.items():
            print(f"  {filename}:")
            for property_name in properties:
                print(f"    - {property_name}")
    else:
        print("No unresolved numeric properties.")


if __name__ == "__main__":
    main()
