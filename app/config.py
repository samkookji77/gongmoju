import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.getenv("IPO_DATA_DIR", str(ROOT_DIR / "data")))
DATA_FILE = DATA_DIR / "ipos.json"
DB_FILE = DATA_DIR / "ipo.db"

SOURCE_SUBS_URL = "https://www.38.co.kr/html/fund/index.htm?o=k"
SOURCE_LIST_URL = "https://www.38.co.kr/html/fund/index.htm?o=nw"
