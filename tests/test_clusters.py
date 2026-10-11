import numpy as np
import pytest

from analytics import clustering as cl

pytestmark = pytest.mark.slow


def test_kmeans_reproducible(panel):
    _, Z, *_ = cl.feature_matrix(panel)
    a, b = cl.km(Z, 3).labels_, cl.km(Z, 3).labels_
    assert (a == b).all()


def test_published_cluster_properties(art, panel):
    c = art("clusters")
    k = c["chosen_k"]
    assert 3 <= k <= 6
    sil = next(s["silhouette"] for s in c["k_scan"] if s["k"] == k)
    assert -1 < sil < 1
    assert len(c["assignments"]["iso3"]) == c["inclusion"]["complete_cases"] == sum(x["size"] for x in c["clusters"])
    assert [s["k"] for s in c["k_scan"]] == list(range(2, 9))
    assert c["stability"]["seed_ari_mean"] >= 0.8 or "stability caveat" in c["choice_rule"]
    assert len(c["hierarchical"]["labels"]) == len(c["assignments"]["iso3"])
    # complete-case only: every excluded country is missing >=1 feature, none imputed
    assert all(e["missing"] for e in c["inclusion"]["excluded"])
    # ids ordered by centroid income
    inc = [x["centroid"]["ln_gdppc_ppp"] for x in c["clusters"]]
    assert inc == sorted(inc)


def test_seed_stability_helper(panel):
    _, Z, *_ = cl.feature_matrix(panel)
    m, mn = cl.seed_stability(Z, 3, n=4)
    assert 0.0 <= mn <= m <= 1.0


def test_standardization(panel):
    _, Z, *_ = cl.feature_matrix(panel)
    assert np.allclose(Z.mean(0), 0, atol=1e-9) and np.allclose(Z.std(0), 1, atol=1e-9)
