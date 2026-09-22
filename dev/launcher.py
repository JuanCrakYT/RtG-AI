"""
dev/launcher.py — punto de entrada del protocolo rtgai://
No contiene lógica del pipeline; solo interpreta la URI y delega a main.py.
"""

import sys
import subprocess
from pathlib import Path
from urllib.parse import urlparse

DEV_DIR = Path(__file__).resolve().parent
MAIN_PY = DEV_DIR / "main.py"

ACTIONS = {
    "run": lambda: subprocess.Popen([sys.executable, str(MAIN_PY)]),
    # futuras acciones: "run-training", "open-logs", etc. — se agregan acá
}


def main():
    if len(sys.argv) < 2:
        return
    uri = sys.argv[1]
    action = urlparse(uri).netloc or urlparse(uri).path.strip("/")
    handler = ACTIONS.get(action)
    if handler:
        handler()


if __name__ == "__main__":
    main()