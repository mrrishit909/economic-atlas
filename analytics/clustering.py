"""k-means and Ward hierarchical clustering on standardized country features (complete cases only, no imputation)."""
from __future__ import annotations

import itertools

import numpy as np
from scipy.optimize import linear_sum_assignment
from scipy.cluster.hierarchy import cophenet, dendrogram, fcluster, linkage
from scipy.spatial.distance import pdist
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score, silhouette_samples, silhouette_score

from analytics.data import Panel
from analytics.units import assert_same_basis, basis_of

LEVEL_WIN, GROWTH_WIN, MIN_OBS = (2015, 2023), (2010, 2023), 5
SEED = 20261010
# id, label, transform, source indicator
FEATURES = [
    ("ln_gdppc_ppp", "Income level", "mean of ln(GDP per capita, PPP) over the level window", "gdppc_ppp"),
    ("growth", "Growth", "mean annual real GDP growth over the growth window", "gdp_growth"),
    ("agr_share", "Agriculture share", "mean agriculture value added, % of GDP", "agr_share"),
    ("ind_share", "Industry share", "mean industry value added, % of GDP", "ind_share"),
    ("ln_trade", "Trade openness", "mean of ln(trade % of GDP)", "trade_open"),
    ("infl_asinh", "Inflation", "asinh of the median CPI inflation (%) over the growth window", "inflation"),
]


def _mean(M, f=lambda v: v, min_obs=MIN_OBS):
    ok = np.isfinite(M)
    with np.errstate(all="ignore"):
        v = np.where(ok, f(np.where(ok, M, 1.0)), 0.0)
        m = v.sum(1) / np.maximum(ok.sum(1), 1)
    return np.where(ok.sum(1) >= min_obs, m, np.nan)


def raw_features(p: Panel) -> dict[str, np.ndarray]:
    assert_same_basis(*[f[3] for f in FEATURES])  # one money basis only (PPP 2021)
    L, G = LEVEL_WIN, GROWTH_WIN
    out = {}
    out["ln_gdppc_ppp"] = _mean(p.window("gdppc_ppp", *L), np.log)
    out["growth"] = _mean(p.window("gdp_growth", *G))
    out["agr_share"] = _mean(p.window("agr_share", *L))
    out["ind_share"] = _mean(p.window("ind_share", *L))
    out["ln_trade"] = _mean(p.window("trade_open", *L), lambda v: np.log(np.maximum(v, 0.1)))
    M = p.window("inflation", *G)
    med = np.array([np.median(r[np.isfinite(r)]) if np.isfinite(r).sum() >= MIN_OBS else np.nan for r in M])
    out["infl_asinh"] = np.arcsinh(med)
    return out


def feature_matrix(p: Panel):
    raw = raw_features(p)
    ids = [f[0] for f in FEATURES]
    X = np.column_stack([raw[i] for i in ids])
    ok = np.isfinite(X).all(1)
    excl = [dict(iso3=c, missing=[i for i, v in zip(ids, X[k]) if not np.isfinite(v)]) for k, c in enumerate(p.iso3) if not ok[k]]
    mu, sd = X[ok].mean(0), X[ok].std(0)
    return X[ok], (X[ok] - mu) / sd, ok, mu, sd, excl


def km(Z, k, seed=SEED, n_init=10):
    m = KMeans(n_clusters=k, n_init=n_init, random_state=seed).fit(Z)
    return m


def relabel(labels, centers_income_col):
    """Stable ids: order clusters by centroid income (column 0) ascending."""
    order = np.argsort(centers_income_col)
    mp = {int(o): i for i, o in enumerate(order)}
    return np.array([mp[int(l)] for l in labels]), mp


def seed_stability(Z, k, n=20, base=SEED):
    """Mean/min pairwise ARI of 20 fits that differ only in random_state (each with the standard 10 restarts)."""
    labs = [KMeans(n_clusters=k, n_init=10, random_state=base + s).fit_predict(Z) for s in range(n)]
    ari = [adjusted_rand_score(a, b) for a, b in itertools.combinations(labs, 2)]
    return float(np.mean(ari)), float(np.min(ari))


def subsample_stability(Z, k, reps=50, frac=0.8, seed=SEED):
    rng = np.random.default_rng(seed)
    full = km(Z, k)
    out = []
    for _ in range(reps):
        i = rng.choice(len(Z), int(frac * len(Z)), replace=False)
        m = KMeans(n_clusters=k, n_init=10, random_state=int(rng.integers(1 << 30))).fit(Z[i])
        out.append(adjusted_rand_score(full.labels_, m.predict(Z)))
    return float(np.mean(out)), reps


