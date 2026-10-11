"""Seed-head territory layouts (DR-1). Ported from design/sketches/territories.py, algorithm unchanged.

Grains: N = sum(counts) points of one Vogel disc (fixed lattice per N). Sites: one per country, seeded at its cumulative-rank
position (highest value at the core) or warm-started from the previous year's final sites. Each country receives exactly its
grain count by iterated power assignment (cost = |g - s|^2 - w_c, weights raised for under-filled countries, sites relaxed
toward their centroids) finished by an exact greedy repair. Deterministic: no randomness, fixed iteration counts, stable sorts.
"""
from __future__ import annotations

import math

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import cKDTree

GOLDEN = math.pi * (3 - math.sqrt(5))
UNIT_PEOPLE = 1_000_000


def lattice(n: int) -> np.ndarray:
    i = np.arange(n) + 0.5
    r = np.sqrt(i / n)
    a = np.arange(n) * GOLDEN
    return np.c_[r * np.cos(a), r * np.sin(a)]


def counts_for(pops, unit: float = UNIT_PEOPLE) -> np.ndarray:
    """Slots per country: floor(pop/unit + 0.5), minimum one. Per-country, half-up (not banker's), independent of sort order."""
    return np.maximum(1, np.floor(np.asarray(pops, dtype=float) / unit + 0.5)).astype(int)


def rank_sites(counts: np.ndarray) -> np.ndarray:
    n = int(counts.sum())
    cum = np.concatenate([[0], np.cumsum(counts)])
    k = np.arange(len(counts))
    rr = np.sqrt((cum[:-1] + counts / 2) / n)
    return np.c_[rr * np.cos(k * GOLDEN), rr * np.sin(k * GOLDEN)]


def _cost(G, S, w):
    """Power cost |g - s|^2 - w_c for every grain and site, via the expanded square (same quantity, one matmul)."""
    return (G * G).sum(1)[:, None] - 2.0 * (G @ S.T) + (S * S).sum(1)[None, :] - w[None, :]


def assign(counts: np.ndarray, iters: int = 120, seed_sites: np.ndarray | None = None, step: float = 0.6, relax: float = 0.3):
    n = int(counts.sum())
    G = lattice(n)
    S = rank_sites(counts) if seed_sites is None else seed_sites.copy()
    w = np.zeros(len(counts))
    for _ in range(iters):
        own = _cost(G, S, w).argmin(1)
        got = np.bincount(own, minlength=len(counts))
        w += step * (counts - got) / n
        live = got > 0
        cx = np.bincount(own, weights=G[:, 0], minlength=len(counts))
        cy = np.bincount(own, weights=G[:, 1], minlength=len(counts))
        cen = np.c_[cx, cy] / np.maximum(got, 1)[:, None]
        S[live] = (1 - relax) * S[live] + relax * cen[live]
    d = _cost(G, S, w)
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


def knn_graph(G: np.ndarray, k: int = 6) -> np.ndarray:
    return cKDTree(G).query(G, k + 1)[1][:, 1:]


def _components(nb: np.ndarray, own: np.ndarray):
    n, k = nb.shape
    i = np.repeat(np.arange(n), k)
    j = nb.ravel()
    m = own[i] == own[j]
    A = coo_matrix((np.ones(int(m.sum())), (i[m], j[m])), shape=(n, n))
    return connected_components(A, directed=False)[1]


def connectivity(G: np.ndarray, own: np.ndarray, counts: np.ndarray, k: int = 6, nb: np.ndarray | None = None) -> np.ndarray:
    """Per country: fraction of its slots in its largest component of the 6-nearest-neighbour lattice graph (within-territory edges)."""
    nb = knn_graph(G, k) if nb is None else nb
    lab = _components(nb, own)
    sizes = {}
    for o, l in zip(own.tolist(), lab.tolist()):
        sizes[(o, l)] = sizes.get((o, l), 0) + 1
    best = np.zeros(len(counts))
    for (o, _), c in sizes.items():
        best[o] = max(best[o], c)
    return best / counts


