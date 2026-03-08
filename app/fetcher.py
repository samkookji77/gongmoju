import re
import ssl
from datetime import datetime, timezone
from html import unescape
from urllib.error import URLError
from urllib.request import Request, urlopen

from .config import SOURCE_LIST_URL, SOURCE_SUBS_URL

BASE = "https://www.38.co.kr"


def _read_url(url: str, timeout: int = 15, context=None) -> bytes:
    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; gongmoju-bot/1.0; +https://render.com)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    with urlopen(req, timeout=timeout, context=context) as res:
        return res.read()


def fetch_html(url: str) -> str:
    errors = []

    # 1) Normal TLS verify
    try:
        raw = _read_url(url)
        return raw.decode("euc-kr", errors="replace")
    except Exception as e:
        errors.append(f"https-verified: {e}")

    # 2) TLS without certificate verification (for hosting TLS-compat issues)
    try:
        insecure_ctx = ssl._create_unverified_context()
        raw = _read_url(url, context=insecure_ctx)
        return raw.decode("euc-kr", errors="replace")
    except Exception as e:
        errors.append(f"https-insecure: {e}")

    # 3) Fallback to plain HTTP if HTTPS handshake fails upstream
    try:
        http_url = url.replace("https://", "http://", 1)
        raw = _read_url(http_url)
        return raw.decode("euc-kr", errors="replace")
    except Exception as e:
        errors.append(f"http: {e}")

    raise URLError(" / ".join(errors))


def strip_tags(text: str) -> str:
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def parse_rows(html: str):
    body_match = re.search(r"<tbody>(.*?)</tbody>", html, flags=re.DOTALL | re.IGNORECASE)
    if not body_match:
        return []
    tbody = body_match.group(1)
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", tbody, flags=re.DOTALL | re.IGNORECASE)
    parsed = []
    for row in rows:
        cols = re.findall(r"<td[^>]*>(.*?)</td>", row, flags=re.DOTALL | re.IGNORECASE)
        if cols:
            parsed.append(cols)
    return parsed


def parse_subscription_period(value: str):
    # Example: 2026.03.19~03.20
    value = value.strip().replace(" ", "")
    m = re.match(r"(\d{4})\.(\d{2})\.(\d{2})~(?:(\d{4})\.)?(\d{2})\.(\d{2})", value)
    if not m:
        return None, None
    y1, m1, d1, y2, m2, d2 = m.groups()
    start = f"{y1}-{m1}-{d1}"
    end = f"{(y2 or y1)}-{m2}-{d2}"
    return start, end


def parse_market(company_text: str) -> str:
    return "KOSPI" if "(유가)" in company_text else "KOSDAQ"


def fetch_ipo_data():
    subs_html = fetch_html(SOURCE_SUBS_URL)
    list_html = fetch_html(SOURCE_LIST_URL)
    subscription_rows = parse_rows(subs_html)
    listing_rows = parse_rows(list_html)

    listing_by_no = {}
    for cols in listing_rows:
        if len(cols) < 2:
            continue
        first_col = cols[0]
        no_match = re.search(r"no=(\d+)", first_col)
        if not no_match:
            continue
        no = no_match.group(1)
        company_full = strip_tags(first_col)
        listing_date = strip_tags(cols[1]).replace("/", "-")
        stock_code_match = re.search(r"code=([0-9A-Z]+)", cols[-1])
        listing_by_no[no] = {
            "company": company_full.replace("(유가)", "").strip(),
            "listingDate": listing_date if re.match(r"\d{4}-\d{2}-\d{2}", listing_date) else None,
            "stockCode": stock_code_match.group(1) if stock_code_match else None,
            "market": parse_market(company_full),
        }

    items = []
    for cols in subscription_rows:
        if len(cols) < 7:
            continue
        name_col, schedule_col, fixed_offer, desired_offer, comp_rate, brokers_col, _ = cols[:7]
        no_match = re.search(r"no=(\d+)", name_col)
        if not no_match:
            continue
        no = no_match.group(1)
        company_full = strip_tags(name_col)
        company = company_full.replace("(유가)", "").strip()
        start, end = parse_subscription_period(strip_tags(schedule_col))
        if not start or not end:
            continue
        listing = listing_by_no.get(no, {})
        brokers_text = strip_tags(brokers_col)
        brokers = [b.strip() for b in brokers_text.split(",") if b.strip()]

        items.append(
            {
                "id": no,
                "company": company,
                "market": parse_market(company_full if company_full else listing.get("company", "")),
                "subscriptionStart": start,
                "subscriptionEnd": end,
                "listingDate": listing.get("listingDate"),
                "brokers": brokers,
                "fixedOfferPrice": strip_tags(fixed_offer) or None,
                "desiredOfferPriceRange": strip_tags(desired_offer) or None,
                "competitionRate": strip_tags(comp_rate) or None,
                "stockCode": listing.get("stockCode"),
                "detailUrl": f"{BASE}/html/fund/index.htm?o=v&no={no}",
                "source": "38.co.kr",
            }
        )

    items.sort(key=lambda x: (x["subscriptionStart"], x["company"]))
    return {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "sourcePages": [SOURCE_SUBS_URL, SOURCE_LIST_URL],
        "items": items,
    }
