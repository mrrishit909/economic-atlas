import json

import pytest

from pipelines.common import LEDGER, PUBLIC


@pytest.fixture(scope="session")
def art():
    cache = {}

    def get(name):
        if name not in cache:
            cache[name] = json.loads((PUBLIC / f"{name}.json").read_text())
        return cache[name]
    return get


@pytest.fixture(scope="session")
def ledger():
    return json.loads(LEDGER.read_text())


@pytest.fixture(scope="session")
def panel():
    from analytics.data import load
    return load()
