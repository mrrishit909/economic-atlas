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


def assign(counts: np.ndarray, iters: int = 120, seed_sites: np.ndarray | None = None, step: float = 0.6, relax: float = 0.3, anchor: float = 0.0):
    n = int(counts.sum())
    G = lattice(n)
    RS = rank_sites(counts)
    rr = np.hypot(RS[:, 0], RS[:, 1])
    S = RS.copy() if seed_sites is None else seed_sites.copy()
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
        if anchor:  # rank-radius anchor: pull each site's radius toward its rank radius, keeping its angle
            r = np.hypot(S[:, 0], S[:, 1])
            tgt = (1 - anchor) * r + anchor * rr
            S = np.where(r[:, None] > 1e-9, S * (tgt / np.maximum(r, 1e-9))[:, None], RS)
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


RANK_BOUND = 0.85   # layouts below this rank-radius Spearman are re-solved cold (the published tests assert >= 0.80)
ANCHOR = 0.5


def rank_stats(own: np.ndarray, G: np.ndarray, counts: np.ndarray) -> tuple[float, float, np.ndarray]:
    """(Spearman of rank vs centroid radius, max |centroid radius - rank radius|, centroids)."""
    from scipy.stats import spearmanr
    cen = np.c_[np.bincount(own, weights=G[:, 0], minlength=len(counts)), np.bincount(own, weights=G[:, 1], minlength=len(counts))] / counts[:, None]
    r = np.hypot(cen[:, 0], cen[:, 1])
    rr = np.hypot(*rank_sites(counts).T)
    rho = 1.0 if len(counts) < 3 else float(spearmanr(np.arange(len(counts)), r)[0])
    return rho, float(np.abs(r - rr).max()), cen


DEV_TOL = 0.2


def reseed(G: np.ndarray, own: np.ndarray, counts: np.ndarray, tol: float = DEV_TOL) -> np.ndarray:
    """Return stranded territories to their rank radius (count-preserving). For a country whose centroid radius is more than
    `tol` from its rank radius, it takes the grains nearest its rank site; the countries those grains belonged to receive the
    same number of the country's old grains (nearest their own centroids). Rank order scan, ties to the lowest index."""
    own = own.copy()
    RS = rank_sites(counts)
    for A in range(len(counts)):
        mine = np.flatnonzero(own == A)
        cen = G[mine].mean(0)
        if abs(np.hypot(*cen) - np.hypot(*RS[A])) <= tol:
            continue
        d = ((G - RS[A]) ** 2).sum(1)
        want = np.lexsort((np.arange(len(G)), d))[: counts[A]]
        gain = want[own[want] != A]
        lose = mine[~np.isin(mine, want)]
        if len(gain) == 0:
            continue
        owners = own[gain]
        cens = {int(b): G[own == b].mean(0) for b in np.unique(owners)}
        lose = sorted(lose.tolist())
        for b in sorted(cens):
            k = int((owners == b).sum())
            pick = sorted(lose, key=lambda g: (((G[g] - cens[b]) ** 2).sum(), g))[:k]
            own[pick] = b
            lose = [g for g in lose if g not in set(pick)]
        own[gain] = A
    return own


def _solve(counts, seed, iters, anchor=ANCHOR, do_reseed=True):
    G, own, S = assign(counts, iters=iters, seed_sites=seed, anchor=anchor)
    nb = knn_graph(G)
    own = polish(G, own, S, counts, nb)
    if do_reseed:
        own = reseed(G, own, counts)
        own = polish(G, own, S, counts, nb)
    return G, own, S, nb


COLD_TRIES = [(600, ANCHOR, True), (600, ANCHOR, False), (800, ANCHOR, True), (500, ANCHOR, True), (700, 0.3, True), (900, ANCHOR, True)]


def layout(iso3: list[str], counts: np.ndarray, warm: dict[str, np.ndarray] | None = None, iters: int | None = None):
    """Layout for countries in rank order. `warm` maps iso3 -> previous final centroid: the new site keeps the previous
    direction but takes its radius from the current rank (territories drift in angle, never in rank order). A candidate is
    accepted when its rank-radius Spearman is >= RANK_BOUND and at most one territory is under 95 percent connected; otherwise
    the next deterministic candidate is tried (warm first, then cold solves with other iteration counts), and the best by
    (fragmented territories, Spearman) is kept. Returns G, own, centroids, connectivity, (spearman, max radius deviation, cold)."""
    r = rank_sites(counts)
    tries = []
    if warm:
        seed = np.array([np.hypot(*r[k]) * warm[c] / max(np.hypot(*warm[c]), 1e-9) if c in warm else r[k] for k, c in enumerate(iso3)])
        tries.append((seed, iters or 200, ANCHOR, True, False))
    tries += [(None, iters or it, an, rs, True) for it, an, rs in COLD_TRIES]
    best = None
    for seed, it, an, rs, cold in tries:
        G, own, S, nb = _solve(counts, seed, it, an, rs)
        rho, dev, cen = rank_stats(own, G, counts)
        cf = connectivity(G, own, counts, nb=nb)
        bad = int((cf < 0.95).sum())
        cand = ((bad, -rho), G, own, cen, cf, (rho, dev, cold))
        if best is None or cand[0] < best[0]:
            best = cand
        if bad <= 1 and rho >= RANK_BOUND:
            break
    return best[1], best[2], best[3], best[4], best[5]