def _transfer(own, G, nb, X, anchor: set, f: int, site) -> list[int] | None:
    """Pick f grains of X that grow a chain outward from `anchor` (adjacent to it), nearest `site`. None if impossible."""
    owned = np.flatnonzero(own == X).tolist()
    grow, taken = set(anchor), []
    for _ in range(f):
        cand = [h for h in owned if h not in grow and any(int(x) in grow for x in nb[h])]
        if not cand:
            return None
        h = min(cand, key=lambda x: (((G[x] - site) ** 2).sum(), x))
        taken.append(h)
        grow.add(h)
    return taken


def polish(G: np.ndarray, own: np.ndarray, S: np.ndarray, counts: np.ndarray, nb: np.ndarray, max_moves: int = 3000) -> np.ndarray:
    """Count-preserving contiguity repair (an addition to the sketch, which fragments territories). A stranded fragment of
    country A (f grains) is handed to a neighbouring country B1; ownership then ripples along a shortest chain of touching
    territories B1 -> ... -> Bk, each handing f boundary grains to the next, and Bk hands f grains back to A next to its
    main body. Every country keeps its exact count. One move per pass, components recomputed. Deterministic: fixed scan
    order, ties to the lowest index."""
    own = own.copy()
    failed: set = set()
    for _ in range(max_moves):
        lab = _components(nb, own)
        comps: dict[int, dict[int, list[int]]] = {}
        for g, (o, l) in enumerate(zip(own.tolist(), lab.tolist())):
            comps.setdefault(o, {}).setdefault(l, []).append(g)
        adj: dict[int, set] = {}
        for g in range(len(own)):
            for h in nb[g]:
                if own[h] != own[g]:
                    adj.setdefault(int(own[g]), set()).add(int(own[h]))
        done = False
        for A in sorted(comps):
            cs = sorted(comps[A].values(), key=lambda c: (-len(c), c[0]))
            for frag in cs[1:]:
                key = (A, frag[0], len(frag), len(cs[0]))
                if key in failed:
                    continue
                main = set(cs[0])
                f = len(frag)
                starts = sorted({int(own[h]) for g in frag for h in nb[g] if own[h] != A})
                targets = {int(own[h]) for g in main for h in nb[g] if own[h] != A}
                prev = {b: None for b in starts}
                queue = list(starts)
                hit = next((b for b in queue if b in targets), None)
                while hit is None and queue:
                    nxt = []
                    for u in queue:
                        for v in sorted(adj.get(u, ())):
                            if v != A and v not in prev:
                                prev[v] = u
                                nxt.append(v)
                    queue = nxt
                    hit = next((b for b in queue if b in targets), None)
                if hit is None:
                    failed.add(key)
                    continue
                path = [hit]
                while prev[path[-1]] is not None:
                    path.append(prev[path[-1]])
                path.reverse()                      # B1 .. Bk
                new = own.copy()
                new[frag] = path[0]
                ok = True
                for X, Y in zip(path, path[1:] + [A]):
                    anchor = main if Y == A else set(np.flatnonzero(new == Y).tolist())
                    site = S[Y]
                    t = _transfer(new, G, nb, X, anchor, f, site)
                    if t is None:
                        ok = False
                        break
                    new[t] = Y
                if ok:
                    own, done = new, True
                    break
                failed.add(key)
            if done:
                break
        if not done:
            break
    return own


def layout(iso3: list[str], counts: np.ndarray, warm: dict[str, np.ndarray] | None = None, iters: int | None = None):
    """Layout for countries in rank order. warm maps iso3 -> previous final site (missing countries get their rank seed)."""
    seed = None
    if warm:
        r = rank_sites(counts)
        seed = np.array([warm.get(c, r[k]) for k, c in enumerate(iso3)])
    G, own, S = assign(counts, iters=iters or (200 if warm else 600), seed_sites=seed)
    nb = knn_graph(G)
    own = polish(G, own, S, counts, nb)  # S here is the pre-repair site (used as the pull target)
    cx = np.bincount(own, weights=G[:, 0], minlength=len(counts))
    cy = np.bincount(own, weights=G[:, 1], minlength=len(counts))
    return G, own, np.c_[cx, cy] / counts[:, None], connectivity(G, own, counts, nb=nb)
