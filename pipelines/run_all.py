"""End-to-end: fetch (cached) -> clean -> publish artifacts -> validate. `uv run python -m pipelines.run_all`"""
import sys
import time

from pipelines import contracts, publish, seedhead, validate_artifacts
from pipelines.cleaning import clean
from pipelines.ingestion import fetch

if __name__ == "__main__":
    t = time.time()
    contracts.run()
    fetch.run()
    clean.clean()
    sizes = publish.run()
    sh_sizes = seedhead.run()
    errs = validate_artifacts.run()
    print("\n".join(errs) or "all artifacts valid", f"| seedhead gzip {sum(v for k, v in sh_sizes.items() if k != 'gdppc_ppp_latest.json') / 1024:.0f} KB | max gzip {max(sizes.values()) / 1024:.0f} KB | {time.time() - t:.0f}s")
    sys.exit(1 if errs else 0)
