"""Contract tests: every schema is itself valid JSON Schema; artifacts (once built) validate; no forbidden dash characters."""
import json
import subprocess

import pytest
from jsonschema import Draft202012Validator

from pipelines.common import CONTRACTS, PUBLIC, ROOT
from pipelines.validate_artifacts import run as validate_all


def test_schemas_are_valid_and_complete():
    files = sorted(CONTRACTS.glob("*.schema.json"))
    assert len(files) == 17
    for f in files:
        Draft202012Validator.check_schema(json.loads(f.read_text()))


@pytest.mark.slow
def test_artifacts_validate():
    assert validate_all() == []


@pytest.mark.slow
def test_no_dash_in_decoded_json_strings():
    """json.dumps escapes non-ASCII, so scan decoded strings as well as raw text."""
    def walk(o):
        if isinstance(o, str):
            yield o
        elif isinstance(o, dict):
            for k, v in o.items():
                yield from walk(k)
                yield from walk(v)
        elif isinstance(o, list):
            for v in o:
                yield from walk(v)
    for f in list(PUBLIC.glob("*.json")) + list((ROOT / "data").rglob("*.json")):
        if "raw" in f.parts:
            continue
        for sv in walk(json.loads(f.read_text())):
            assert chr(0x2014) not in sv and chr(0x2015) not in sv, f.name


def test_no_em_or_en_dash_in_tracked_or_new_files():
    bad = []
    files = subprocess.run(["git", "ls-files", "-co", "--exclude-standard"], cwd=ROOT, capture_output=True, text=True).stdout.split()
    for f in files:
        p = ROOT / f
        if p.suffix in {".md", ".py", ".json", ".toml", ".ini", ".txt", ".yml"} and p.is_file():
            t = p.read_text(errors="ignore")
            if chr(0x2014) in t or chr(0x2015) in t:
                bad.append(f)
    assert bad == []
