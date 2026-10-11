"""Beta- and sigma-convergence. Absolute (unconditional) only. Money levels: one basis per regression via assert_same_basis."""
from __future__ import annotations

import numpy as np
import statsmodels.api as sm
from scipy import stats

from analytics.boundaries import breaks_in_window
from analytics.data import Panel
from analytics.units import assert_same_basis, basis_of

LN2 = np.log(2.0)


def ols_numpy(x: np.ndarray, y: np.ndarray) -> tuple[float, float]:
    """Independent normal-equation OLS (intercept, slope); used to cross-check statsmodels."""
    X = np.column_stack([np.ones_like(x), x])
    b = np.linalg.solve(X.T @ X, X.T @ y)
    return float(b[0]), float(b[1])


def fit_beta(x, y, w=None, reps: int = 2000, seed: int = 20261010) -> dict:
    """Regress y (growth, %/yr) on x (log initial income). HC3 CIs plus a seeded case-bootstrap percentile CI."""
    X = sm.add_constant(x)
    res = (sm.WLS(y, X, weights=w) if w is not None else sm.OLS(y, X)).fit(cov_type="HC3")
    b, se = float(res.params[1]), float(res.bse[1])
    n = len(x)
    t = stats.t.ppf(0.975, n - 2)
    rng = np.random.default_rng(seed)
    bs = np.empty(reps)
    for r in range(reps):
        i = rng.integers(0, n, n)
        if w is None:
            bs[r] = np.polyfit(x[i], y[i], 1)[0]
        else:
            ww = w[i]
            xm, ym = np.average(x[i], weights=ww), np.average(y[i], weights=ww)
            bs[r] = np.sum(ww * (x[i] - xm) * (y[i] - ym)) / np.sum(ww * (x[i] - xm) ** 2)
    return dict(beta=b, se_hc3=se, ci95=[b - t * se, b + t * se], ci95_boot=[float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))],
                intercept=float(res.params[0]), r2=float(res.rsquared), p_value=float(2 * stats.t.sf(abs(b / se), n - 2)))


def half_life(beta_pct: float, T: int) -> float | None:
    """Growth is in percent per year, so b = beta_pct/100 per unit ln y0; b = -(1-exp(-lam T))/T gives lam = -ln(1+bT)/T."""
    b = beta_pct / 100.0
    if b >= 0 or 1 + b * T <= 0:
        return None
    lam = -np.log(1 + b * T) / T
    return float(LN2 / lam)


def window_sample(p: Panel, ind: str, start: int, end: int):
    y0, y1 = p.at(ind, start), p.at(ind, end)
    ok = np.isfinite(y0) & np.isfinite(y1) & (y0 > 0) & (y1 > 0)
    return y0, y1, ok


def beta_records(p: Panel, ind: str, start: int, end: int, tag: str = "DERIVED") -> list[dict]:
    basis = assert_same_basis(ind)
    T = end - start
    y0, y1, ok = window_sample(p, ind, start, end)
    brk = set(breaks_in_window(start, end))
    prim = ok & np.array([c not in brk for c in p.iso3])
    pop0 = p.at("population", start)
    out = []

    def rec(sample, mask, w=None, points=False):
        x = np.log(y0[mask])
        g = 100 * (np.log(y1[mask]) - x) / T
        f = fit_beta(x, g, None if w is None else w[mask])
        r = dict(id=f"{ind}_{start}_{end}_{sample}", indicator=ind, price_basis=basis, tag=tag, sample=sample, start=start, end=end, n=int(mask.sum()), **f,
                 half_life_years=half_life(f["beta"], T), excluded_territory_changes=sorted(brk) if sample != "sensitivity_all" else [],
                 dropped_no_start_data=int((~np.isfinite(y0)).sum()))
        if points:
            r["points"] = dict(iso3=[c for c, m in zip(p.iso3, mask) if m], x=x.tolist(), y=g.tolist(), weight=(None if w is None else w[mask].tolist()))
            if w is None:
                r["points"]["weight"] = [None] * int(mask.sum())
        return r
    out.append(rec("primary", prim, points=True))
    out.append(rec("sensitivity_all", ok))
    xs = np.log(y0[prim])
    q1, q2 = np.quantile(xs, [1 / 3, 2 / 3])
    lx = np.log(np.where(prim, y0, np.nan))
    for name, m in (("tercile_low", prim & (lx <= q1)), ("tercile_mid", prim & (lx > q1) & (lx <= q2)), ("tercile_high", prim & (lx > q2))):
        out.append(rec(name, m))
    wm = prim & np.isfinite(pop0)
    out.append(rec("pop_weighted", wm, w=pop0, points=True))
    return out


def sigma_records(p: Panel, ind: str, start: int, end: int) -> list[dict]:
    basis = basis_of(ind)
    years = list(range(start, end + 1))
    brk = set(breaks_in_window(start, end))
    keep = np.array([c not in brk for c in p.iso3])
    M = p.window(ind, start, end)
    M = np.where(M > 0, M, np.nan)
    L = np.log(M)
    L[~keep] = np.nan
    pop = p.window("population", start, end)
    sd_u, n_u, sd_w = [], [], []
    for j in range(len(years)):
        v = L[:, j]
        m = np.isfinite(v)
        sd_u.append(float(np.std(v[m])) if m.sum() > 2 else None)
        n_u.append(int(m.sum()))
        mw = m & np.isfinite(pop[:, j])
        if mw.sum() > 2:
            w = pop[mw, j]
            mu = np.average(v[mw], weights=w)
            sd_w.append(float(np.sqrt(np.average((v[mw] - mu) ** 2, weights=w))))
        else:
            sd_w.append(None)
    bal = np.isfinite(L).all(1)
    sd_b = [float(np.std(L[bal, j])) for j in range(len(years))]
    base = dict(indicator=ind, price_basis=basis, tag="DERIVED", years=years)
    d = f"population standard deviation of ln({ind}) across countries; countries with a territory break inside the window excluded"
    return [dict(id=f"{ind}_{start}_{end}_unbalanced", sample="unbalanced", sd_log=sd_u, n=n_u, definition=d + "; every country with data that year", **base),
            dict(id=f"{ind}_{start}_{end}_balanced", sample="balanced", sd_log=sd_b, n=[int(bal.sum())] * len(years), definition=d + "; only countries observed in every year of the window", **base),
            dict(id=f"{ind}_{start}_{end}_pop_weighted", sample="pop_weighted", sd_log=sd_w, n=[int((np.isfinite(L[:, j]) & np.isfinite(pop[:, j])).sum()) for j in range(len(years))],
                 definition=d + "; weighted by that year's population around the weighted mean", **base)]
