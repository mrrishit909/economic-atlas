"""Type-level separation of money bases. PPP, constant-USD and current-USD GDP per capita are different quantities.

`assert_same_basis` is the single entry point for every level comparison, ranking, regression input and cluster feature set.
Non-money series (rates, shares, counts) have price_basis None and never trigger it.
"""
from __future__ import annotations

from pipelines.common import WDI

BASIS: dict[str, str | None] = {k: v[4] for k, v in WDI.items()}
BASIS["hhi5"] = None
BASIS["gdppc_maddison"] = "maddison_intl_2011"


class MixedBasisError(ValueError):
    """Raised when a comparison would mix PPP, constant-USD, current-USD or Maddison dollars."""


def basis_of(indicator: str) -> str | None:
    return BASIS[indicator]


def assert_same_basis(*indicators: str) -> str | None:
    """Return the single money basis shared by the given indicator ids (None if none is money). Raise MixedBasisError otherwise."""
    bases = {BASIS[i] for i in indicators if BASIS[i] is not None}
    if len(bases) > 1:
        raise MixedBasisError(f"cannot compare {sorted(indicators)}: money bases differ {sorted(bases)}")
    return next(iter(bases), None)