def run(p: Panel) -> dict:
    Xr, Z, ok, mu, sd, excl = feature_matrix(p)
    iso = [c for c, m in zip(p.iso3, ok) if m]
    scan = []
    for k in range(2, 9):
        m = km(Z, k)
        sizes = np.bincount(m.labels_)
        sm_, _ = seed_stability(Z, k)
        scan.append(dict(k=k, silhouette=float(silhouette_score(Z, m.labels_)), inertia=float(m.inertia_), stability_ari=sm_, min_cluster_size=int(sizes.min())))
    elig = [s for s in scan if 3 <= s["k"] <= 6 and s["min_cluster_size"] >= 5 and s["stability_ari"] >= 0.8]
    pool = elig or [s for s in scan if 3 <= s["k"] <= 6 and s["min_cluster_size"] >= 5]
    k = max(pool, key=lambda s: s["silhouette"])["k"]
    rule = ("Among k = 3..6 (k = 2 only re-draws the rich/poor line), keep k with min cluster size >= 5 and mean seed ARI >= 0.8; choose the highest silhouette. "
            + ("Rule satisfied." if elig else "No k met the ARI >= 0.8 bar; chose the highest silhouette among k with min size >= 5 (stability caveat applies)."))
    m = km(Z, k)
    lab, mp = relabel(m.labels_, m.cluster_centers_[:, 0])
    cen = np.zeros_like(m.cluster_centers_)
    for o, n_ in mp.items():
        cen[n_] = m.cluster_centers_[o]
    seed_mean, seed_min = seed_stability(Z, k)
    boot_mean, reps = subsample_stability(Z, k)
    sil = silhouette_samples(Z, lab)
    # hierarchical, Ward on the same standardized features
    Lk = linkage(Z, "ward")
    hl = fcluster(Lk, k, "maxclust") - 1
    coph = float(cophenet(Lk, pdist(Z))[0])
    leaves = dendrogram(Lk, no_plot=True)["leaves"]
    # Ward labels mapped to k-means ids by Hungarian assignment on the contingency table (maximum overlap)
    cont = np.zeros((k, k), dtype=int)
    for a_, b_ in zip(hl, lab):
        cont[a_, b_] += 1
    ri, ci = linear_sum_assignment(-cont)
    mapw = {int(r_): int(c_) for r_, c_ in zip(ri, ci)}
    hm = np.array([mapw[int(x)] for x in hl])
    ids = [f[0] for f in FEATURES]
    labels = {f[0]: f[1] for f in FEATURES}
    clusters = []
    for c in range(k):
        sel = lab == c
        cz = dict(zip(ids, cen[c].round(3).tolist()))
        craw = dict(zip(ids, (Xr[sel].mean(0)).round(3).tolist()))
        top = sorted(ids, key=lambda i: -abs(cz[i]))[:2]
        sig = ", ".join(f"{'high' if cz[i] > 0 else 'low'} {labels[i].lower()}" for i in top)
        clusters.append(dict(id=c, size=int(sel.sum()), centroid=craw, centroid_z=cz, signature=sig, members=[i for i, s in zip(iso, sel) if s]))
    feats = [dict(id=i, label=l, transform=t, source=s, mean=float(mu[j]), sd=float(sd[j]), price_basis=basis_of(s)) for j, (i, l, t, s) in enumerate(FEATURES)]
    return dict(
        method="Complete-case country features, z-scored (population sd), KMeans(n_init=10, random_state=seed); Ward linkage on the same matrix for comparison. No imputation.",
        features=feats, feature_window=dict(level=list(LEVEL_WIN), growth=list(GROWTH_WIN), min_obs=MIN_OBS),
        inclusion=dict(complete_cases=int(ok.sum()), countries=len(p.iso3), excluded=excl),
        k_scan=scan, chosen_k=k, choice_rule=rule, seeds=dict(n=20, base=SEED),
        stability=dict(seed_ari_mean=seed_mean, seed_ari_min=seed_min, bootstrap_ari_mean=boot_mean, bootstrap_reps=reps),
        hierarchical=dict(linkage="ward", cophenetic_corr=coph, ari_vs_kmeans=float(adjusted_rand_score(lab, hl)), labels=[int(x) for x in hl], labels_matched=[int(x) for x in hm], disagree_count=int((hm != lab).sum()),
                          match_rule="Hungarian assignment of Ward groups to k-means ids maximising overlap; disagree_count = countries whose matched Ward id differs from their k-means id", leaf_order=[iso[i] for i in leaves]),
        clusters=clusters, assignments=dict(iso3=iso, cluster=[int(x) for x in lab], silhouette=[float(x) for x in sil.round(4)]),
        tag_detail="Assignments are PREDICTED labels from an unsupervised model on DERIVED features; groups are descriptive, not causal and not a development stage.")
