"""End-to-end: fetch (cached) -> clean -> publish artifacts -> validate. `uv run python -m pipelines.run_all`"""
import sys
import time

from pipelines import contracts, publish, validate_artifacts
from pipelines.cleaning import clean
from pipelines.ingestion import fetch

if __name__ == "__main__":
    t = time.time()
    contracts.run()
    fetch.run()
    clean.clean()
    sizes = publish.run()
    errs = validate_artifacts.run()
    print("\n".join(errs) or "all artifacts valid", f"| max gzip {max(sizes.values()) / 1024:.0f} KB | {time.time() - t:.0f}s")
    sys.exit(1 if errs else 0)
