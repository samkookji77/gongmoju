import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

from .config import DB_FILE


@contextmanager
def connect():
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS ipo_items (
              id TEXT PRIMARY KEY,
              company TEXT NOT NULL,
              market TEXT NOT NULL,
              subscription_start TEXT NOT NULL,
              subscription_end TEXT NOT NULL,
              listing_date TEXT,
              brokers_json TEXT,
              fixed_offer_price TEXT,
              desired_offer_price_range TEXT,
              competition_rate TEXT,
              stock_code TEXT,
              detail_url TEXT,
              source TEXT
            );

            CREATE TABLE IF NOT EXISTS meta (
              key TEXT PRIMARY KEY,
              value TEXT
            );
            """
        )
        conn.commit()


def replace_all_items(payload: dict):
    items = payload.get("items", [])
    with connect() as conn:
        conn.execute("DELETE FROM ipo_items")
        for item in items:
            conn.execute(
                """
                INSERT INTO ipo_items (
                  id, company, market, subscription_start, subscription_end, listing_date,
                  brokers_json, fixed_offer_price, desired_offer_price_range, competition_rate,
                  stock_code, detail_url, source
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item.get("id"),
                    item.get("company"),
                    item.get("market"),
                    item.get("subscriptionStart"),
                    item.get("subscriptionEnd"),
                    item.get("listingDate"),
                    json.dumps(item.get("brokers", []), ensure_ascii=False),
                    item.get("fixedOfferPrice"),
                    item.get("desiredOfferPriceRange"),
                    item.get("competitionRate"),
                    item.get("stockCode"),
                    item.get("detailUrl"),
                    item.get("source"),
                ),
            )

        conn.execute(
            "INSERT OR REPLACE INTO meta(key, value) VALUES('updatedAt', ?)",
            (payload.get("updatedAt"),),
        )
        conn.execute(
            "INSERT OR REPLACE INTO meta(key, value) VALUES('sourcePages', ?)",
            (json.dumps(payload.get("sourcePages", []), ensure_ascii=False),),
        )
        conn.commit()


def load_all_items(market: Optional[str] = None):
    with connect() as conn:
        if market and market in ("KOSPI", "KOSDAQ"):
            rows = conn.execute(
                "SELECT * FROM ipo_items WHERE market = ? ORDER BY subscription_start, company",
                (market,),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM ipo_items ORDER BY subscription_start, company").fetchall()
        return [row_to_item(r) for r in rows]


def load_meta():
    with connect() as conn:
        rows = conn.execute("SELECT key, value FROM meta").fetchall()
    meta = {r["key"]: r["value"] for r in rows}
    source_pages = []
    if meta.get("sourcePages"):
        try:
            source_pages = json.loads(meta["sourcePages"])
        except json.JSONDecodeError:
            source_pages = []
    return {
        "updatedAt": meta.get("updatedAt"),
        "sourcePages": source_pages,
    }


def row_to_item(r: sqlite3.Row):
    brokers = []
    if r["brokers_json"]:
        try:
            brokers = json.loads(r["brokers_json"])
        except json.JSONDecodeError:
            brokers = []
    return {
        "id": r["id"],
        "company": r["company"],
        "market": r["market"],
        "subscriptionStart": r["subscription_start"],
        "subscriptionEnd": r["subscription_end"],
        "listingDate": r["listing_date"],
        "brokers": brokers,
        "fixedOfferPrice": r["fixed_offer_price"],
        "desiredOfferPriceRange": r["desired_offer_price_range"],
        "competitionRate": r["competition_rate"],
        "stockCode": r["stock_code"],
        "detailUrl": r["detail_url"],
        "source": r["source"],
    }


def db_exists() -> bool:
    return Path(DB_FILE).exists()
