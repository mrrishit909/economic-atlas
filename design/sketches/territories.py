"""Run with: uv run --with numpy python design/sketches/render_seed_sketch.py

Capacity-constrained territories on a fixed Vogel lattice (sketch of the Mosaic layout; production layout is DR-1).

Grains: the N = round(people / 1M) Vogel points of one disc. Sites: one per country, seeded at its cumulative-income
position (richest at the core). Each country receives exactly its grain count by an iterated power assignment
(cost = |g - s|^2 - w_c, weights raised for under-filled countries, sites relaxed to their centroids), finished by an
exact greedy repair. Returns owner[grain] (country index) for the given rows.
"""
import math
import numpy as np

GOLDEN = math.pi * (3 - math.sqrt(5))


def lattice(n):
    i = np.arange(n) + 0.5
    r = np.sqrt(i / n)
    a = np.arange(n) * GOLDEN
    return np.c_[r * np.cos(a), r * np.sin(a)]


def counts_for(pops, unit=1e6):
    """Per-country rounding (independent of sort order), minimum one slot: a country under 0.5M people holds one
    slot and its seed is drawn at its true area (pop / unit of a full seed)."""
    return np.maximum(1, np.round(np.asarray(pops) / unit)).astype(int)


def assign(counts, iters=120, seed_sites=None):
    n = int(counts.sum())
    G = lattice(n)
    cum = np.concatenate([[0], np.cumsum(counts)])
    k = np.arange(len(counts))
    rr = np.sqrt((cum[:-1] + counts / 2) / n)
    S = np.c_[rr * np.cos(k * GOLDEN), rr * np.sin(k * GOLDEN)] if seed_sites is None else seed_sites.copy()
    w = np.zeros(len(counts))
    live = counts > 0
    for it in range(iters):
        d = ((G[:, None, :] - S[None, :, :]) ** 2).sum(-1) - w[None, :]
        d[:, ~live] = np.inf
        own = d.argmin(1)
        got = np.bincount(own, minlength=len(counts))
        w += 0.6 * (counts - got) / n
        for c in np.flatnonzero(got):
            S[c] = 0.7 * S[c] + 0.3 * G[own == c].mean(0)
    # exact repair: move grains from over-full to under-full countries, cheapest power-cost first
    d = ((G[:, None, :] - S[None, :, :]) ** 2).sum(-1) - w[None, :]
    d[:, ~live] = np.inf
    own = d.argmin(1)
    got = np.bincount(own, minlength=len(counts))
    while (got != counts).any():
        over = np.flatnonzero(got > counts)
        under = np.flatnonzero(got < counts)
        cand = np.flatnonzero(np.isin(own, over))
        sub = d[np.ix_(cand, under)] - d[cand, own[cand]][:, None]
        gi, uj = np.unravel_index(sub.argmin(), sub.shape)
        g, u = cand[gi], under[uj]
        got[own[g]] -= 1
        got[u] += 1
        own[g] = u
    return G, own, S
