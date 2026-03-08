import json

from .config import DATA_FILE
from .db import init_db, load_all_items, load_meta, replace_all_items
from .fetcher import fetch_ipo_data


def ensure_bootstrap():
    init_db()
    meta = load_meta()
    has_data = bool(load_all_items())
    if has_data and meta.get("updatedAt"):
        return
    if DATA_FILE.exists():
        try:
            payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))
            replace_all_items(payload)
            return
        except Exception:
            pass
    payload = fetch_ipo_data()
    persist_payload(payload)


def persist_payload(payload: dict):
    init_db()
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    replace_all_items(payload)


def refresh_from_source():
    payload = fetch_ipo_data()
    persist_payload(payload)
    return payload
