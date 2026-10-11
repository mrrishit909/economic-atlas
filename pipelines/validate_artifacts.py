"""Validate every published artifact against data/contracts/*.schema.json. Exit non-zero on any failure."""
from __future__ import annotations

import json
import sys

from jsonschema import Draft202012Validator

from pipelines.common import CONTRACTS, PUBLIC


def run() -> list[str]:
    errs = []
    for sc in sorted(CONTRACTS.glob("*.schema.json")):
        name = sc.name.removesuffix(".schema.json")
        if name == "seedhead":  # one schema, many files
            fs = sorted((PUBLIC / "seedhead").glob("*.json"))
            if not fs:
                errs.append("seedhead: no files")
            v = Draft202012Validator(json.loads(sc.read_text()))
            for f in fs:
                for e in list(v.iter_errors(json.loads(f.read_text())))[:3]:
                    errs.append(f"seedhead/{f.name}: {'/'.join(map(str, e.absolute_path))[:80]}: {e.message[:160]}")
            continue
        f = PUBLIC / f"{name}.json"
        if not f.exists():
            errs.append(f"{name}: artifact missing")
            continue
        v = Draft202012Validator(json.loads(sc.read_text()))
        for e in list(v.iter_errors(json.loads(f.read_text())))[:5]:
            errs.append(f"{name}: {'/'.join(map(str, e.absolute_path))[:80]}: {e.message[:160]}")
    return errs


if __name__ == "__main__":
    e = run()
    print("\n".join(e) or "all artifacts valid")
    sys.exit(1 if e else 0)
