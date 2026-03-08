#!/usr/bin/env python3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.service import refresh_from_source  # noqa: E402


def main():
    payload = refresh_from_source()
    print(f"Wrote {len(payload.get('items', []))} items")


if __name__ == "__main__":
    main()
