"""Fetch World Bank WDI (API, CC BY 4.0) and one OWID long-run series. Idempotent: cached responses under data/raw.

Polite: sequential requests, retries with exponential backoff, a small pause between calls. The WB API signals
errors as HTTP 200 with body [{"message":[...]}], handled in `wb_get`. IMF is never contacted (no permission).
Writes data/manifests/raw_manifest.json (sha256, bytes, retrieved_at, lastupdated per file).
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import sys
import time

import requests

from pipelines.common import MANIFESTS, OWID_SLUG, RAW, WB, WDI, YEAR_FIRST, write_json

UA = {"User-Agent": "economic-atlas-research/1.0 (portfolio project; contact via GitHub mrrishit909)"}


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get(url: str, tries: int = 5) -> requests.Response:
    for i in range(tries):
        try:
            r = requests.get(url, headers=UA, timeout=90)
            if r.status_code == 200:
                return r
            print(f"  HTTP {r.status_code} {url}", file=sys.stderr)
        except requests.RequestException as e:
            print(f"  {type(e).__name__} {url}", file=sys.stderr)
        time.sleep(2 ** i)
    raise RuntimeError(f"giving up on {url}")


def wb_get(path: str, **q) -> tuple[dict, list, bytes]:
    """All pages of a WB v2 call, merged. Returns (header of page 1, rows, raw bytes of page 1 for hashing)."""
    q = {"format": "json", "per_page": 20000, **q}
    rows, hdr, raw1, page = [], None, b"", 1
    while True:
        url = f"{WB}/{path}?" + "&".join(f"{k}={v}" for k, v in {**q, "page": page}.items())
        r = get(url)
        j = r.json()
        if len(j) == 1 and isinstance(j[0], dict) and "message" in j[0]:
            raise RuntimeError(f"WB error body for {url}: {j[0]['message']}")
        hdr = hdr or j[0]
        raw1 = raw1 or r.content
        rows += j[1] or []
        if page >= int(j[0]["pages"]):
            return hdr, rows, raw1
        page += 1
        time.sleep(0.5)


def run() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    (RAW / "wdi").mkdir(exist_ok=True)
    (RAW / "owid").mkdir(exist_ok=True)
    mf = {"retrieved_at": now(), "files": [], "failures": []}

    def record(path, **extra):
        b = path.read_bytes()
        mf["files"].append({"path": str(path.relative_to(RAW.parent.parent)), "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest(), **extra})

    # countries (aggregates flagged by region.value == "Aggregates")
    f = RAW / "wdi" / "countries.json"
    if not f.exists():
        h, rows, _ = wb_get("country")
        f.write_text(json.dumps({"header": h, "rows": rows}))
    record(f, kind="country_list", retrieved_at=mf["retrieved_at"])
    for ind, (code, *_rest) in WDI.items():
        fm, fd = RAW / "wdi" / f"{code}.meta.json", RAW / "wdi" / f"{code}.data.json"
        try:
            if not fm.exists():
                h, rows, _ = wb_get(f"indicator/{code}")
                fm.write_text(json.dumps(rows[0]))
                time.sleep(0.4)
            if not fd.exists():
                h, rows, _ = wb_get(f"country/all/indicator/{code}", date=f"{YEAR_FIRST}:2025")
                fd.write_text(json.dumps({"header": h, "retrieved_at": now(), "rows": rows}))
                time.sleep(0.6)
            hd = json.loads(fd.read_text())
            record(fm, kind="indicator_meta", indicator=ind, code=code)
            record(fd, kind="indicator_data", indicator=ind, code=code, lastupdated=hd["header"].get("lastupdated"),
                   retrieved_at=hd["retrieved_at"], total_rows=int(hd["header"]["total"]))
        except Exception as e:  # recorded, never hidden
            mf["failures"].append({"indicator": ind, "code": code, "error": str(e)[:300]})
    # OWID Maddison (long-run), data + metadata
    for suffix, name in (("csv?v=1&csvType=full&useColumnShortNames=true", "data.csv"), ("metadata.json?v=1&csvType=full&useColumnShortNames=true", "metadata.json")):
        f = RAW / "owid" / f"{OWID_SLUG}.{name}"
        try:
            if not f.exists():
                r = get(f"https://ourworldindata.org/grapher/{OWID_SLUG}.{suffix}")
                f.write_bytes(r.content)
            record(f, kind="owid", retrieved_at=now())
        except Exception as e:
            mf["failures"].append({"owid": name, "error": str(e)[:300]})
    f = RAW / "owid" / "maddison-indicator-900793.metadata.json"  # carries the per-series origin and licence
    try:
        if not f.exists():
            f.write_bytes(get("https://api.ourworldindata.org/v1/indicators/900793.metadata.json").content)
        record(f, kind="owid_full_metadata", retrieved_at=now())
    except Exception as e:
        mf["failures"].append({"owid": "full_metadata", "error": str(e)[:300]})
    write_json(MANIFESTS / "raw_manifest.json", mf, compact=False)
    print(f"{len(mf['files'])} files, {len(mf['failures'])} failures")


if __name__ == "__main__":
    run()
